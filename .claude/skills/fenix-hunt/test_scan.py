"""Offline checks for the hunt scanner (pnpm check:hunt). Fixtures are trimmed real responses; no network."""
import io, json, re, sys
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import hunt_ats, hunt_core, hunt_feeds, scan
from hunt_http import FetchError

FIX = Path(__file__).parent / "fixtures"
load = lambda name: json.loads((FIX / name).read_text())
checks = []


def check(name, got, want):
    checks.append((name, got == want, got, want))


# --- title filters ---
for title, wide, want in [
    ("Head of Product", False, True), ("VP, Product Management", False, True), ("Senior Director, Product Growth", False, True),
    ("Vice-président·e Produit | Head Of Product", False, True), ("SVP, Product", False, True),
    ("Product Manager, Claude Code", False, False), ("Product Manager, Claude Code", True, True),
    ("Head of Product Marketing", False, False), ("Head of Product Marketing", True, False),
    ("Senior Product Designer", True, False), ("Product Content Creator", True, False), ("Senior Product Architect, Storage", True, False),
    ("Director, Product Security", True, True), ("Product Operations Manager", True, True), ("Growth Lead, Brazil", True, True), ("Staff Software Engineer, Growth", True, False), ("", True, False),
]:
    check(f"keep_title {title!r} wide={wide}", hunt_core.keep_title(title, wide), want)

# --- dates ---
check("iso: Ashby text", hunt_core.iso("2026-11-12T15:04:05.123456+00:00"), "2026-11-12T15:04:05.000Z")
check("iso: Lever milliseconds", hunt_core.iso(1793708432000), "2026-11-03T12:20:32.000Z")
check("iso: epoch seconds", hunt_core.iso(1793708432), "2026-11-03T12:20:32.000Z")
check("iso: Recruitee text", hunt_core.iso("2026-11-11 13:21:40 UTC"), "2026-11-11T13:21:40.000Z")
check("iso: junk", [hunt_core.iso(v) for v in (None, "", "soon", True)], [None, None, None, None])
check("iso_from: Amazon", hunt_core.iso_from("November 13, 2026", "%B %d, %Y"), "2026-11-13T00:00:00.000Z")
from datetime import datetime, timezone
NOW = datetime(2026, 11, 13, 12, tzinfo=timezone.utc)
check("iso_ago: 16 days", hunt_core.iso_ago("16 days", NOW), "2026-10-28T12:00:00.000Z")
check("iso_ago: Posted 8 Days Ago", hunt_core.iso_ago("Posted 8 Days Ago", NOW), "2026-11-05T12:00:00.000Z")
check("iso_ago: 30+ days is unknown", hunt_core.iso_ago("Posted 30+ Days Ago", NOW), None)
check("iso_ago: today and yesterday", [hunt_core.iso_ago("Posted Today", NOW), hunt_core.iso_ago("Posted Yesterday", NOW)],
      ["2026-11-13T12:00:00.000Z", "2026-11-12T12:00:00.000Z"])
check("iso_from: an offset is converted, not dropped", hunt_core.iso_from("Mon, 09 Nov 2026 23:00:00 -0500", "%a, %d %b %Y %H:%M:%S %z"),
      "2026-11-10T04:00:00.000Z")

# --- posting links ---
check("posting_ref ashby", hunt_core.posting_ref("https://jobs.ashbyhq.com/n8n/cc5ce6e0-5d50-4cfd-a522-4304dc09d29b?utm=x"),
      ("ashby", "cc5ce6e0-5d50-4cfd-a522-4304dc09d29b"))
check("posting_ref greenhouse", hunt_core.posting_ref("https://boards.greenhouse.io/geotab/jobs/5471107008"), ("greenhouse", "5471107008"))
check("posting_ref greenhouse embed", hunt_core.posting_ref("https://example.com/careers?gh_jid=123456"), ("greenhouse", "123456"))
check("posting_ref lever", hunt_core.posting_ref("https://jobs.lever.co/pointclickcare/3c86ab37-0891-442b-a0fd-e5880f84bf74/apply"),
      ("lever", "3c86ab37-0891-442b-a0fd-e5880f84bf74"))
check("posting_ref other", hunt_core.posting_ref("https://chimp.bamboohr.com/careers/165"), None)
check("repost link", [hunt_core.is_repost_link(u) for u in ("https://remote.com/jobs/x", "https://jobs.ashbyhq.com/remote/1")], [True, False])

# --- company-board parsers ---
r = hunt_ats.parse_workday(load("workday_list.json"), "nvidia", "https://nvidia.wd5.myworkdayjobs.com", "NVIDIAExternalCareerSite")[0]
check("workday list", (r["source"], r["sourceJobId"], r["title"], r["url"]),
      ("workday", "JR2023506", "Product Manager - Open Models",
       "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/China-Beijing/Product-Manager---Open-Models_JR2023506"))
