"""Offline checks for the hunt scanner (pnpm check:hunt). Fixtures are trimmed real responses; no network."""
import io, json, re, sys
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import hunt_ats, hunt_core, hunt_feeds, post_job, scan
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
for title in ["Member of Product Staff, Agents", "Senior Product Manager, Agents", "Staff Product Manager",
              "Principal Product Manager, Platform", "Group Product Manager"]:
    check(f"keep_title board {title!r}", hunt_core.keep_title(title, board=True), True)
    check(f"keep_title feed {title!r}", hunt_core.keep_title(title), False)
for title in ["Product Manager, Billing", "Associate Product Manager", "Senior Product Designer", "Senior Product Marketing Manager"]:
    check(f"keep_title board {title!r}", hunt_core.keep_title(title, board=True), False)

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
for text, want in [("open to hiring around the world for the right candidate", True), ("Remote: work from anywhere", True),
                   ("candidates based anywhere in North America or Europe", True), ("We hire globally", True),
                   ("our team is distributed worldwide", True), ("Trusted by teams worldwide", False), ("", False),
                   ("shipping globally since 2010", False), ("Remote (US only)", False), ("Remote, anywhere in the United States", False),
                   ("work from anywhere in the US", False)]:
    check(f"open_world {text!r}", hunt_core.open_world(text), want)
world = hunt_core.role("ashby", "ba48", "runway-ml", "Member of Product Staff, Agents", "https://jobs.ashbyhq.com/runway-ml/ba48",
                       loc="Remote; New York, NY; San Francisco, CA",
                       text="Preferable to have someone near an office in NYC or San Francisco, but open to hiring around the world for the right candidate.")
world["origin"] = "runway-ml"
w = scan.finish([world], {"runway-ml": dict(status="ok", board="ashby", read=1, kept=0)}, set(), False, ctx)[0]
check("finish: openWorld set, homeMention not", (w["openWorld"], w["homeMention"]), (True, False))
check("role line marks world", " | world | " in scan.role_line(w), True)
# Senior IC titles only on ic boards and dream companies; the filter scan_boards hands each board decides.
filters = {}
real_scan_company = scan.scan_company
def remember_filter(slug, board, extra, ctx, keep):
    filters[slug] = keep
    return dict(status="ok", board=board, read=0, roles=[])
scan.scan_company = remember_filter
try:
    scan.scan_boards(["stripe:greenhouse", "runway-ml:ashby"], ["openai:ashby"], ctx, ic={"runway-ml"})
finally:
    scan.scan_company = real_scan_company
check("scan_boards: IC titles by board", {s: f("Staff Product Manager") for s, f in filters.items()},
      {"stripe": False, "runway-ml": True, "openai": True})
slugs = lambda name: {e.split(":")[0] for e in scan.lines(name)}
check("no company in both watchlist files", sorted(slugs("watchlist.txt") & slugs("watchlist-ai.txt")), [])
check("status lines", [scan.status_line(n, s) for n, s in [
    ("a", dict(status="notfound")), ("b", dict(status="failed", reason="500 Server Error")),
    ("c", dict(status="ok", board="lever", read=0, kept=0)),
    ("communitech", dict(stats["communitech"], capped=True))]],
      ["== a: NOT FOUND", "== b: FAILED 500 Server Error", "== c: lever 0 read, 0 kept",
       "== communitech: feed 4 read, 1 kept, 1 dropped (other region or repost), 1 merged into another source, 1 hidden as seen, "
       "capped: more results exist than were read"])
check("args", scan.parse_args(["--profile", "p", "--all", "--mark-seen", "a:1", "b:2"]),
      dict(profile="p", all=True, only=None, mark=["a:1", "b:2"], entries=[]))

# --- postings as light Markdown ---
md = hunt_core.html_to_md
check("md: headings, paragraphs, nested lists",
      md("<h2>About</h2><p>We build &amp; ship.</p><ul><li>One</li><li>Two<ul><li>Nested</li></ul></li></ul>"),
      "## About\n\nWe build & ship.\n\n- One\n- Two\n  - Nested")
