"""One company's job board. Each board type has a lister (fetch + pure parse_*) and, where the list has no
description or date, a detail step that is run only for roles that passed the title filter.

A lister returns (roles, capped). A missing board raises FetchError with status 404."""
import re
from hunt_core import ISO3, iso, iso_ago, iso_from, money, role, strip_html
from hunt_http import FetchError, fetch_json

MAX_PAGES = 5
MAX_DETAILS = 15


# --- Ashby, Greenhouse, Lever: everything in one request ---

def parse_ashby(d, slug):
    out = []
    for j in (d or {}).get("jobs", []):
        locs = [j.get("location", "")] + [x.get("location", "") for x in j.get("secondaryLocations") or []]
        out.append(role("ashby", j["id"], slug, j["title"], j.get("jobUrl"), "; ".join(filter(None, locs)), j.get("isRemote"),
                        (j.get("compensation") or {}).get("compensationTierSummary"), iso(j.get("publishedAt")),
                        j.get("descriptionPlain", "")))
    return out


def parse_greenhouse(d, slug):
    out = []
    for j in (d or {}).get("jobs", []):
        text = strip_html(j.get("content", ""))
        pay = re.search(r"\$\s?\d{2,3}[,\d]*\s?(?:-|–|to)\s?\$?\s?\d{2,3}[,\d]*", text)
        out.append(role("greenhouse", j["id"], slug, j["title"], j.get("absolute_url"), (j.get("location") or {}).get("name", ""),
                        None, pay.group(0) if pay else None, iso(j.get("first_published")), text))
    return out


def parse_lever(d, slug):
    out = []
    for j in d if isinstance(d, list) else []:
        c = j.get("categories", {})
        text = " ".join([j.get("descriptionPlain", ""), *(strip_html(l.get("content", "")) for l in j.get("lists", [])),
                         j.get("additionalPlain") or ""])
        s = j.get("salaryRange") or {}
        out.append(role("lever", j["id"], slug, j["text"], j.get("hostedUrl"),
                        ", ".join(c.get("allLocations") or [c.get("location") or ""]), j.get("workplaceType") == "remote",
                        money(s.get("min"), s.get("max"), s.get("currency")), iso(j.get("createdAt")), text))
    return out


