"""Sources that list many companies. Each reader returns dict(read, roles, dropped, capped) and raises FetchError
when the source cannot be read. Roles carry the feed's name in `via`; `resolve_posting` later rewrites the ones
that link straight to a company's board."""
import html, json, re, time
from urllib.parse import quote
from hunt_core import FEED_QUERIES, is_repost_link, iso, iso_ago, iso_from, money, role, strip_html
from hunt_http import FetchError, fetch, fetch_json

GETRO_QUERIES = ["head of product", "vp product", "head of growth"]
GETRO_DELAY = 10  # seconds between requests to one board; the boards' robots files ask for it
WELLFOUND_ROLES = ["head-of-product", "vp-of-product"]


def result(read=0, roles=None, dropped=0, capped=False):
    return dict(read=read, roles=roles or [], dropped=dropped, capped=capped)


def next_data(page):
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', page, re.S)
    if not m:
        raise FetchError(200, "page data not found")
    return json.loads(m.group(1))


def home_ok(ctx, *texts):
    return bool(ctx.get("home_re") and ctx["home_re"].search(" ".join(t or "" for t in texts)))


# --- Himalayas: remote roles open to the home country, Director and Executive ---

def parse_himalayas(d):
    out = []
    for j in (d or {}).get("jobs", []):
        link = j.get("guid") or j.get("applicationLink", "").split("?")[0]
        where = ", ".join(j.get("locationRestrictions") or []) or "Worldwide"
        out.append(role("himalayas", link.split("/companies/")[-1], j.get("companyName"), j.get("title"), link,
                        f"Remote: {where}", True, money(j.get("minSalary"), j.get("maxSalary"), j.get("currency")),
                        iso(j.get("pubDate")), strip_html(j.get("description")), "himalayas"))
    return out


HIMALAYAS_DELAY = 3  # seconds between requests; faster than this it answers 429


def himalayas_page(url, sleep):
    sleep(HIMALAYAS_DELAY)
    try:
        return fetch_json(url)
    except FetchError as e:
        if e.status != 429:
            raise
        sleep(30)
        return fetch_json(url)


def himalayas(cfg, ctx, sleep=time.sleep):
    code = (ctx.get("home_code") or "").upper()
    if not code:
        raise FetchError(0, "himalayas needs the home country (FENIX_HOME_COUNTRY or --profile)")
    seen, out, capped = set(), [], False
    for q in FEED_QUERIES:
        for level in ("Director", "Executive"):
            for page in (1, 2):
                d = himalayas_page(f"https://himalayas.app/jobs/api/search?q={quote(q)}&country={code}&seniority={level}&page={page}", sleep)
                for r in parse_himalayas(d):
                    if r["sourceJobId"] not in seen:
                        seen.add(r["sourceJobId"])
                        out.append(r)
                total = d.get("totalCount") or 0
                if total <= page * 20:
                    break
                capped = capped or (page == 2 and total > 40)
    return result(len(out), out, capped=capped)


# --- Getro boards (Communitech, fund portfolios): the data embedded in the board's own public page ---

def parse_getro(page_data, feed):
    out = []
    jobs = (((page_data.get("props") or {}).get("pageProps") or {}).get("initialState") or {}).get("jobs") or {}
    for j in jobs.get("found") or []:
        org = (j.get("organization") or {}).get("name")
        cents = (j.get("compensationAmountMinCents"), j.get("compensationAmountMaxCents"))
        pay = money(*[c / 100 if c else None for c in cents], j.get("compensationCurrency")) if j.get("compensationPublic") else None
        # searchableLocations adds parent regions ("North America" on a New York role), so only locations is used.
        out.append(role(feed, j["id"], org, j.get("title"), j.get("url"), "; ".join(j.get("locations") or []), j.get("workMode") == "remote",
                        pay, iso(j.get("createdAt")), "", feed))
    return out, jobs.get("total") or 0


def getro(boards, ctx, sleep=time.sleep):
    """boards: [(host, feed name)]. One request per board per query, rounds spaced so no board is hit faster than asked."""
    results = {name: result() for _, name in boards}
    seen = {name: set() for _, name in boards}
    errors = {}
    for n, q in enumerate(GETRO_QUERIES):
        if n:
            sleep(GETRO_DELAY)
        for host, name in boards:
            if name in errors:
                continue
            try:
                found, total = parse_getro(next_data(fetch(f"https://{host}/jobs?q={quote(q)}")), name)
            except FetchError as e:
                errors[name] = e
                continue
            res = results[name]
            res["capped"] = res["capped"] or total > len(found)
            for r in found:
                if r["sourceJobId"] in seen[name]:
                    continue
                seen[name].add(r["sourceJobId"])
                res["read"] += 1
                if is_repost_link(r["url"]) or not r["company"]:
                    res["dropped"] += 1
                elif r["remote"] or re.search(r"\bremote\b", r["loc"], re.I) or home_ok(ctx, r["loc"]):
                    res["roles"].append(r)
                else:
                    res["dropped"] += 1
    return results, errors


# --- Wellfound: remote role pages; kept when the home country is accepted or no country list is given ---