check("md: a heading in a div, a bold-only paragraph, entities",
      md("<div><h3>Role</h3></div><p><strong>What you&rsquo;ll do:</strong></p><p>Lead&nbsp;things &mdash; well.</p>"),
      "## Role\n\n## What you\u2019ll do\n\nLead things \u2014 well.")
check("md: bold inside a sentence is not a heading", md("<p><strong>Note:</strong> apply soon</p>"), "Note: apply soon")
check("md: a paragraph inside a list item keeps its bullet",
      md("<ul><li><p>Para item</p></li><li>Plain item</li></ul><p>After</p>"), "- Para item\n- Plain item\n\nAfter")
check("md: an empty list item or heading leaves no mark on the next line",
      [md("<ul><li></li></ul><p>Text</p>"), md("<h2></h2><p>Text</p>")], ["Text", "Text"])
check("md: bullets typed as text become bullets", md("- Are 18 or older<br/>- Has an MBA<br/>\u2022 Third"),
      "- Are 18 or older\n- Has an MBA\n- Third")
check("md: text that looks like markup stays text",
      md("<p>C# and 5* hotels, snake_case, $209,040\u2014$296,140</p><p># not a heading</p><p>> not a quote</p><p>-5% is not a bullet</p>"),
      "C# and 5\\* hotels, snake_case, $209,040\u2014$296,140\n\n\\# not a heading\n\n\\> not a quote\n\n-5% is not a bullet")
check("md: the posting's own asterisks, brackets, backticks and word-edge underscores are text",
      md("<p>5+ years * strong SQL, [internal] `code`, _private and __init__, foo_bar_baz</p><p>+ plus line</p><p>* typed bullet</p>"),
      "5+ years \\* strong SQL, \\[internal\\] \\`code\\`, \\_private and \\_\\_init\\_\\_, foo_bar_baz\n\n\\+ plus line\n\n- typed bullet")
check("md: a link label with a bracket and an address with parentheses stay one link",
      md('<p><a href="https://example.com/a_(b)?x=1 2">Role [remote]</a></p>'), "[Role \\[remote\\]](https://example.com/a_%28b%29?x=1%202)")
check("md: line breaks, scripts and styles", md("<style>x{}</style><p>Line one<br>Line two</p><script>hide()</script>"),
      "Line one\n\nLine two")
check("md: links keep their address",
      md('<p>Read <a href="https://example.com/culture">our culture post</a> and <a href="https://example.com">https://example.com</a>, '
         'or <a href="#top">go up</a>.</p>'),
      "Read [our culture post](https://example.com/culture) and https://example.com, or go up.")
check("md: no tags, and nothing", [md("Just text"), md(""), md(None)], ["Just text", "", ""])
check("md: cut at Fenix's limit", len(md("<p>" + "x" * 70_000 + "</p>")), 60_000)
r = hunt_ats.parse_greenhouse({"jobs": [{"id": 1, "title": "Head of Product",
                                         "content": "&lt;h2&gt;The role&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Own it&lt;/li&gt;&lt;/ul&gt;"}]}, "x")[0]
check("a listed role is not converted until it is kept", (r["jd"], r["jdFormat"], "jd_html" in r), ("", None, True))
hunt_core.fill_jd(r)
check("a kept role carries no leftover HTML", "jd_html" in r, False)
check("greenhouse: once-escaped HTML", (r["jd"], r["jdFormat"], r["text"]), ("## The role\n\n- Own it", "md", "The role Own it"))
r = hunt_ats.parse_ashby({"jobs": [{"id": "a", "title": "Head of Product", "descriptionPlain": "ROLE\n\n - Own it",
                                    "descriptionHtml": "<h1>Role</h1><ul><li>Own it</li></ul>"}]}, "x")[0]
hunt_core.fill_jd(r)
check("ashby: HTML description", (r["jd"], r["jdFormat"], r["text"]), ("## Role\n\n- Own it", "md", "ROLE\n\n - Own it"))
r = hunt_ats.parse_ashby({"jobs": [{"id": "a", "title": "Head of Product", "descriptionPlain": "ROLE\n\n - Own it"}]}, "x")[0]
hunt_core.fill_jd(r)
check("ashby: plain text only is saved as plain text", (r["jd"], r["jdFormat"]), ("ROLE\n\n - Own it", None))
r = hunt_core.fill_jd(hunt_ats.parse_ashby({"jobs": [{"id": "a", "title": "Head of Product", "descriptionPlain": "ROLE\n\n - Own it",
                                                      "descriptionHtml": "<div> <br> </div>"}]}, "x")[0])