def ashby(slug, extra, ctx):
    return parse_ashby(fetch_json(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true"), slug), False


def greenhouse(slug, extra, ctx):
    return parse_greenhouse(fetch_json(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"), slug), False


def lever(slug, extra, ctx):
    return parse_lever(fetch_json(f"https://api.lever.co/v0/postings/{slug}?mode=json"), slug), False


# --- Recruitee: everything in one request ---

def parse_recruitee(d, slug):
    out = []
    for j in (d or {}).get("offers", []):
        s = j.get("salary") or {}
        out.append(role("recruitee", j["id"], j.get("company_name") or slug, j["title"], j.get("careers_url"), j.get("location", ""),
                        j.get("remote"), money(s.get("min"), s.get("max"), s.get("currency")), iso(j.get("published_at")),
                        strip_html(f"{j.get('description', '')} {j.get('requirements', '')}")))
    return out


def recruitee(slug, extra, ctx):
    return parse_recruitee(fetch_json(f"https://{slug}.recruitee.com/api/offers/"), slug), False


# --- Workable: list, then one request per kept role for the description ---

def parse_workable(d, slug):
    out = []
    for j in (d or {}).get("results", []):
        l = j.get("location") or {}
        out.append(role("workable", j["shortcode"], slug, j["title"], f"https://apply.workable.com/{slug}/j/{j['shortcode']}/",
                        ", ".join(filter(None, [l.get("city"), l.get("region"), l.get("country")])), j.get("remote"), None,
                        iso(j.get("published"))))
    return out


def workable(slug, extra, ctx):
    d = fetch_json(f"https://apply.workable.com/api/v3/accounts/{slug}/jobs",
                   {"query": "", "location": [], "department": [], "worktype": [], "remote": []})
    return parse_workable(d, slug), bool(d.get("nextPage"))


def workable_detail(r, slug, extra):
    d = fetch_json(f"https://apply.workable.com/api/v2/accounts/{slug}/jobs/{r['sourceJobId']}")
    r["text"] = strip_html(" ".join(d.get(k) or "" for k in ("description", "requirements", "benefits")))


# --- SmartRecruiters ---

def parse_smartrecruiters(d, slug):
    out = []
    for j in (d or {}).get("content", []):
        l = j.get("location") or {}
        out.append(role("smartrecruiters", j["id"], (j.get("company") or {}).get("name") or slug, j["name"],
                        f"https://jobs.smartrecruiters.com/{slug}/{j['id']}", l.get("fullLocation", ""), l.get("remote"), None,
                        iso(j.get("releasedDate"))))
    return out


def smartrecruiters(slug, extra, ctx):
    out, total = [], None
    for page in range(MAX_PAGES):
        d = fetch_json(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100&offset={page * 100}&q=product")
        out += parse_smartrecruiters(d, slug)
        total = d.get("totalFound", 0)
        if len(out) >= total or not d.get("content"):
            return out, False
    return out, True


def smartrecruiters_detail(r, slug, extra):
    d = fetch_json(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings/{r['sourceJobId']}")
    sections = ((d.get("jobAd") or {}).get("sections") or {}).values()
    r["text"] = strip_html(" ".join((s or {}).get("text") or "" for s in sections))
    r["url"] = d.get("postingUrl") or r["url"]


# --- Rippling ---

def parse_rippling(d, slug):
    out = []
    for j in (d or {}).get("items", []):
        locs = j.get("locations") or []
        out.append(role("rippling", j["id"], slug, j["name"], j.get("url"), "; ".join(l.get("name", "") for l in locs),
                        any(l.get("workplaceType") == "REMOTE" for l in locs) or None))
    return out


def rippling(slug, extra, ctx):
    out = []
    for page in range(MAX_PAGES):
        d = fetch_json(f"https://ats.rippling.com/api/v2/board/{slug}/jobs?page={page}&pageSize=50")
        out += parse_rippling(d, slug)
        if page + 1 >= (d.get("totalPages") or 1):
            return out, False
    return out, True


def rippling_detail(r, slug, extra):
    d = fetch_json(f"https://ats.rippling.com/api/v2/board/{slug}/jobs/{r['sourceJobId']}")
    r["text"] = strip_html(" ".join((d.get("description") or {}).values()))
    r["postedAt"] = iso(d.get("createdOn"))


# --- Workday: extra is "<host number>/<site>", e.g. "wd5/NVIDIAExternalCareerSite". 20 per page is its cap. ---

def workday_base(slug, extra):
    wd, _, site = (extra or "").partition("/")
    if not wd or not site:
        raise FetchError(0, "workday entry needs slug:workday:<wdN>/<site>")
    return f"https://{slug}.{wd}.myworkdayjobs.com", site


def parse_workday(d, slug, host, site):
    out = []
    for j in (d or {}).get("jobPostings", []):
        path = j.get("externalPath") or ""
        if not path:
            continue
        req = (j.get("bulletFields") or [path.rsplit("_", 1)[-1]])[0]
        out.append(role("workday", req, slug, j.get("title"), f"{host}/{site}{path}", j.get("locationsText", ""), None, None,
                        iso_ago(j.get("postedOn"))))
        out[-1]["path"] = path
    return out


# Workday's own ids for a country, the same on every company's site. Not every site offers the filter.
WORKDAY_COUNTRY = {"CA": "a30a87ed25634629aa6c3958aa2b91ea", "US": "bc33aa3152ec42d4995f4791a106ed09"}


def workday_pages(host, slug, site, facets):
    out, total = [], 0
    for page in range(MAX_PAGES):
        d = fetch_json(f"{host}/wday/cxs/{slug}/{site}/jobs",
                       {"appliedFacets": facets, "limit": 20, "offset": page * 20, "searchText": "product"})
        if "jobPostings" not in d:
            raise FetchError(200, "no job list in the answer")
        total = d.get("total") or total
        out += parse_workday(d, slug, host, site)
        # The raw page size decides whether there is another page; parse_workday may drop postings with no path.
        if len(d["jobPostings"]) < 20 or (page + 1) * 20 >= total:
            return out, False
    return out, True


def workday(slug, extra, ctx):
    """Roles in the home country when the site has a country filter; otherwise every 'product' match, up to the cap."""
    host, site = workday_base(slug, extra)
    country = WORKDAY_COUNTRY.get((ctx.get("home_code") or "").upper())
    if country:
        try:
            return workday_pages(host, slug, site, {"locationCountry": [country]})
        except FetchError:
            pass
    return workday_pages(host, slug, site, {})


def workday_detail(r, slug, extra):
    host, site = workday_base(slug, extra)
    d = (fetch_json(f"{host}/wday/cxs/{slug}/{site}{r.pop('path')}") or {}).get("jobPostingInfo") or {}
    r["text"] = strip_html(d.get("jobDescription"))
    r["loc"] = "; ".join(filter(None, [d.get("location"), *(d.get("additionalLocations") or [])])) or r["loc"]
    r["postedAt"] = iso(d.get("startDate")) or r["postedAt"]


# --- Amazon: the slug is ignored; the search is for the person's home country. ---

def parse_amazon(d):
    out = []
    for j in (d or {}).get("jobs", []):
        text = strip_html(" ".join(j.get(k) or "" for k in ("description", "basic_qualifications", "preferred_qualifications")))
        out.append(role("amazon", j.get("id_icims") or j["id"], "Amazon", j["title"], "https://www.amazon.jobs" + j.get("job_path", ""),
                        j.get("normalized_location", ""), None, None, iso_from(j.get("posted_date"), "%B %d, %Y"), text))
    return out


def amazon(slug, extra, ctx):
    country = ISO3.get((ctx.get("home_code") or "").upper())
    if not country:
        raise FetchError(0, "amazon needs the home country (FENIX_HOME_COUNTRY or --profile)")
    out, hits = [], 0
    for page in range(2):
        d = fetch_json("https://www.amazon.jobs/en/search.json?base_query=product&sort=recent"
                       f"&country={country}&result_limit=100&offset={page * 100}")
        hits = d.get("hits") or 0
        out += parse_amazon(d)
        if len(out) >= hits or not d.get("jobs"):
            return out, False
    return out, True


BOARDS = {
    "ashby": (ashby, None), "greenhouse": (greenhouse, None), "lever": (lever, None), "recruitee": (recruitee, None),
    "workable": (workable, workable_detail), "smartrecruiters": (smartrecruiters, smartrecruiters_detail),
    "rippling": (rippling, rippling_detail), "workday": (workday, workday_detail), "amazon": (amazon, None),
}
GUESS = ("ashby", "greenhouse", "lever")


def scan_company(slug, board, extra, ctx, keep):
    """Returns dict(board, status ok|failed|notfound, reason, read, roles (kept), capped, details_capped)."""
    res = dict(board=board, status="notfound", reason="", read=0, roles=[], capped=False, details_capped=False)
    errors = []
    for name in ([board] if board else GUESS):
        if name not in BOARDS:
            res.update(status="failed", reason=f"unknown board type {name}")
            return res
        lister, detail = BOARDS[name]
        try:
            jobs, capped = lister(slug, extra, ctx)
        except FetchError as e:
            if e.status == 404:
                continue
            if not board:  # guessing: remember the error and try the next board type
                errors.append(f"{name} {e}")
                continue
            res.update(board=name, status="failed", reason=str(e))
            return res
        except (KeyError, TypeError, AttributeError, ValueError) as e:
            res.update(board=name, status="failed", reason=f"unexpected answer ({type(e).__name__}: {e})")
            return res
        if not jobs and not board:
            continue
        kept = [j for j in jobs if keep(j["title"])]
        if detail:
            res["details_capped"] = len(kept) > MAX_DETAILS
            for j in kept[:MAX_DETAILS]:
                try:
                    detail(j, slug, extra)
                except (FetchError, KeyError, TypeError, AttributeError, ValueError):
                    pass
            for j in kept:
                j.pop("path", None)
        res.update(board=name, status="ok", read=len(jobs), roles=kept, capped=capped)
        return res
    # A 429 or 5xx while guessing is a board that did not answer, not a company without a board.
    if errors and any(not e.split()[1].startswith(("400", "403", "410")) for e in errors):
        res.update(status="failed", reason="; ".join(errors))
    return res