r = hunt_ats.parse_workable(load("workable_list.json"), "huggingface")[0]
check("workable list", (r["sourceJobId"], r["url"], r["loc"], r["remote"], r["postedAt"]),
      ("DB4D7C0EC8", "https://apply.workable.com/huggingface/j/DB4D7C0EC8/", "France", True, "2026-09-21T00:00:00.000Z"))
r = hunt_ats.parse_smartrecruiters(load("smartrecruiters_list.json"), "ServiceNow")[0]
check("smartrecruiters list", (r["sourceJobId"], r["company"], r["title"], r["loc"], r["postedAt"]),
      ("744000161548289", "ServiceNow", "AI Security Engineer Intern", "San Diego, California, United States", "2026-11-13T17:50:24.000Z"))
r = hunt_ats.parse_recruitee(load("recruitee.json"), "bunq")[0]
check("recruitee", (r["sourceJobId"], r["company"], r["title"], r["url"], r["postedAt"], r["comp"]),
      ("2823928", "bunq", "Security Engineer", "https://careers.bunq.com/o/security-engineer-3", "2026-11-11T13:21:40.000Z", None))
r = hunt_ats.parse_rippling(load("rippling_list.json"), "rippling")[0]
check("rippling list", (r["sourceJobId"], r["title"], r["loc"]),
      ("84d388b6-7656-434c-8862-0312eb6b97ac", "Business Operations Manager", "New York, NY"))
r = hunt_ats.parse_amazon(load("amazon.json"))[0]
check("amazon", (r["sourceJobId"], r["company"], r["title"], r["url"], r["loc"], r["postedAt"]),
      ("10604662", "Amazon", "Product Manager Technical (PMT) - 2027",
       "https://www.amazon.jobs/en/jobs/10604662/product-manager-technical-pmt-2027", "Vancouver, British Columbia, CAN",
       "2026-11-13T00:00:00.000Z"))
check("empty boards parse to nothing",
      [hunt_ats.parse_ashby({}, "x"), hunt_ats.parse_greenhouse(None, "x"), hunt_ats.parse_lever({"ok": False}, "x"),
       hunt_ats.parse_recruitee({}, "x"), hunt_ats.parse_workable({}, "x"), hunt_ats.parse_amazon({})], [[]] * 6)
r = hunt_ats.parse_ashby({"jobs": [{"id": "a", "title": "Head of Product"}]}, "x")[0]
check("ashby with missing fields", (r["loc"], r["comp"], r["postedAt"], r["text"]), ("", None, None, ""))

# --- scan_company: statuses, caps, detail step only for kept titles ---
real = dict(hunt_ats.BOARDS)
calls = []


def fake(pages, detail=None):
    def lister(slug, extra, ctx):
        if isinstance(pages, Exception):
            raise pages
        return pages
    return lister, detail


keep = lambda t: hunt_core.keep_title(t)
mk = lambda i, t: hunt_core.role("fake", i, "co", t, f"https://x/{i}")
hunt_ats.BOARDS["fake"] = fake(FetchError(500, "Server Error"))
check("board 500 is failed", {k: hunt_ats.scan_company("co", "fake", "", {}, keep)[k] for k in ("status", "reason")},
      {"status": "failed", "reason": "500 Server Error"})
hunt_ats.BOARDS["fake"] = fake(FetchError(404, "Not Found"))
check("board 404 is not found", hunt_ats.scan_company("co", "fake", "", {}, keep)["status"], "notfound")
hunt_ats.BOARDS["fake"] = fake(([], False))
res = hunt_ats.scan_company("co", "fake", "", {}, keep)
check("empty named board is ok with 0 read", (res["status"], res["read"]), ("ok", 0))
many = [mk(i, "Head of Product") for i in range(20)] + [mk(99, "Recruiter")]
hunt_ats.BOARDS["fake"] = fake((many, True), lambda r, s, e: calls.append(r["sourceJobId"]))
res = hunt_ats.scan_company("co", "fake", "", {}, keep)
check("caps reported and details limited", (res["read"], len(res["roles"]), res["capped"], res["details_capped"], len(calls)),
      (21, 20, True, True, 15))
check("unknown board type", hunt_ats.scan_company("co", "nope", "", {}, keep)["status"], "failed")
hunt_ats.BOARDS["fake"] = fake(KeyError("title"))
res = hunt_ats.scan_company("co", "fake", "", {}, keep)
check("a board that answers in an unexpected shape is failed, not a crash", (res["status"], res["reason"]),
      ("failed", "unexpected answer (KeyError: 'title')"))