check("ashby: HTML that gives nothing falls back to plain text, not Markdown", (r["jd"], r["jdFormat"]), ("ROLE\n\n - Own it", None))
r = hunt_ats.parse_lever([{"id": "l", "text": "VP Product", "descriptionPlain": "We are hiring.\nJoin us.",
                           "lists": [{"text": "You will", "content": "<li>Lead</li><li>Ship</li>"}], "additional": "<div>Equal opportunity.</div>"}], "x")[0]
hunt_core.fill_jd(r)
check("lever: description, titled lists, closing text",
      r["jd"], "We are hiring.\n\nJoin us.\n\n## You will\n\n- Lead\n- Ship\n\nEqual opportunity.")
r = hunt_core.fill_jd(hunt_ats.parse_lever([{"id": "l", "text": "VP Product", "descriptionPlain": "We are hiring.", "lists": None}], "x")[0])
check("lever: a posting with no lists still parses", (r["jd"], r["text"].strip()), ("We are hiring.", "We are hiring."))
r = hunt_core.fill_jd(hunt_ats.parse_recruitee(load("recruitee.json"), "bunq")[0])
check("recruitee: requirements get a heading and bullets",
      (r["jdFormat"], "\n\n## Requirements\n\n- " in r["jd"], "<" in r["jd"]), ("md", True, False))
r = hunt_core.fill_jd(hunt_ats.parse_amazon(load("amazon.json"))[0])
check("amazon: three titled parts with bullets",
      (r["jd"].startswith("## Description\n\n"), "\n\n## Basic qualifications\n\n- " in r["jd"], "\n\n## Preferred qualifications\n\n- " in r["jd"]),
      (True, True, True))
a, b = hunt_core.role("ashby", "1", "x", "VP Product", "u"), hunt_core.role("himalayas", "9", "x", "VP Product", "u", feed="himalayas", jd="## Feed copy")
check("role: no posting, no format", (a["jd"], a["jdFormat"]), ("", None))
merged, _ = hunt_core.merge([a, b])
check("merge carries the posting and its format", (len(merged), merged[0]["jd"], merged[0]["jdFormat"]), (1, "## Feed copy", "md"))

# --- detail boards: the posting as Markdown from the detail answer, and one role fetched on its own ---
real_fetch = hunt_ats.fetch_json


def detailed(board, answer, extra=None):
    hunt_ats.fetch_json = lambda *a, **k: answer
    try:
        r = hunt_core.role(board, "1", "co", "Head of Product", "u")
        r["path"] = "/job/x"
        hunt_ats.BOARDS[board][1](r, "co", extra)
        return r
    finally:
        hunt_ats.fetch_json = real_fetch


r = detailed("workable", load("workable_detail.json"))
check("workable detail: requirements and benefits get headings",
      (r["jdFormat"], [l for l in r["jd"].split("\n") if l.startswith("## ")][:2], "<" in r["jd"]),
      ("md", ["## Requirements", "## Benefits"], False))
r = detailed("smartrecruiters", load("smartrecruiters_detail.json"))
check("smartrecruiters detail: each section is titled",
      (r["jdFormat"], r["jd"].startswith("## Company Description\n\n"), "\n\n## Job Description\n\n" in r["jd"], "\n\n## Qualifications\n\n" in r["jd"]),
      ("md", True, True, True))
r = detailed("workday", load("workday_detail.json"), "wd5/Site")
check("workday detail", (r["jdFormat"], r["jd"].startswith("Ready to drive transformation in AI models?"), "<" in r["jd"]), ("md", True, False))
r = detailed("rippling", load("rippling_detail.json"))
check("rippling detail: a description cut inside a tag gives no posting rather than tag source", (r["jd"], r["jdFormat"]), ("", None))
r = detailed("rippling", {"description": {"company": "<div><h2>About</h2><p>We ship.</p></div>", "role": "<ul><li>Lead</li></ul>"}})
check("rippling detail: company and role parts", (r["jd"], r["jdFormat"]), ("## About\n\nWe ship.\n\n- Lead", "md"))

