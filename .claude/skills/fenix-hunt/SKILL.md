---
name: fenix-hunt
description: Use when someone asks to hunt, search, or scan for jobs for a Fenix profile, or to run a fresh pass (or runs /fenix-hunt). Scans every job source a script can read (company boards, Himalayas, Wellfound, YC, fund and Canadian tech boards), browses LinkedIn jobs and "we're hiring" posts on LinkedIn and X in that person's signed-in Chrome, plus Lenny's Jobs, remote-job boards, startup.jobs, hiring.cafe, Google and Meta careers; checks each role against the person's settings (pay floor, remote rule, target titles), saves every job to their Fenix pipeline at localhost:3007, and drafts a tailored CV for strong matches. Never applies or messages anyone.
---

# Hunt (script sources, LinkedIn jobs and posts, X, job boards → Fenix pipeline)

**Announce at start:** "I'm using the fenix-hunt skill to scan for jobs for <person>."

## Who this is for

One Fenix profile per run, `<p>` below (a folder in `data/`). If there's only one profile, it's that one; otherwise use the person the request names, or ask. Everything person-specific comes from their files:

- `data/<p>/profile.yaml` `settings`: `floorUsd`, `homeCountryName`, `remoteRule`, `exceptions`, `targetTitles`, `queries`, `watchlistExtra`, `dreamCompanies`, `strongMatchFit`.
- `data/<p>/memory/` (start from `MEMORY.md`): `hunt-profile.md` (who they are, location ids and board URLs for their country) and `cv-rules.md`.
- `docs/cv-tailoring.md`: the tailoring rules for everyone.
- `data/<p>/interview-answers.md` if present: how they describe their work in interviews. Use its `landed` lines for headline and summary wording; numbers still only from the record.

## Hard rules

- **Read only on LinkedIn and X.** Never click Apply, Easy Apply, Save, Follow, Connect, Message, Like, Repost or Reply. Never fill a form. Applying is the person's step (the fenix-apply skill).
- **Human pace.** One tab for LinkedIn and X, one for company sites. No parallel page loads.
- **Stop immediately** and report on a captcha, "unusual activity" / restriction banner, or sign-in wall. Don't retry.
- **No paid API calls.** All judgment (comp, remote, fit, CV drafting) happens in this session.
- **Quote, don't paraphrase, evidence.** `compEvidence` and `remoteEvidence` are verbatim snippets from the page.
- **Never invent** salary numbers, remote policy, or résumé achievements.

## Two kinds of run

- **Full hunt** ("run a hunt"): everything below, in this order: script sources, LinkedIn jobs, hiring posts, Lenny's Jobs, remote-job boards, startup boards, Google and Meta, closed postings, CV drafting, report.
- **Fresh pass** ("run a fresh pass"): only the steps that find new postings fast: script sources, the LinkedIn past-24-hours pass, hiring posts. Meant for the days between full hunts. Same rules, smaller limits.

## Bounds per run

| | Full hunt | Fresh pass |
|---|---|---|
| Script sources (`scan.py`) | once; every role it prints is judged, with no limit (no page loads) | the same |
| LinkedIn past-24-hours pass | every saved query for the home country, page 1 | the same |
| LinkedIn under-10-applicants pass | every saved query for the home country, page 1 | skipped |
| LinkedIn saved queries as written | **every** query in `settings.queries`, ≤ 4 result pages each (100 cards) | skipped |
| Postings opened in the browser (all sources) | ≤ 100 | ≤ 30 |
| Company-site visits | ≤ 30 | ≤ 10 |
| Hiring-post searches | 4 on LinkedIn, 4 on X, about 30 posts read in each | the same |
| Lenny's Jobs, each remote-job board, startup.jobs, hiring.cafe | 1 pass each | skipped |
| Google and Meta careers | 1 page each | skipped |
| LinkedIn closed-posting checks | ≤ 15, counted separately from the 100 | skipped |

Stop when a bound is hit and say which.

Result pages are cheap and postings are not: judge most jobs from the card (title, company, location, pay, age) and spend the opened postings on the freshest plausible ones.

## Preconditions

1. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3007/p/<p>/jobs` → `200`. If not, ask the person to start Fenix (`pnpm dev`); don't start it yourself.
2. Load the Claude in Chrome tools (one ToolSearch call: `tabs_context_mcp, tabs_create_mcp, navigate, javascript_tool, browser_batch, get_page_text, find, read_page, computer, tabs_close_mcp`), call `tabs_context_mcp`, open a **new** tab. If several browsers are connected (one per Chrome profile), pick the one for this person.
3. **Right person signed in.** Open `https://www.linkedin.com/feed/` and read the signed-in member's name (the profile card or the "Me" menu). If it doesn't match `fullName` in `profile.yaml`, stop and say who is signed in. Never search from someone else's account.
4. Load canonical data once: `curl -s http://localhost:3007/api/p/<p>/canonical` — used for fit and drafting.

## Searches

LinkedIn (as of 2026-11-06) redirects `/jobs/search/` to `/jobs/search-results/` and drops `location`, `f_WT` and `f_E`. Use the new page directly:

`https://www.linkedin.com/jobs/search-results/?keywords=<q>&geoId=<geo>&f_TPR=r604800`

- `geoId` sets the location (the person's ids are in `hunt-profile.md`). Without a `geoId`, the page reuses the last location searched. `f_TPR=r604800` is the past week; `r2592000` is the past month.
- The remote filter does not stick, so on-site and hybrid roles appear. Check the work arrangement in every posting.
- The page may add the person's saved salary filter (`f_SAL=...`); that's fine to keep.
- Natural-language keywords work. Adding a country to a search set in another country is mostly ignored, so search from the person's own country first.

- **There is no newest-first sort.** `sortBy=DD` is dropped from the address and the order stays LinkedIn's relevance order (tested 2026-11-13). Fresh jobs are reached with the two passes below and by reading more pages.
- **Paging:** add `&start=25`, `&start=50`, `&start=75` for pages 2 to 4 (25 cards a page).
- **Each card shows its age** as text: "Posted 18 hours ago", "Posted 2 weeks ago", "Reposted 1 day ago". Some promoted cards show none.

Queries: **every** query in the person's `settings.queries`, in order; none is skipped for being past a count. Each says the location, time window and keywords. The person may override them in their request; use theirs.

### Fresh jobs first

Applying early matters (the person's scale is in `hunt-profile.md`), so run the searches in this order:

1. **Past 24 hours:** every saved query for the person's own country with `f_TPR=r86400`, page 1 only.
2. **Under 10 applicants:** the same queries with `f_EA=true` in place of `f_TPR` (keep `geoId`), page 1 only. This is LinkedIn's "Under 10 applicants" filter; it surfaces roles few people have seen.
3. **The saved queries as written** (past week or past month), up to 4 pages each.

From all three, build one candidate list (id, title, company, location, pay, age), drop the known ids, and open postings **youngest first**: hours before days, days before weeks, a card with no age last. When the opened-postings bound runs out, the unread candidates are the oldest ones; say how many were left and how old.

## Script sources (no browser; first step of every run)

`FENIX_HOME_MATCH='<pattern from hunt-profile.md>' OUT=.scratch/hunt/scan.json python3 .claude/skills/fenix-hunt/scan.py --profile <p>`

It takes about two minutes and reads, without a browser:

- every company board in `watchlist.txt` plus the person's `settings.watchlistExtra` (Ashby, Greenhouse, Lever, Workday, Workable, SmartRecruiters, Recruitee, Rippling);
- the person's `settings.dreamCompanies`: for these it keeps **every product or growth title at any level**, marked `dream` (for example Anthropic's and OpenAI's "Product Manager, …" roles, Nvidia on Workday, Amazon's search for the home country);
- the feeds in `feeds.txt`: Himalayas (remote roles open to the home country, Director and Executive), Wellfound, Y Combinator, We Work Remotely, Mind the Product, Communitech and the fund portfolio boards.

**Read the source lines first.** Each source prints one line: roles read, kept, dropped (another region, or a repost with the company hidden), merged into another source, hidden as seen, and whether a cap was hit. `FAILED <reason>` or `0 read` on a feed that normally returns roles means the site changed: say so in the report and note it in `docs/learnings/job-boards.md`. `NOT FOUND` on a company means it moved boards: find the new one or drop the line.

**Then the role list**, newest first: `key | posted | company | title | location | home | pay | dream | via <feeds>`. Full descriptions and `postedAt` are in the JSON. Roles already marked seen are not printed (`--all` prints them).

Judge every printed role like a LinkedIn job, newest first:

- First ask Fenix which printed roles are already stored (`GET /api/p/<p>/jobs?company=<name>`, same title): on the first run about half were, found earlier through LinkedIn. Mark those seen without re-reading them.
- Read a role when `home=True`, when its location says remote without a country, or when it is `dream`. Skip the rest (a New York on-site role) without saving.
- **A feed's date is when the feed saw the role, not when it was posted.** Himalayas listed Arctic Wolf, Bloom and Kepler roles as 1 November; the companies' own boards dated them September, August and May. Look the role up on the company's board before treating it as fresh.
- **Dream roles are reported at any fit**, in their own part of the report, because the person wants to see everything at those companies.
- **Save from the company's own posting.** A role whose `source` is `ashby`, `greenhouse` or `lever` is ready to save with that `source`, `sourceJobId` and `url`, even when a feed found it (`via`). Roles from the other board types save with their own `source` (`workday`, `workable`, `smartrecruiters`, `recruitee`, `rippling`) and the posting URL. Amazon roles save with `source: "company_site"` and the number in the key as `sourceJobId`, which is how Amazon roles are already stored.
- A role whose `source` is a feed (`himalayas`, `wellfound`, `yc`, `wwr`, `mindtheproduct`, `communitech`, a fund's name) has no company posting yet. Find it first: `python3 .claude/skills/fenix-hunt/boards.py <company slug>`, or the company's careers page (`source: "company_site"`, the posting URL's id as `sourceJobId`). **A Himalayas, Wellfound, YC or We Work Remotely page is never the saved `url`.** Use the feed's pay and country list as a lead, and quote evidence from the company's posting. If the company's posting cannot be found, don't save; list the role in the report.
- Send `postedAt` from the JSON with `postedAtSource: "board"` for company-board roles and `"listing"` for feed-only dates.
- Pay from a company board or careers page is `compSource: "company_site"`.

**Mark what you judged.** After each batch, record the roles you read or deliberately skipped, by key: `python3 .claude/skills/fenix-hunt/scan.py --profile <p> --mark-seen <key> <key> …`. Mark only keys you actually judged; a role you did not get to stays unmarked and is printed again next run.

`python3 .claude/skills/fenix-hunt/boards.py <slug>[:board[:extra]]` looks up one company (nothing hidden, writes `boards.json`); use it to find a role's own posting.

## Other sources (full hunt, after LinkedIn)

### Hiring posts on LinkedIn and X (browser; full hunt and fresh pass)

Founders and hiring managers post "we're hiring" with a link to the job, often before the role shows in LinkedIn job search. Run these in the LinkedIn tab, after the right-person check.

- **LinkedIn posts:** `https://www.linkedin.com/search/results/content/?keywords=<q>&datePosted="past-24h"&sortBy="date_posted"` (the quotes around the two values are part of the address). Posts load about six at a time; scroll to load more, up to about 30.
- **X:** `https://x.com/search?q=<q>&f=live` (the Latest tab). Check first that the signed-in account is the person's; if X shows a sign-in page, skip X and say so. Add `-filter:replies` to the query.
- **Queries (4 per site):** pair a hiring phrase with the person's target titles, for example `"we're hiring" "head of product"`, `"hiring a" "VP product"`, `"hiring" "head of growth"`, `"hiring" "AI transformation"`. On X one query can hold the alternatives: `("we're hiring" OR "hiring a") ("head of product" OR "VP product" OR "head of growth")`.
- `javascript_tool` refuses to return text that contains a full address with a query string. Return post text, the author, the age and link hosts, not `location.href`.
- **A post counts** when it names a role that fits the target titles and comes from the company or someone who works there. Most posts do not (people announcing their own new job, newsletters, recruiters' lists): skip them.
- **For a post that counts:** follow its link to the company's own posting (a `lnkd.in` link redirects there; a LinkedIn post that embeds a job card names the job directly), judge it like any job, and save it from that posting with `foundVia` set to the post's address.
- **Post addresses.** On X the address is the `time` element's link (`https://x.com/<user>/status/<id>`). LinkedIn's search page does not expose a post's address in the page; get it only for a post you are saving (the post's menu has "Copy link to post"), and otherwise identify the post as `linkedin:<author>:<first 40 characters>`.
- **Mark every post you judged**, fitting or not: `scan.py --profile <p> --mark-seen "post:<address or identity>"`, and skip posts already in the seen list (`GET /api/p/<p>/hunt` lists them).
- **Pre-filter in the page.** Most results are noise, so have the script return only posts whose text has a hiring phrase and a senior product, growth or AI title, and that do not start with someone announcing their own new job. On the first real run (2026-11-13) 33 LinkedIn posts and about 50 X posts gave no role that fit; expect most runs to add nothing, and report that plainly.
- **A post with no posting behind it** ("DM me", "send me a note"): save nothing. List it in the report with the author, the company, the role and the post's address, so the person can reach out.
- Never like, reply, repost, follow, connect or message.

### Lenny's Jobs (browser, no login needed)

`https://www.lennysjobs.com/` (built on TrueUp). The filters don't go in the URL, so set them by clicking: Job category **Product Management** (the default), Level **4 - Director, 5 - VP, 6 - SVP/CXO** (or the levels matching `targetTitles`), Location: the person's country. With a country selected it also shows remote roles open to that country and global remote roles. Each card shows title, company, location, age and posted pay. Cards don't link to the posting, so find each role on the company's own board: `python3 .claude/skills/fenix-hunt/boards.py <slug>` (try the company name lowercased) and save it from there, with that board as `source`. If `boards.py` does not find the company (it tries Ashby, Greenhouse and Lever by name), open its careers page and save with `source: "company_site"` and the posting URL's id as `sourceJobId`. Add companies that keep showing up to `watchlist.txt`.

### Remote-job boards (browser, no login needed)

One pass each, after Lenny's Jobs. They list remote roles with posted pay and say which countries can apply, so they catch remote roles open to the person's country that LinkedIn buries. Pages read here count toward the opened-postings and company-site bounds. The URLs and filters for the person's country are in `hunt-profile.md`; the boards are remote100k.com, Remote Rocketship and Sparc.

As with Lenny's Jobs, save each role from the company's own posting (its board via `boards.py`, or its careers page with `source: "company_site"`), never from the aggregator's page. Add companies that keep showing up to `watchlist.txt`.

### Startup boards (browser, no login needed)

One pass each. Both block scripts and load normally in Chrome (tested 2026-11-13). As with Lenny's Jobs, save each role from the company's own posting, never from the board's page.

- **startup.jobs:** `https://startup.jobs/?q=<title>&remote=true`, one search each for "head of product", "vp product" and "head of growth". Each of the 25 cards shows title, company, place or REMOTE, and age.
- **hiring.cafe:** `https://hiring.cafe/?searchState=<JSON>` with the JSON `{"searchQuery":"head of product"}` URL-encoded; the same three searches. It defaults to the person's country and searches company career pages directly, so it finds roles that are on no job board. Cards show age, title, place, pay and work arrangement.

### Google and Meta careers (browser)

One page each, every full hunt, so these two do not depend on anyone remembering them. Report the count for each even when it is zero.

- **Google:** `https://www.google.com/about/careers/applications/jobs/results?q="product manager"&location=<home country>`. Read the role titles; open only product, growth or AI-product roles.
- **Meta:** `https://www.metacareers.com/jobsearch/?q=product manager&offices[0]=<office>&offices[1]=<office>…` with the person's country's offices from `hunt-profile.md`.

Amazon and Nvidia are read by the script scan (Amazon's search and Nvidia's Workday board), when they are in the person's `dreamCompanies`.

### One job, one row

The same role often appears on LinkedIn and on the company board. Before saving a job from any source, run `GET /api/p/<p>/jobs?company=<name>`. If a stored row has the same title (ignoring punctuation and location suffixes), don't create a second one: update that row by re-posting with its `source` + `sourceJobId`, adding the better evidence (the company board's pay and location beat LinkedIn's).

## Per job

1. From the results list, collect job ids. Result cards have no `/jobs/view/` links; the id is the 10-digit number inside the `componentkey` attribute of each `div[role=button][componentkey]` card. Wait about 4s after navigating, then:
   `[...document.querySelectorAll('div[role=button][componentkey]')].map(d=>(d.getAttribute('componentkey').match(/\d{10}/)||[''])[0]).filter(Boolean)`
   The card's own text has the age line (the line ending in "ago", starting "Posted" or "Reposted"); return it with the id so candidates can be ordered by age.
   `javascript_tool` output is cut at about 1,000 characters, so return the ids alone, or short `id|title|company|salary` rows in slices. Ask Fenix which are already stored: `GET /api/p/<p>/jobs?source=linkedin&ids=<comma list>`. **Skip known ids** — this saves page reads; the upsert would dedupe anyway.
2. Open the job (`https://www.linkedin.com/jobs/view/<id>/`). `get_page_text` on the raw page returns the job plus thousands of words of company feed. Instead, in one `javascript_tool` call:
   - wait until `main` contains "About the job";
   - slice `main.innerText` from the top card to the first of "Benefits found in job post", "Set alert for similar jobs", "See how you compare", "Exclusive Job Seeker Insights" or "How Jobgether Works";
   - replace `main`'s children with a `<pre>` holding that text.

   Then call `get_page_text`. This only changes the page on screen and never writes to LinkedIn. The full description loads without clicking "See more".
3. Extract:
   - **Comp**: base salary range + currency as posted. `compSource: "posting"`. Postings listed in another country often state only the US band ("U.S. base salary range: …"); record that band as posted and say in `redFlags` that an offer in the person's country may be lower. If the posting has none, check the company careers page for the same role (many US companies publish ranges there for pay-transparency laws) → `"company_site"`. If you can only infer (levels.fyi, similar roles), `"estimate"` and say where in `compEvidence`. Otherwise `"unknown"`. If the range clearly includes bonus/OTE, use only the base part or mark `estimate`.
   - **Remote verdict**:
     - `country_ok`: remote and the person's country (or a region including it, or anywhere) explicitly allowed.
     - `sponsorship_offered`: posting says it sponsors visas.
     - `us_only`: must live or be authorized to work in a country the person can't work in (for example "must reside in the US" or a US-state list), without sponsorship.
     - `onsite`: on-site or hybrid.
     - `unclear`: says remote but doesn't say where. Check the careers page before settling on `unclear`. Salary posted + no remote mention usually means not remote — read carefully.
   - **Posting date**: the top card says "17 hours ago", "1 week ago" or "Reposted 2 days ago". Turn it into a date-time (now minus that span; "2 weeks ago" is 14 days) and send it as `postedAt` with `postedAtSource: "listing"`, and `reposted: true` when it says "Reposted". If there is no age line, send none of the three; don't guess. **LinkedIn's date can be weeks off** (Pacvue showed "Reposted 1 day ago" for a role its board first published five weeks earlier). For a strong candidate, and for every "Reposted" job, look the role up on the company's board (`python3 .claude/skills/fenix-hunt/boards.py <slug>` prints `posted <date>`, and the JSON has `postedAt`); when the company is on Ashby, Greenhouse or Lever, send the board's date with `postedAtSource: "board"` instead. Fenix keeps a board date over a listing date, and never lets a re-post make a job look newer.
   - **Fit 0–100** against canonical and `targetTitles` (what to weigh is in `hunt-profile.md`). `whyGood`: 2–4 sentences naming the person's specific matching experience, with numbers only as they appear in their career record. `redFlags`: anything off (tiny company, crypto, heavy travel, equity-heavy comp, years-of-experience mismatch).
4. `POST http://localhost:3007/api/p/<p>/jobs` with:
   `source:"linkedin"`, `sourceJobId`, `url` (canonical `/jobs/view/<id>/`), `companyUrl` (careers page if visited), `company`, `title`, `locationText`, `compMin`, `compMax`, `currency` (USD, CAD, EUR or GBP — Fenix rejects others; for another currency, convert yourself, send USD with `compSource: "estimate"`, and put the original figure in `compEvidence`), `compSource`, `compEvidence`, `remoteVerdict`, `remoteEvidence`, `remoteEvidenceUrl`, `jdText` (full text), `fitScore`, `whyGood`, `redFlags`, `easyApply`, `applicants` (a number: "Over 100 applicants" → 100; Fenix rejects text), `foundVia` (only when a hiring post led to the job: the post's address), `postedAt` (ISO date-time with a zone, e.g. `2026-11-12T14:00:00.000Z`), `postedAtSource` (`board` or `listing`; required with `postedAt`), `reposted`.
   Fenix decides the stage. Read the response: `SHORTLISTED`, `FOUND` (needs a check), or `FILTERED_OUT`. A posting 21 days old or more with fit under `settings.strongMatchFit` comes back `FOUND` with a "Posted over 3 weeks ago" check instead of `SHORTLISTED`; that is the stale rule, not an error.

## Closed postings (full hunt, last)

1. **Company boards (no browser):** `pnpm check:closed <p> --write`. It asks Ashby, Greenhouse and Lever whether each job in Found, Shortlisted and CV ready is still posted (at most 60 requests) and flags the closed ones. Stages never change; the person decides.
2. **LinkedIn jobs (browser, at most 15 per run, counted separately from the opened-postings bound):** open each LinkedIn job in those stages, oldest `lastSeenAt` first, and look for LinkedIn's notice that the job no longer accepts applications. **The exact wording isn't confirmed yet:** the first time you see a closed LinkedIn posting, quote the notice in the end-of-run report and add it here, and record nothing until then. Once the wording is here, a match is `PATCH /api/p/<p>/jobs/<id>` with `{"postingClosedAt":"<now ISO>","postingClosedEvidence":"LinkedIn: <the notice, quoted>"}`.

## CV drafting (strong matches only)

A strong match is a job that came back `SHORTLISTED` **and** has fit ≥ `settings.strongMatchFit` (default 75). For each one:

1. Pick the closest existing CV version as a base (`GET /api/p/<p>/variants/<id>`). The person's base CV per kind of role is in `cv-rules.md`; list versions with `curl -s localhost:3007/api/p/<p>/variants` if names changed.
2. Retune `headline` and `summary` to the JD's language, and reorder/reword bullets for the JD. Use only bullet ids from `/api/p/<p>/canonical`. Follow `docs/cv-tailoring.md` and the person's `cv-rules.md`, and borrow wording from `interview-answers.md`'s `landed` lines where it fits. Every number must already be in the career record or a story.
   - **Key achievements:** if the CV's design shows them (its entry in `curl -s localhost:3007/api/p/<p>/templates` lists `keyAchievements` under `features`; an empty `templateId` means the person's default), draft 3 as `overrides.keyAchievements: [{ "title", "text" }]`: a title of 2–5 words (at most 60 characters) and one line of text (at most 200), each picked from bullets and stories whose numbers are backed. For any other design, draft none: the number rule checks them even where they aren't printed.
3. `POST /api/p/<p>/jobs/<jobId>/variant` with `{ "name": "<Company> - <Title>", "overrides": {...} }`. It creates the CV version, links it, and moves the job to CV ready in one step. Retrying updates the same version. A 400 listing `unknown` ids means an override references a bullet/skill/course/position id that isn't in canonical: fix those ids and resend. A 400 about `keyAchievements` means a title or line is too long or there are more than 4: shorten and resend.
4. Run `pnpm check:claims <p>`. A `BLOCKS` line is a number with no source in a CV you just drafted: take it out.
5. Check the length: `curl -s -o .scratch/hunt-<jobId>.pdf localhost:3007/api/p/<p>/cv/<variantId>/pdf` and count pages (`pdfinfo .scratch/hunt-<jobId>.pdf | grep Pages`). Executive CVs are one page; trim bullets if it spills.

## End-of-run report

Short summary to the person:
- counts per source (LinkedIn jobs / hiring posts on LinkedIn / hiring posts on X / each script source that kept anything / Lenny's Jobs / remote boards / startup.jobs / hiring.cafe / Google / Meta): new / already known (skipped) / shortlisted / found-needs-check / filtered out / CV ready
- script sources that printed `FAILED`, `0 read` or a cap, and how many roles were hidden as seen or merged
- for each new job, which source found it first (a feed, a board, a LinkedIn search, a post)
- dream-company roles, each with its fit, including the middling ones
- hiring posts with no posting behind them: author, company, role, post address
- feed roles whose company posting could not be found
- how many postings were opened out of the bound (100, or 30 for a fresh pass)
- postings flagged closed (company boards / LinkedIn), each with its job link
- one line per shortlisted or CV-ready job, **newest posting first**: company, title, age ("18 hours", "5 days", "reposted, board says 5 weeks"), base range + source, remote verdict, fit, link `http://localhost:3007/p/<p>/jobs/<id>`
- stale jobs (21 days or more) in their own line at the end, with their age
- candidates left unread when the opened-postings bound ran out: how many, and how old the youngest was
- any bound hit or stop condition met
- anything about a site's page structure that differed from this skill (then update this file, or `docs/learnings/`)