for n in hunt_ats.GUESS:
    hunt_ats.BOARDS[n] = fake(FetchError(429, "Too Many Requests"))
check("guessing: boards that all answer 429 are failed, not NOT FOUND", hunt_ats.scan_company("co", None, "", {}, keep)["status"], "failed")
for n in hunt_ats.GUESS:
    hunt_ats.BOARDS[n] = fake(FetchError(404, "Not Found"))
check("guessing: boards that all answer 404 are NOT FOUND", hunt_ats.scan_company("co", None, "", {}, keep)["status"], "notfound")
real_fetch_json = hunt_ats.fetch_json
page = lambda n: {"total": 45, "jobPostings": [{"title": "Head of Product", "externalPath": f"/job/x_{n}_{i}"} for i in range(19)] + [{"title": "no path"}]}
asked = []
hunt_ats.fetch_json = lambda url, body=None, headers=None: (asked.append(body["offset"]), page(body["offset"]))[1]
got, capped = hunt_ats.workday_pages("https://h", "co", "site", {})
check("workday: a posting with no path does not end paging early", (asked, len(got), capped), ([0, 20, 40], 57, False))
hunt_ats.fetch_json = real_fetch_json
hunt_ats.BOARDS.clear(); hunt_ats.BOARDS.update(real)

# --- feed parsers ---
ctx = dict(home_code="CA", home_name="Canada", home_re=re.compile("canada|toronto|vancouver", re.I))
h = hunt_feeds.parse_himalayas(load("himalayas.json"))
check("himalayas first role", (h[0]["sourceJobId"], h[0]["company"], h[0]["loc"], h[0]["comp"], h[0]["via"]),
      ("defuse-labs/jobs/head-of-product-marketing-growth", "Defuse Labs", "Remote: Worldwide", None, ["himalayas"]))
check("himalayas pay and countries", (h[1]["loc"], h[1]["comp"]), ("Remote: Canada, United States", "USD 250000-300000"))
g, total = hunt_feeds.parse_getro(load("getro_page.json"), "communitech")
check("getro roles", [(x["company"], x["title"], x["remote"]) for x in g],
      [("Charitable Impact", "Head of Product", False), ("Geotab", "Head of Domain, Product & Engineering", True),
       ("Joist", "Head of Product, Invoice Simple", True), ("Remote", "Head of Product Led Growth", False)])
check("getro pay in dollars, total", (g[2]["comp"], total), ("CAD 240000-270000", 12))
check("getro locations skip parent regions", "North America" in g[0]["loc"], False)

pages = iter([load("getro_page.json")] * 3)
real_fetch, real_next = hunt_feeds.fetch, hunt_feeds.next_data
hunt_feeds.fetch, hunt_feeds.next_data = (lambda url: "page"), (lambda page: next(pages))
slept = []
results, errors = hunt_feeds.getro([("board.example", "communitech")], ctx, sleep=slept.append)
res = results["communitech"]
check("getro: read once per role, repost dropped, pauses between rounds",
      (res["read"], len(res["roles"]), res["dropped"], slept, errors), (4, 3, 1, [10, 10], {}))
hunt_feeds.fetch = lambda url: (_ for _ in ()).throw(FetchError(503, "Unavailable"))
results, errors = hunt_feeds.getro([("board.example", "communitech")], ctx, sleep=slept.append)
check("getro: a failing board is reported", str(errors["communitech"]), "503 Unavailable")
hunt_feeds.fetch, hunt_feeds.next_data = (lambda url: "page"), (lambda page: {"props": {"pageProps": {"initialState": {"jobs": {"found": [{}]}}}}})
results, errors = hunt_feeds.getro([("board.example", "communitech")], ctx, sleep=slept.append)
check("getro: a malformed page is reported, not a crash", str(errors["communitech"]), "200 unexpected page (KeyError)")
hunt_feeds.fetch, hunt_feeds.next_data = real_fetch, real_next

w = hunt_feeds.parse_wellfound(load("wellfound_page.json"))
check("wellfound role has its company", bool(w) and all(x["company"] for x in w) and w[0]["url"].startswith("https://wellfound.com/jobs/"), True)
y = hunt_feeds.parse_yc((FIX / "yc_page.html").read_text())
check("yc roles", (len(y), y[0]["url"].startswith("https://www.ycombinator.com/companies/"), {x["visa"] for x in y} <= {
    "US citizen/visa only", "US citizenship/visa not required", "Will sponsor"}), (3, True, True))
x = hunt_feeds.parse_wwr((FIX / "wwr.xml").read_text())
check("wwr first item", (x[0]["company"], x[0]["title"], x[0]["loc"], x[0]["sourceJobId"], x[0]["postedAt"]),
      ("ProArch", "BA/Technical Product Manager", "USA Only", "proarch-ba-technical-product-manager", "2026-11-09T09:06:54.000Z"))