calls = []
hunt_ats.fetch_json = lambda url, *a, **k: calls.append(url) or {"description": "<p>Whole posting</p>"}
try:
    late = hunt_core.role("workable", "abc", "co", "Head of Product", "u")
    late["board"] = ["workable", "co", None]
    hunt_ats.fetch_detail(late)
    check("fetch_detail: one request fills a role the cap left empty", (late["jd"], late["jdFormat"], len(calls)), ("Whole posting", "md", 1))
    try:
        hunt_ats.fetch_detail(hunt_core.role("ashby", "1", "co", "Head of Product", "u"))
        check("fetch_detail: a list-call board has nothing to fetch", "no error", "FetchError")
    except FetchError as e:
        check("fetch_detail: a list-call board has nothing to fetch", "carry their description already" in str(e), True)
finally:
    hunt_ats.fetch_json = real_fetch


def failing(*a, **k):
    raise FetchError(503, "busy")


wd = hunt_core.role("workday", "JR9", "co", "Director, Product", "u")
wd["path"] = "/job/JR9"
hunt_ats.fetch_json = failing
try:
    hunt_ats.workday_detail(wd, "co", "wd5/Site")
except FetchError:
    pass
finally:
    hunt_ats.fetch_json = real_fetch
check("workday detail: a failed request keeps the path for a retry", wd.get("path"), "/job/JR9")

# --- post_job: the body sent to Fenix ---
scanned = hunt_core.role("ashby", "6f1c2a3b-0000-4000-8000-000000000001", "acme", "Head of Product", "https://jobs.ashbyhq.com/acme/6f1c",
                         "Remote - Canada", True, "$250K", "2026-11-12T15:04:05.000Z", "flat text", jd="## The role\n\n- Own it")
judged = {"company": "Acme", "compMin": 250000, "compMax": 300000, "currency": "USD", "compSource": "company_site",
          "remoteVerdict": "country_ok", "fitScore": 80, "whyGood": "Level: head of product", "jdSummary": "Owns: the roadmap"}
check("post_job: facts from the scan, judgment from the session", post_job.build_body(dict(scanned), judged),
      {"source": "ashby", "sourceJobId": "6f1c2a3b-0000-4000-8000-000000000001", "url": "https://jobs.ashbyhq.com/acme/6f1c",
       "company": "Acme", "title": "Head of Product", "jdText": "## The role\n\n- Own it", "jdFormat": "md",
       "locationText": "Remote - Canada", "postedAt": "2026-11-12T15:04:05.000Z", "postedAtSource": "board",
       "compMin": 250000, "compMax": 300000, "currency": "USD", "compSource": "company_site", "remoteVerdict": "country_ok",
       "fitScore": 80, "whyGood": "Level: head of product", "jdSummary": "Owns: the roadmap"})


def refusal(role, fields=judged, detail=None):
    try:
        post_job.build_body(role, fields, detail) if detail else post_job.build_body(role, fields)
        return "saved"
    except post_job.Refused as e:
        return str(e)


check("post_job: a feed role is refused", refusal(hunt_core.role("himalayas", "9", "x", "VP Product", "u", jd="text")).startswith("himalayas is a feed, not"), True)
check("post_job: no description is refused", "whole text or nothing" in refusal(hunt_core.role("ashby", "1", "x", "VP Product", "u")), True)
check("post_job: an excerpt is refused", "is an excerpt" in refusal(hunt_core.role("ashby", "1", "x", "VP Product", "u", jd="(Excerpt.) Some of it")), True)
check("post_job: missing judgment fields are named", refusal(dict(scanned), {"company": "Acme"}), "--json is missing compSource, remoteVerdict")
check("post_job: the display name must come from the session, not the board's slug",
      refusal(dict(scanned), {"compSource": "unknown", "remoteVerdict": "unclear"}), "--json is missing company")