def parse_wellfound(page_data):
    data = ((page_data.get("props") or {}).get("pageProps") or {}).get("apolloState", {}).get("data", {})
    company = {}
    for k, v in data.items():
        if k.startswith("StartupResult:"):
            for ref in v.get("highlightedJobListings") or []:
                company[ref.get("__ref", "").split(":")[-1]] = v.get("name")
    out = []
    for k, j in data.items():
        if not k.startswith("JobListingSearchResult:"):
            continue
        accepted = j.get("acceptedRemoteLocationNames") or []
        where = "Remote: " + (", ".join(accepted) or "not stated") if j.get("remote") else ", ".join(j.get("locationNames") or [])
        r = role("wellfound", j["id"], company.get(str(j["id"])), j.get("title"), f"https://wellfound.com/jobs/{j['id']}-{j.get('slug', '')}",
                 where, j.get("remote"), j.get("compensation") or None, iso(j.get("liveStartAt")), strip_html(j.get("description")),
                 "wellfound")
        r["accepted"] = accepted
        out.append(r)
    return out


def wellfound(cfg, ctx):
    res, seen = result(), set()
    for slug in WELLFOUND_ROLES:
        for r in parse_wellfound(next_data(fetch(f"https://wellfound.com/role/r/{slug}"))):
            if r["sourceJobId"] in seen:
                continue
            seen.add(r["sourceJobId"])
            res["read"] += 1
            accepted = r.pop("accepted")
            if not accepted or ctx.get("home_name") in accepted or home_ok(ctx, " ".join(accepted)):
                res["roles"].append(r)
            else:
                res["dropped"] += 1
    return res


# --- Y Combinator: product roles; US-only roles dropped ---

def parse_yc(page):
    m = re.search(r'data-page="([^"]+)"', page)
    if not m:
        raise FetchError(200, "page data not found")
    out = []
    for j in json.loads(html.unescape(m.group(1))).get("props", {}).get("jobPostings", []):
        r = role("yc", j["id"], j.get("companyName"), j.get("title"), "https://www.ycombinator.com" + j.get("url", ""),
                 j.get("location", ""), "remote" in (j.get("location") or "").lower(), j.get("salaryRange") or None,
                 iso_ago(j.get("createdAt")), "", "yc")
        r["visa"] = j.get("visa") or ""
        out.append(r)
    return out


def yc(cfg, ctx):
    res, seen = result(), set()
    for path in ("/jobs/role/product-manager", "/jobs/role/product-manager/remote"):
        for r in parse_yc(fetch("https://www.ycombinator.com" + path)):
            if r["sourceJobId"] in seen:
                continue
            seen.add(r["sourceJobId"])
            res["read"] += 1
            if "visa only" in r.pop("visa").lower():
                res["dropped"] += 1
            else:
                res["roles"].append(r)
    return res


# --- We Work Remotely: the product RSS feed; roles limited to another region dropped ---

def parse_wwr(xml):
    out = []
    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        def tag(name):
            m = re.search(rf"<{name}>(.*?)</{name}>", item, re.S)
            return html.unescape(re.sub(r"^<!\[CDATA\[|\]\]>$", "", m.group(1).strip())) if m else ""
        company, _, title = tag("title").partition(": ")
        link = tag("link") or tag("guid")
        r = role("wwr", link.rstrip("/").rsplit("/", 1)[-1], company, title or company, link, tag("region"), True, None,
                 iso_from(tag("pubDate"), "%a, %d %b %Y %H:%M:%S %z"), strip_html(tag("description")), "wwr")
        out.append(r)
    return out


def wwr(cfg, ctx):
    res = result()
    for r in parse_wwr(fetch("https://weworkremotely.com/categories/remote-product-jobs.rss")):
        res["read"] += 1
        region = r["loc"]
        if re.search(r"anywhere|north america|americas", region, re.I) or not region or home_ok(ctx, region):
            res["roles"].append(r)
        else:
            res["dropped"] += 1
    return res


# --- Mind the Product: the newest 20 roles embedded in the list page; kept when they mention the home country ---

def parse_mtp(page_data):
    out = []
    for j in (((page_data.get("props") or {}).get("pageProps") or {}).get("initialJobs") or {}).get("jobs") or []:
        r = role("mindtheproduct", j["id"], j.get("company"), j.get("title"),
                 j.get("applicationUrl") or f"https://www.mindtheproduct.com/jobs/listing/{j.get('slug', '')}",
                 ("Remote: " if j.get("remote") else "") + (j.get("location") or j.get("country") or ""), j.get("remote"),
                 j.get("salary") or None, iso(j.get("publishedAt")), strip_html(j.get("description")), "mindtheproduct")
        out.append(r)
    return out


def mtp(cfg, ctx):
    res = result()
    for r in parse_mtp(next_data(fetch("https://www.mindtheproduct.com/jobs/"))):
        res["read"] += 1
        if home_ok(ctx, r["loc"], r["text"]):
            res["roles"].append(r)
        else:
            res["dropped"] += 1
    res["capped"] = True  # the page only ever shows the newest 20
    return res


FEEDS = {"himalayas": himalayas, "wellfound": wellfound, "yc": yc, "wwr": wwr, "mindtheproduct": mtp}