m = hunt_feeds.parse_mtp(load("mindtheproduct_page.json"))
check("mind the product first role", (m[0]["company"], m[0]["title"], m[0]["loc"], m[0]["comp"], m[0]["postedAt"]),
      ("givestar", "Head of Product – Fundraising Technology", "Remote: London, United Kingdom", "£110,000 - £125,000 GBP",
       "2026-10-26T09:13:08.000Z"))

# --- merge ---
board = hunt_core.role("greenhouse", "5471107008", "geotab", "Head of Domain, Product & Engineering", "https://boards.greenhouse.io/geotab/jobs/5471107008")
feed = hunt_core.resolve_posting(dict(g[1]))
himal = hunt_core.role("himalayas", "geotab/jobs/head-of-domain", "Geotab", "Head of Domain, Product & Engineering", "https://himalayas.app/x",
                       text="from himalayas", feed="himalayas")
out, merged = hunt_core.merge([feed, himal, board])
check("same posting from a feed, a second feed and the board is one row under the board",
      (len(out), out[0]["source"], out[0]["sourceJobId"], out[0]["company"], sorted(out[0]["via"]), out[0]["comp"], out[0]["text"], merged),
      (1, "greenhouse", "5471107008", "geotab", ["communitech", "himalayas"], "USD 170000-220000", "from himalayas",
       {"communitech": 1, "himalayas": 1}))
a = hunt_core.role("ashby", "1", "anthropic", "Product Manager", "https://x/1")
b = hunt_core.role("ashby", "2", "anthropic", "Product Manager", "https://x/2")
check("two same-titled roles on one board both stay", len(hunt_core.merge([a, b])[0]), 2)
check("newest first, undated last", [r["sourceJobId"] for r in hunt_core.newest_first([
    dict(a, postedAt=None), dict(b, postedAt="2026-11-01T00:00:00.000Z"), dict(a, sourceJobId="3", postedAt="2026-11-12T00:00:00.000Z")])],
      ["3", "2", "1"])

# --- scanner: counts per source, seen keys hidden ---
g, _ = hunt_feeds.parse_getro(load("getro_page.json"), "communitech")
board = hunt_core.role("greenhouse", "5471107008", "geotab", "Head of Domain, Product & Engineering", "https://boards.greenhouse.io/geotab/jobs/5471107008")
board["origin"] = "geotab"  # set by scan_boards: the watchlist slug, whatever the board calls the company
roles = [board, g[1], g[2], g[0]]
board["company"] = "Geotab Inc."
dup = hunt_core.role("greenhouse", "5471107008", "geotab", "Head of Domain, Product & Engineering", "https://x")
dup["origin"] = "geotab-copy"
check("merge counts a board duplicate under its own watchlist entry", hunt_core.merge([dict(board), dup])[1], {"geotab-copy": 1})
stats = {"geotab": dict(status="ok", board="greenhouse", read=40, kept=0), "communitech": dict(status="ok", read=4, kept=0, dropped=1)}
shown = scan.finish(roles, stats, {"communitech:" + g[0]["sourceJobId"]}, False, ctx)
check("finish: merged, hidden and kept counts", (len(shown), stats["geotab"]["kept"], stats["communitech"]["kept"],
                                                 stats["communitech"]["merged"], stats["communitech"]["hidden"]), (2, 1, 1, 1, 1))
# The board copy takes the feed's date (Geotab's is the newer of the two), so it sorts first.
check("finish: keys are source:id, newest first", [r["key"] for r in shown], ["greenhouse:5471107008", "communitech:98813918"])
check("status lines", [scan.status_line(n, s) for n, s in [
    ("a", dict(status="notfound")), ("b", dict(status="failed", reason="500 Server Error")),
    ("c", dict(status="ok", board="lever", read=0, kept=0)),
    ("communitech", dict(stats["communitech"], capped=True))]],
      ["== a: NOT FOUND", "== b: FAILED 500 Server Error", "== c: lever 0 read, 0 kept",
       "== communitech: feed 4 read, 1 kept, 1 dropped (other region or repost), 1 merged into another source, 1 hidden as seen, "
       "capped: more results exist than were read"])
check("args", scan.parse_args(["--profile", "p", "--all", "--mark-seen", "a:1", "b:2"]),
      dict(profile="p", all=True, only=None, mark=["a:1", "b:2"], entries=[]))

failed = [c for c in checks if not c[1]]
for name, _, got, want in failed:
    print(f"FAIL {name}\n   got  {got!r}\n   want {want!r}")
print(f"hunt scanner: {len(checks) - len(failed)}/{len(checks)} checks pass")
sys.exit(1 if failed else 0)
