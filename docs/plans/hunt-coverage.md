# Hunt coverage

## Spec

*Status: approved 2026-11-13* (Mauricio asked for higher limits, the startup boards and top job sites, and "we're hiring" post searches on LinkedIn and X, then approved this spec in chat and asked for plan and build.)

**Problem / motivation.** Mauricio needs a job and the hunt reads too little, from too few places.

- **Depth.** A run opens at most 40 postings across all sources, and the closed-posting check uses up to 15 of them. He has 8 saved LinkedIn queries and the limit is 6 searches, so the last two never run.
- **Sources.** The hunt reads LinkedIn jobs, Lenny's Jobs, two remote boards and 62 company boards on Ashby, Greenhouse or Lever. It reads no startup board, no venture-fund portfolio board, no Canadian tech board, and no company whose board runs on Workday, Workable, SmartRecruiters, Recruitee or Rippling.
- **Companies he most wants.** Amazon, Google, Meta and Nvidia are checked only because a memory note says so. The board scan keeps titles with Director, Head, VP or Lead, so "Product Manager, X" roles at Anthropic, OpenAI, Vercel, Supabase, xAI and Cursor are dropped unless the same memory note is followed.
- **Speed.** Founders and hiring managers post "we're hiring" on LinkedIn and X with a link to the job, often before the role shows up in LinkedIn job search. The hunt never looks at posts.

**Relation to `posting-recency.md`.** That spec (awaiting approval) owns the posting date on each job, the freshness labels, the stale rule, and the past-24-hours LinkedIn pass. This spec owns which sources are read and how much is read per run. It settles that spec's open question 4 (run limits) and today's browser tests answer its open questions 1 to 3 (see External verification). The two can be built in either order; if both are approved, build posting-recency first so every new source saves a posting date from day one.

**Scope.**

In:

1. **One scanner for everything a script can read.** `boards.py` grows from "company boards" into the scanner for every source that needs no browser. It prints one list of candidate roles, newest first, each with company, title, location, pay as posted, posting date, the link to the company's own posting where the source gives one, and which source found it. Full descriptions go in the JSON. Sources:

   | Source | What it adds | How it is read |
   |---|---|---|
   | Company boards on Ashby, Greenhouse, Lever | Today's watchlist | Public APIs (as now) |
   | Company boards on Workday, Workable, SmartRecruiters, Recruitee, Rippling | Companies the watchlist cannot hold today (Nvidia, CrowdStrike and others) | Public APIs, one watchlist line per company |
   | Himalayas | Remote roles with a country list, seniority and posted pay | Public search API, country Canada, Director and Executive levels |
   | Communitech Work in Tech | Canadian tech companies | Data embedded in the board's public pages |
   | Venture-fund portfolio boards: Khosla, Accel, General Catalyst, Georgian, Radical | Startups by fund, with links to the company's own posting | Same page data as Communitech, one board address per fund |
   | Y Combinator jobs | YC startups | Data embedded in the page |
   | We Work Remotely | Remote product roles | RSS feed |
   | Mind the Product jobs | Senior product roles | Page HTML |
   | Wellfound | Startups | Data embedded in the role pages (kept only if the plan's field check passes) |
   | Amazon | His target company | Public search API, Canada |

2. **Dream companies get their whole board read.** A new per-person setting, `dreamCompanies` (board slugs), makes the scanner keep every product and growth title at those companies, at any level, not only Director and up. For him: Vercel, Supabase, Anthropic, OpenAI, xAI, Cursor, plus Nvidia and Amazon through the new readers. The hunt reports these roles even when fit is middling (his rule, 2026-11-09).

3. **Google and Meta as a written browser step.** Two page loads per run (Google careers and Meta careers, product roles in Canada), written into the skill so they no longer depend on a memory note. SpaceX stays as it is: only a role that does not require US-person status is surfaced.

4. **"We're hiring" posts on LinkedIn and X**, read in his signed-in Chrome after the right-person check.
   - LinkedIn posts search, past 24 hours, newest first. X search, Latest tab.
   - Queries pair a hiring phrase ("we're hiring", "hiring a", "looking for a", "join our team") with his target titles (head of product, VP product, director of product, head of growth, product growth, AI transformation, head of AI).
   - Limits: 4 LinkedIn post searches and 4 X searches per run, about 30 posts read per search.
   - A post counts when it names a role that fits and comes from the company or someone who works there. The hunt follows the link to the company's own posting and saves the job from there, with the post's link kept as where it was found. A post with no posting behind it (for example "DM me") is listed in the report for him and nothing is saved.
   - Read only: never like, reply, repost, follow, connect or message. Stop on a captcha, a restriction notice or a sign-in wall, as for LinkedIn jobs.

5. **Browser boards.** startup.jobs and hiring.cafe block scripts. The plan tests each once in Chrome; one that loads without a challenge and lets the list be filtered to senior product roles gets one pass per run. One that does not is left out and noted in `docs/learnings/job-boards.md`.

6. **New limits per full run.**

   | Limit | Today | New |
   |---|---|---|
   | LinkedIn job searches | 6 | every saved query (8 today), plus the past-24-hours pass from posting-recency |
   | Result cards read per LinkedIn search | 50 | 100 (4 pages of 25) |
   | Postings opened in the browser, all sources | 40 | 100 |
   | Company-site visits | 15 | 30 |
   | LinkedIn closed-posting checks | 15, inside the 40 | 15, counted separately |
   | Post searches | 0 | 4 LinkedIn, 4 X |
   | Roles read from the scanner's JSON | counted in the 40 | no limit (no page loads) |

   The human pace, the single LinkedIn tab and the stop rules do not change. Cards are triaged on title, company, location, pay and age before a posting is opened, newest first, so the 100 opens go to fresh, plausible roles.

7. **A second, short run: the fresh pass.** "Run a fresh pass" does only the parts that find new postings fast: the scanner, the LinkedIn past-24-hours pass and the post searches, with at most 30 postings opened. It is meant to be run daily between full hunts; a full hunt stays the weekly-depth run. It is started by him, not scheduled.

8. **Remembering what was already judged.** Roles from aggregators (Himalayas, the fund boards, YC, We Work Remotely) are saved under the company's own posting, so the aggregator's id is not in the pipeline. The scanner keeps a per-person list of aggregator ids it has already shown, so a later run prints only new ones.

9. **Report.** Counts per source, including each new one, and for each new job which source found it first. A source that returned nothing or failed is named, so a broken reader is seen the same day.

10. **Docs.** `SKILL.md`, `hunt-profile.md` (the Canada-specific values for the new sources), `docs/learnings/` (what today's tests found), `docs/architecture.md` (one line on the scanner).

Out:

- Indeed, Glassdoor, Google's job search, Levels.fyi, TrueUp, Jobright, Simplify, ExecThread, FlexJobs, Remote OK, Remotive, Working Nomads, Hacker News "Who is hiring". Each was tested on 2026-11-13 and either blocks scripts, needs a login, or returned no senior product roles (see Research notes).
- The fund boards that show a captcha to scripts (a16z, Sequoia, Bessemer, Lightspeed, Kleiner Perkins, First Round). Their companies are better covered by adding them to the watchlist.
- Jobgether and Ladders as sources (they hide the hiring company; `docs/learnings/job-boards.md`).
- Scheduling hunts or fresh passes to run on their own.
- Any change to pay, remote or fit rules, to stages, or to the CV drafting step.
- Applying, messaging or replying to anyone. The hunt stays read-only.
- Posting dates, freshness labels and the stale rule (in `posting-recency.md`).

**Success criteria.**

1. `python3 .claude/skills/fenix-hunt/boards.py` (with his `FENIX_HOME_MATCH`) finishes without a browser and prints a section per source in the table above, each with a count of roles read and roles kept. A source that fails prints `FAILED <reason>` and the run continues.
2. Each kept role in the JSON has company, title, location, source, an id, a posting URL, and a posting date where the source provides one. Roles from Himalayas, the fund boards and Communitech carry posted pay when the source has it.
3. One watchlist line for each of Workday, Workable, SmartRecruiters, Recruitee and Rippling returns that company's roles (checked on Nvidia for Workday and one real company for each of the others).
4. With `dreamCompanies` set, the scanner prints a "Product Manager, …" role from Anthropic or OpenAI that the Director-and-up filter drops today. Without the setting the output for those boards is unchanged.
5. A second scanner run straight after the first prints no aggregator role it already showed.
6. The same role found by two sources (for example Himalayas and the company's Greenhouse board) is printed once, under the company's own posting.
7. A full hunt runs all 8 saved LinkedIn queries, reads up to 100 cards per search, and its report states how many postings were opened out of 100. (Observed in a real run.)
8. A full hunt runs 4 LinkedIn post searches and 4 X searches, and the report lists each hiring post that led to a saved job, with the post link and the job link, and each fitting post with no posting behind it. No like, reply, follow or message is sent. (Observed in a real run.)
9. Google and Meta each appear in the report with a count, even when it is zero.
10. "Run a fresh pass" finishes with at most 30 postings opened and reports new jobs newest first.
11. A job saved from a new source passes `POST /api/p/<p>/jobs` and shows on the board; `pnpm check:jobs`, `pnpm check:data`, `pnpm check:store`, `pnpm lint` and `pnpm exec tsc --noEmit` pass.
12. `SKILL.md` no longer needs the target-companies memory note to reach Amazon, Google, Meta, Nvidia or the dream companies' full boards.

**Approach.** Put every source a script can read into the scanner, and spend the browser only where a signed-in session is needed (LinkedIn jobs, LinkedIn posts, X, Lenny's Jobs, Google, Meta, and whichever of startup.jobs and hiring.cafe pass the test). Recommended because script sources cost no page loads, so coverage can grow about tenfold without more LinkedIn traffic, and because one deduped, newest-first list is quicker to judge than ten separate ones.

Rejected:
- *Read every new source in the browser.* Each board is a page load and a click-through per role; a run would take hours and the 100-open limit would go on aggregator pages instead of postings.
- *Write the new sources into the skill as instructions only (curl each API by hand every run).* No code to maintain, but each run re-derives the requests, spends its context on raw JSON, and has no memory of what it already judged.
- *Raise the limits and add no sources.* Fixes depth on LinkedIn only; the roles LinkedIn buries or never lists stay unseen.

Judgment calls made on his behalf:
- 100 opened postings and 100 cards per search (he said "at least 100" and "let's expand"). More LinkedIn page loads per run raises the chance of an "unusual activity" check; the stop rule stays.
- The fresh pass is added although he did not ask for it by name, because a speed edge from posts only exists if posts are checked more often than a full hunt is run.
- Dream companies become a setting instead of a memory note, so the scanner can use the list.
- Post searches are capped at 4 per site. Today's tests found about 1 real opening in 6 LinkedIn posts and 2 or 3 in 6 X posts, so the yield is low and the value is speed.
- Sources that tested badly are left out instead of being added "for coverage".
- A hiring post with no job posting behind it is reported, not saved, because the pipeline's evidence rules need a posting.

**Open questions.**

1. **Search-engine discovery: left out for now.** Exa and Tavily searches limited to Ashby, Greenhouse and Lever pages found roles at companies not on the watchlist (Netbrain VP of Product, Great Question Head of Product, Klarify Head of Product, all open to Canada). The hunt's rule is "no paid API calls" and there is no measured price for these searches on his plan, so they are not built. He can add them with a yes to the cost.
2. **X account risk: accepted.** X's terms restrict automated reading. This is his own signed-in session at human pace, 4 searches a run, read only, the same kind of use as the LinkedIn search, and he asked for it. The stop rule applies on any restriction notice.
3. **Where the already-judged list lives.** Proposed: a file under `data/<p>/` written through `lib/store`, so it is backed up with his data. The plan decides the exact shape.
4. **Where the post link is stored.** The job schema has no "found via" field. Proposed: add an optional one; the alternative is to keep it in the report only.
5. **Fund-board endpoint.** The Communitech and fund-board reader uses the endpoint the board's own pages call, not the vendor's documented keyed API. The plan keeps it to a few requests per run and falls back to the data embedded in the board pages if the endpoint stops answering.
6. **Wellfound, Georgian, Radical.** Each loaded once but was not fully checked (fields, Canada filter, ids). The plan tests them first and drops any that fail.

### External verification (2026-11-13)

Tested in Mauricio's signed-in Chrome:

- LinkedIn posts search takes the date filter and the sort in the URL: `/search/results/content/?keywords=<q>&datePosted="past-24h"&sortBy="date_posted"`. Six posts loaded before scrolling, aged 2 minutes to 2 hours; one was a real opening.
- X search works from a URL on the Latest tab: `x.com/search?q=<q>&f=live`. He is signed in. Six posts in the last day for one query; two or three were real openings.
- LinkedIn jobs: `f_TPR=r86400` (past 24 hours) works on `/jobs/search-results/` (36 results for head or VP of product in Canada). The page shows 25 cards with "Page 1", "Page 2" and "Next" controls, and each card shows the posting age.
- LinkedIn jobs: `sortBy=DD` is dropped from the URL and the cards are not in date order. Newest-first sorting is not available; the past-24-hours pass is the substitute.

Claims about the script-readable sources, each sent to an agent told to refute it by re-running the request:

- **Himalayas: sound, with corrections.** No key needed; 20 per page. `country=CA` keeps roles that list Canada plus roles open worldwide (769 results without it, 49 with it). `seniority` takes `Director` and `Executive`. `applicationLink` is a Himalayas page, not the company's posting, so the company's own posting still has to be found. Its API terms ask for a visible link back and forbid republishing; reading for one person's own search does neither.
- **Getro (Communitech and the fund boards): works, but not through the API host.** The search endpoint answers without a key (it needs an `Accept: application/json` header), and Radical is id 816, Georgian 14282. But `api.getro.com/robots.txt` disallows everything and Getro points to a keyed API. Decision: the scanner reads each board's own public page (the same data is embedded in it) and does not call the API host. There is no working location filter, so Canada is matched on the location text. On Accel and General Catalyst the link is often a remote.com repost, not the company's posting.
- **We Work Remotely: sound.** 27 items with region ("USA Only", "North America Only", "Anywhere in the World"), full description and date. The link is a We Work Remotely page; the company's link is inside the description. Terms pages could not be read.
- **Mind the Product: sound for the newest 20 only.** The page embeds the newest 20 roles with seniority, remote, country, the application link and the date. No filter or paging works from the URL, and the API behind it is disallowed. The scanner reads the newest 20 per run.
- **Y Combinator: sound, low yield.** 38 product roles; `createdAt` is relative text ("16 days"); the link is a ycombinator.com page. The `/canada` path is wrong (it matches California). 3 roles at Director or above, none in Canada.
- **Wellfound: sound.** `wellfound.com/role/r/head-of-product` (remote) returned 34 listings, 7 accepting Canada, with pay, start date and accepted remote locations in the page data. Nine requests in a row were not blocked. The `/canada` paths do not exist.
- **startup.jobs and hiring.cafe: confirmed blocked for scripts** on every path tried, including feeds and search endpoints.
- **Workday, Workable, SmartRecruiters, Recruitee, Rippling: sound.** Workday pages are capped at 20 and need a second request per role for the description and date, as do Workable, SmartRecruiters and Rippling. Recruitee returns everything in one request.
- **Amazon: sound.** `amazon.jobs/en/search.json?base_query=<q>&country=CAN&sort=recent` with `result_limit` and `offset`; 195 hits for "product" in Canada, a loose match that needs the title filter.
- **Built In: not added.** The senior-leader path works, but no path restricts to Canada.

**Research notes** (all fetched 2026-11-13).

- Himalayas search API: `https://himalayas.app/jobs/api/search?q=<q>&country=CA&seniority=Director`. Nine queries returned 199 roles, about 50 senior product, growth or AI; examples with Canada listed and pay posted: Mercury Head of Product ($290–362k USD), LocalStack Head of Product ($238–368k USD).
- Communitech and fund boards: `POST https://api.getro.com/api/v2/collections/<id>/search/jobs`; ids Communitech 628, Khosla 257, Accel 8672, General Catalyst 222, Georgian 14282 (not confirmed working). Khosla returned Coda "Head of Growth Product, Mail" (remote, Canada). Accel's results include Jobgether and remote.com reposts.
- Y Combinator: `https://www.ycombinator.com/jobs/role/product-manager`, list in the page's `data-page` attribute, with a `visa` field. Few senior roles.
- We Work Remotely: `https://weworkremotely.com/categories/remote-product-jobs.rss`, 27 items, 3 at Director or Head level. No pay field.
- Mind the Product: `https://mindtheproduct.com/jobs/`, listing pages carry `datePosted` and `baseSalary`.
- Wellfound: `https://wellfound.com/role/head-of-product` loads with listings in the page data; pay, date and Canada filter not confirmed.
- More company-board APIs, each tested on one company: Workable (`apply.workable.com/api/v3/accounts/<slug>/jobs`), SmartRecruiters (`api.smartrecruiters.com/v1/companies/<slug>/postings`), Recruitee (`<slug>.recruitee.com/api/offers/`), Workday (`<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs`), Rippling (`ats.rippling.com/api/v2/board/<slug>/jobs`).
- Blocked or empty: startup.jobs and hiring.cafe (Cloudflare challenge to scripts), Indeed and Glassdoor (403), Google job search (needs a browser), ExecThread (login), TrueUp (title filter ignored; Lenny's Jobs is built on it), Remote OK, Remotive, Working Nomads and Hacker News "Who is hiring" (no fitting senior roles).
- Fund boards on the other vendor (a16z, Sequoia, Bessemer, Lightspeed, Kleiner Perkins, First Round) return a captcha page to scripts.
- Lenny's Next 50 (`lennysjobs.com/next50`) is a company list with no jobs attached; usable only to find companies for the watchlist.
- Not tested: Otta, Reforge, Product School, Pallet collectives, Chief, On Deck, fractional boards, Remote.co, FlexJobs (requests failed or the URL was not found).

## Plan

Decisions on the spec's open questions: (1) search-engine discovery is not built; (2) X searches are built; (3) the already-judged list is kept by the app, in `data/<p>/hunt/seen.yaml` through `lib/store` (lock, atomic write, commit), and the scanner reads and adds to it over the app's API; (4) jobs get an optional `foundVia` URL; (5) the fund-board reader reads the data embedded in each board's public pages, at most 3 pages per board per run with 10 seconds between requests to one board (their robots files ask for that delay), and does not call Getro's API host, whose robots file disallows scripts; (6) Wellfound passed the check and is a reader; Radical is in; Georgian is tried once more in task 1 and dropped if its pages stay empty.

Two changes to the spec's wording, both to avoid hiding roles nobody read:
- **Criterion 5.** Roles are recorded as seen by key, one by one, after the hunt has judged them (`boards.py --mark-seen <key> …`), not when they are printed. The criterion is checked after that step.
- **Criterion 6.** Two roles are merged only when they resolve to the same posting (same board and id after a feed's link is read), or when they come from different sources and have the same normalised company and title. Two roles from the same source are never merged, so several "Product Manager" roles at one dream company all stay.

### File map

| Path | Responsibility | |
|---|---|---|
| `.claude/skills/fenix-hunt/boards.py` | Entry point: get the person's hunt settings and seen keys, run every reader, filter, merge, drop seen, print with counts, write JSON; `--mark-seen` | modified |
| `.claude/skills/fenix-hunt/hunt_core.py` | Pure functions: title filters (senior, wide), home match, name normalising, posting URL to board and id, merge | new |
| `.claude/skills/fenix-hunt/hunt_ats.py` | One company's board: Ashby, Greenhouse, Lever (moved), Workday, Workable, SmartRecruiters, Recruitee, Rippling, Amazon. Each is a fetch plus a pure `parse_*` | new |
| `.claude/skills/fenix-hunt/hunt_feeds.py` | Sources that list many companies: Himalayas, the Getro boards, Wellfound, Y Combinator, We Work Remotely, Mind the Product | new |
| `.claude/skills/fenix-hunt/feeds.txt` | The feed list, one line per feed, so adding a fund board is one line | new |
| `.claude/skills/fenix-hunt/watchlist.txt` | Company list; new `slug:board:extra` form for Workday | modified |
| `.claude/skills/fenix-hunt/test_scan.py`, `fixtures/` | Offline tests of every `parse_*`, the filters and the merge, on trimmed sample responses | new |
| `.claude/skills/fenix-hunt/SKILL.md` | Limits, sources, Google and Meta step, post searches, browser boards, fresh pass, report | modified |
| `package.json` | `check:hunt` runs `test_scan.py` | modified |
| `lib/store/schemas.ts` | `settings.dreamCompanies`; `job.foundVia`; `huntSeenSchema` | modified |
| `lib/store/hunt.ts` | Read and add seen keys for one person (lock, atomic write, commit, drop keys older than 180 days) | new |
| `app/api/p/[profile]/hunt/route.ts` | GET: the settings the hunt needs plus the seen keys. POST: add seen keys | new |
| `lib/jobs/schema.ts`, `lib/jobs/repo.ts`, `lib/store/jobs.ts` | Accept `foundVia`; keep the first value stored; pass it to the page | modified |
| `app/p/[profile]/jobs/[id]/page.tsx` | Show "Found via" | modified |
| `scripts/check-jobs.ts`, `scripts/check-store.ts` | Assert `foundVia` and the seen list | modified |
| `data/mauricio/profile.yaml` (through `pnpm fenix set-profile`) | His `dreamCompanies` | data |
| `data/mauricio/memory/hunt-profile.md`, `project-target-companies.md` | Canada values for the new sources; the target-company note points at the setting and the skill | data |
| `docs/learnings/`, `docs/architecture.md`, `CLAUDE.md` | Today's findings; the scanner, `check:hunt`, the hunt route | modified |

### Tasks

1. **Script probes.** For each script source, save one trimmed sample response under `fixtures/` (no personal data; `check:public` scans them) and write the exact request in the spec's External verification. Covers Workday, Workable, SmartRecruiters, Recruitee, Rippling, Amazon, Himalayas, one Getro board page, Wellfound, Y Combinator, We Work Remotely, Mind the Product. One or two requests per source. *Verify:* a fixture file exists for each and loads as JSON or XML. *Commit.*
2. **Browser probes.** In Chrome, load startup.jobs, hiring.cafe, Google careers and Meta careers once each; record the URL and filters that list senior product roles in Canada, or that the site showed a challenge. *Verify:* one line per site in External verification, "works: <URL>" or "dropped: <reason>". *Commit.*
3. **Split the scanner without changing what it finds.** Readers to `hunt_ats.py` as fetch plus `parse_*`, filters to `hunt_core.py`, `boards.py` stays the entry point with the same output. Add `test_scan.py` and `pnpm check:hunt`. Reuse: nothing in TypeScript to share (`lib/jobs/liveness.ts` asks the same boards a different question). Tests cover an empty board, missing fields and a non-ASCII title; expected values are literals from the fixtures. *Verify:* the set of `source` + `sourceJobId` for the full watchlist is identical before and after, and `pnpm check:hunt` passes. *Commit.*
4. **Posting date and order.** Each role gets `posted` (ISO date) from Ashby `publishedAt`, Greenhouse `first_published`, Lever `createdAt`; output is newest first, undated last. *Verify:* `python3 boards.py docker` prints a date per role, newest first; a test asserts the order on a fixture. *Commit.*
5. **Counts and failures per source.** Every source prints one line: roles read, kept, and later (tasks 9 and 10) merged and hidden as seen. A reader that throws or gets a non-200 prints `FAILED <reason>`; a 200 with zero roles prints `0 read`; a reader that stopped at its page cap prints `capped at N`. The run always continues. *Verify:* a test feeds a reader a 500, an empty list and a full last page and asserts the three lines; `python3 boards.py no-such-company-zz` prints `NOT FOUND` and exits 0. *Commit.*
6. **Five more board types and Amazon.** Readers for Workday, Workable, SmartRecruiters, Recruitee, Rippling and Amazon from task 1's requests. Watchlist lines take `slug:board:extra`. Bounds: 5 pages per company; a reader that needs a second request per role fetches it only for roles that pass the title filter, at most 15 per company. Add Nvidia and CrowdStrike (Workday) and Amazon to the list. *Verify:* one real company per type returns roles with title, location, URL and id (criterion 3). *Commit.*
7. **Himalayas, the Getro boards and Wellfound.** `feeds.txt` lists them. Himalayas: home country code, Director and Executive, queries built from the target titles, 2 pages each. Getro: the board page with the same queries, 3 pages per board, 10 seconds apart per board, kept when the location text matches home or says remote. Wellfound: the remote role pages for head, VP and director of product and head of growth, kept when the accepted remote locations include the home country or are empty. Each role carries the feed's name and id, pay as posted, the date, and the posting URL when the feed gives one. *Verify:* a real run prints a line per feed with read and kept; pay shows on at least one Himalayas and one Getro role (criterion 2). *Commit.*
8. **Y Combinator, We Work Remotely, Mind the Product.** One request each (YC: the product list and its remote variant; Mind the Product: the newest 20). YC roles marked US-only in `visa`, and We Work Remotely roles marked "USA Only" or "Europe Only", are counted as dropped on the source's line, not hidden. *Verify:* each prints its line on a real run; tests cover each parser. *Commit.*
9. **Merge into one list.** A feed role whose link is an Ashby, Greenhouse or Lever posting is rewritten to that board's `source` and `sourceJobId`, ready to save. Then roles are merged by the rule above; the company-board copy wins and the others are kept in a `via` list. Altitude: name matching across sources is a fallback for feeds that give no company link (Himalayas, YC); it will miss some pairs (a slug that differs from the display name), which shows as a duplicate the hunt's "one job, one row" step still catches. *Verify:* tests: the same role from a feed and from Greenhouse comes out once under Greenhouse with the feed in `via` (criterion 6); two same-titled roles from one board both stay. *Commit.*
10. **The seen list and the hunt route.** `lib/store/hunt.ts` and `GET`/`POST /api/p/<p>/hunt`. GET returns `homeCountry`, `homeCountryName`, `targetTitles`, `queries`, `watchlistExtra`, `dreamCompanies` and the seen keys. POST `{ "seen": ["<source>:<id>", …] }` adds keys (at most 2,000 per call, each up to 300 characters) with today's date; adding a key twice changes nothing; two callers at once are serialised by the profile lock. `boards.py --profile <p>` reads the route, hides seen roles and counts them on each source's line; `--all` shows them; naming slugs on the command line (a lookup) implies `--all` and writes its JSON to a different file from the full scan. `--mark-seen <key> …` posts the keys. Without `--profile`, the environment variables work as today and nothing is hidden. The skill also marks post URLs it has handled (`post:<url>`), so a daily fresh pass does not re-read them. *Verify:* `pnpm check:store` asserts add, re-add, the 180-day drop and a malformed file reported as an error, on a scratch profile; curl GET and POST against the dev server return the shapes above; after `--mark-seen` of three keys a second run hides exactly those three and its line says "3 hidden as seen" (criterion 5). *Commit.*
11. **Dream companies.** `settings.dreamCompanies` (entries in watchlist form). For those the title filter is any product or growth title (still skipping design, marketing, sales, engineering), and the role is marked `dream`. Set his list with `pnpm fenix set-profile`. Altitude: the list is passed through the hunt route, so the scanner needs the app running, which the hunt already requires. *Verify:* with the setting, an Anthropic or OpenAI "Product Manager, …" role is printed and marked `dream`; without it the output for those boards is unchanged (criterion 4); `pnpm check:store` and `check:data` pass. *Commit.*
12. **Found via.** `foundVia` (a URL) on `jobInputSchema`, `jobSchema` and `toJob`. `upsertJob` keeps a stored value when a later save sends none or a different one. The job page shows "Found via <host>" as a link. *Verify:* `pnpm check:jobs` asserts a save with and without the field, a non-URL rejected, and the first value surviving a second save; manual: the job page shows the line. *Commit.*
13. **The skill: limits and script sources.** In `SKILL.md`: the new limits table; LinkedIn runs every saved query, 4 pages of 25, cards triaged before opening, newest first; the scanner command with `--profile`; how to judge and save a scanner role (from the company's own posting; a feed role with no company link is found on the company's board or site first; a Himalayas or YC page is never the saved URL); marking each judged role seen. *Verify:* criteria 7 and 12 each map to a quoted line in the skill; `grep` finds no remaining "≤ 40" or "≤ 6 LinkedIn". *Commit.*
14. **The skill: browser steps.** Google and Meta step; post searches on LinkedIn and X (URLs, limits, what counts, read-only rule, `foundVia`, marking posts seen); the browser boards that passed task 2; the fresh pass; the report (per source: read, kept, merged, hidden as seen, capped, failed; per new job: which source found it; posts with no posting behind them). *Verify:* criteria 8, 9 and 10 each map to a quoted line in the skill. *Commit.*
15. **Docs and memory.** Learnings (LinkedIn sort and paging, post search, X search, each board's quirks), `hunt-profile.md`, `project-target-companies.md`, `docs/architecture.md`, `CLAUDE.md`. *Verify:* `pnpm check:data`, `check:public`, `lint`, `tsc --noEmit`, `check:store`, `check:jobs`, `check:hunt` all pass. *Commit.*
16. **A real fresh pass for Mauricio.** Run it as the skill says: scanner, LinkedIn past 24 hours, post searches on LinkedIn and X, at most 30 postings opened, jobs saved, report. *Verify:* criteria 1, 2, 8, 10 and 11 observed (a saved job from a new source shows on the board); anything the skill got wrong is fixed in the skill.
17. **Google and Meta observed.** Run that one step and report the counts. *Verify:* criterion 9.

### Premises

- `.claude/skills/fenix-hunt/boards.py` — stdlib only; `python3` is 3.9 with no PyYAML, so the scanner cannot read `profile.yaml` itself. (Holds.)
- `lib/jobs/schema.ts` — `source` is free text up to 40 characters; only `linkedin`, `greenhouse`, `ashby`, `lever` have an id format rule. `jobInputSchema` is a strict-stripping `z.object`, so `foundVia` must be added there or it is dropped. (Holds.)
- `lib/store/schemas.ts` — `settingsSchema` and `jobSchema` are `looseObject`; old files load after optional fields are added. (Holds.)
- `lib/store/jobs.ts` `toJob` — lists every field by name, so `foundVia` must be added to reach the page. (Holds.)
- `lib/jobs/repo.ts` `upsertJob` — `Object.assign(d, facts, …)`: an absent field is left alone, a present one (including `null`) overwrites, so "first value kept" needs code. (Holds.)
- `app/api/p/[profile]/settings/route.ts` — exports only PATCH; nothing returns settings over HTTP. (Was assumed otherwise; task 10 adds the hunt route.)
- `scripts/fenix.ts` `set-profile` — merges `settings` keys through the store and keeps keys the schema does not name. (Holds.)
- `lib/store/validate.ts` — does not walk unknown folders under `data/<p>/`, so `hunt/` does not fail `check:data`. (Holds.)
- `scripts/check-public.ts` — scans the skill folder, so fixtures must not contain his name, email or phone. (Holds.)
- No file in `app/`, `lib/` or `scripts/` names `boards.py` or `watchlist.txt`; `fenix-apply/SKILL.md` and three docs do and are updated in task 15. (Holds.)

### Robustness review (2026-11-13)

Two agents that did not write the plan reviewed it. Verdicts, and what changed:

- **Reconstruction: PATCHWORK, fixed in part.** The seen list was a Python-written file; it now lives in the store behind a route. Still open by choice: Lenny's Jobs and the remote boards keep re-finding a role on the company's board by slug, because those sites give no company link.
- **Bolt-on vs best practice: PATCHWORK, fixed.** Bulk "mark everything printed as seen" would have hidden unread roles after an interrupted or capped run; marking is now by key. Reading settings from a route that did not exist is replaced by a route this plan builds. Name-and-title merging no longer merges roles from the same source. `foundVia` is a URL, not free text.
- **Mismatched profiles: ROBUST.** Company boards, feeds and browser steps are separate modules and separate skill sections; post URLs share the seen list.
- **Cross-boundary reach: ROBUST.** No app code imports from `scripts/` or the skill folder.
- **Altitude: now named** on tasks 9 and 11.
- **Silent loss: PATCHWORK, fixed.** Every source line now reports dropped, merged, hidden-as-seen and capped counts.
- **Premises: one FALSE** (no settings GET), fixed by task 10; the rest hold.
- **Coverage:** criteria 7 (a full hunt with all 8 LinkedIn queries) is not observed by this plan's tasks; see Risks.

### Risks / unknowns

- **A feed changes or blocks scripts.** Each reader fails on its own with a `FAILED` or `0 read` line; nothing else stops.
- **Getro boards are read from their public pages, not the API host.** A board whose page data disappears prints `0 read` and is dropped from `feeds.txt`.
- **More LinkedIn page loads per run** (up to 8 searches × 4 pages, 100 postings, 4 post searches). The human pace and stop rule stay; the first full run is the test.
- **X may restrict automated reading on the account.** 4 searches per run, read only, stop on any notice.
- **The first scanner run prints a few hundred roles.** Judging them is the long part of the first run; later runs show only new ones.
- **A seen role whose pay or title changes later is not shown again.** `--all` shows everything; accepted.
- **Posting dates overlap with `posting-recency.md`.** This plan adds `posted` to the scanner output only; storing it on the job is that spec's work.
- **Criterion 7 needs a full hunt.** Tasks 16 and 17 are a fresh pass and the Google and Meta step. The full hunt (all 8 LinkedIn queries, 100 cards each) is observed the first time he runs one and recorded in Status then.

### Not yet specified

- Which of startup.jobs and hiring.cafe get a pass in the skill: decided by task 2.

### Out of scope

- Search-engine discovery through Exa or Tavily: no measured price.
- Storing the posting date on the job, freshness labels, the stale rule: `posting-recency.md`.
- A settings page field for `dreamCompanies`: set through `pnpm fenix set-profile`.
- Built In, and the fund boards that show scripts a captcha.
- Scheduling runs.

### Research notes

- See the spec's Research notes and External verification; tasks 1 and 2 add the exact request per source.

## Status