late = hunt_core.role("workday", "JR1", "nvidia", "Director, Product", "u")
late["board"] = ["workday", "nvidia", "wd5/Site"]
body = post_job.build_body(late, judged, lambda r: r.update(jd="Fetched posting", jdFormat="md"))
check("post_job: a role past the detail cap has its description fetched", (body["jdText"], body["jdFormat"]), ("Fetched posting", "md"))
amz = hunt_core.role("amazon", "3112233", "Amazon", "Principal PM", "https://www.amazon.jobs/en/jobs/3112233", jd="## Description")
check("post_job: Amazon is saved under the company's site", post_job.build_body(amz, judged)["source"], "company_site")
try:
    post_job.find_role("ashby:nope", ["no-such-file.json"])
    check("post_job: a key the file does not have", "found", "Refused")
except post_job.Refused as e:
    check("post_job: a scan file that does not exist is named", "no scan file to read: no-such-file.json not found" in str(e), True)
import tempfile
with tempfile.TemporaryDirectory() as tmp:
    scan_file = Path(tmp) / "scan.json"
    scan_file.write_text(json.dumps([scanned]))
    check("post_job: a role is found by its key", post_job.find_role("ashby:6f1c2a3b-0000-4000-8000-000000000001", ["no-such-file.json", str(scan_file)])["title"], "Head of Product")
    try:
        post_job.find_role("ashby:nope", [str(scan_file)])
        check("post_job: a key the file does not have", "found", "Refused")
    except post_job.Refused as e:
        check("post_job: a key the file does not have", ("ashby:nope is not in" in str(e), "boards.py" in str(e)), (True, True))

# --- plain text with line breaks as light Markdown ---
pm = hunt_core.plain_to_md
check("plain: titles, paragraphs and typed bullets",
      pm("About the role\nYou will lead growth. It is a big job.\n\nWhat you'll do:\n- Own the roadmap\n• Coach the team\n\nApply by Friday."),
      "## About the role\n\nYou will lead growth. It is a big job.\n\n## What you'll do\n\n- Own the roadmap\n- Coach the team\n\nApply by Friday.")
check("plain: a short last line, a sentence and a pay line are not titles",
      pm("We are hiring.\n$200k-$250k base\nremote in Canada\nThanks"), "We are hiring.\n\n$200k-$250k base\n\nremote in Canada\n\nThanks")
check("plain: the posting's own markup characters stay text", pm("Stack\nWe use C# and *nix, with [internal] tools.\n# of reports: 5"),
      "## Stack\n\nWe use C# and \\*nix, with \\[internal\\] tools.\n\n\\# of reports: 5")
check("plain: 'Label: value' lines and lines with numbers are not titles",
      pm("Company: Solen Software Group\nHiring Maximum: $294100\nJob Requisition ID # 26WD101063\nResponsibilities:\nLead the team."),
      "Company: Solen Software Group\n\nHiring Maximum: $294100\n\nJob Requisition ID # 26WD101063\n\n## Responsibilities\n\nLead the team.")
check("plain: a title followed by short unmarked lines is a title and its list",
      pm("Benefits\nRemote friendly\nFlexible hours\nGreat team\nWe look forward to hearing from you."),
      "## Benefits\n\n- Remote friendly\n- Flexible hours\n- Great team\n\nWe look forward to hearing from you.")
check("plain: two titles in a row stay titles", pm("Key Responsibilities\nPortfolio Operating Model\nOperate the portfolio against its targets."),
      "## Key Responsibilities\n\n## Portfolio Operating Model\n\nOperate the portfolio against its targets.")
check("plain: one line, and nothing", [pm("Just one line of text."), pm(""), pm(None)], ["Just one line of text.", "", ""])
letters = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
sample = "About us\nWe build things & ship <fast>.\nWhat you'll do\n- One\n- Two: three\nNotes\nLast line here."
check("plain: no letter or digit is added or lost", letters(pm(sample)), letters(sample))

failed = [c for c in checks if not c[1]]
for name, _, got, want in failed:
    print(f"FAIL {name}\n   got  {got!r}\n   want {want!r}")
print(f"hunt scanner: {len(checks) - len(failed)}/{len(checks)} checks pass")
sys.exit(1 if failed else 0)
