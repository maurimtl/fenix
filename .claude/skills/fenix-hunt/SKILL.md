---
name: fenix-hunt
description: Use when someone asks to hunt, search, or scan for jobs for a Fenix profile (or runs /fenix-hunt). Browses LinkedIn in that person's signed-in Chrome via Claude in Chrome, plus Lenny's Jobs, remote-job boards and a watchlist of company job boards, checks each role against the person's settings (pay floor, remote rule, target titles), saves every job to their Fenix pipeline at localhost:3007, and drafts a tailored CV for strong matches. Never applies or messages anyone.
---

# Hunt (LinkedIn, Lenny's Jobs, company boards → Fenix pipeline)

**Announce at start:** "I'm using the fenix-hunt skill to scan for jobs for <person>."

## Who this is for

One Fenix profile per run, `<p>` below (a folder in `data/`). If there's only one profile, it's that one; otherwise use the person the request names, or ask. Everything person-specific comes from their files:

- `data/<p>/profile.yaml` `settings`: `floorUsd`, `homeCountryName`, `remoteRule`, `exceptions`, `targetTitles`, `queries`, `watchlistExtra`, `strongMatchFit`.
- `data/<p>/memory/` (start from `MEMORY.md`): `hunt-profile.md` (who they are, location ids and board URLs for their country) and `cv-rules.md`.
- `docs/cv-tailoring.md`: the tailoring rules for everyone.
- `data/<p>/interview-answers.md` if present: how they describe their work in interviews. Use its `landed` lines for headline and summary wording; numbers still only from the record.

## Hard rules

- **Read only on LinkedIn.** Never click Apply, Easy Apply, Save, Follow, Connect, or Message. Never fill a form. Applying is the person's step (the fenix-apply skill).
- **Human pace.** One tab for LinkedIn, one for company sites. No parallel page loads.
- **Stop immediately** and report on a captcha, "unusual activity" / restriction banner, or sign-in wall. Don't retry.
- **No paid API calls.** All judgment (comp, remote, fit, CV drafting) happens in this session.
- **Quote, don't paraphrase, evidence.** `compEvidence` and `remoteEvidence` are verbatim snippets from the page.
- **Never invent** salary numbers, remote policy, or résumé achievements.

## Bounds per run

≤ 6 LinkedIn searches · ≤ 2 result pages each · ≤ 40 job-detail reads (all sources) · ≤ 15 company-site visits · 1 Lenny's Jobs filter pass · 1 pass per remote-job board · the watchlist scan once. Stop when a bound is hit and say which.

## Preconditions

1. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3007/p/<p>/jobs` → `200`. If not, ask the person to start Fenix (`pnpm dev`); don't start it yourself.
2. Load the Claude in Chrome tools (one ToolSearch call: `tabs_context_mcp, tabs_create_mcp, navigate, get_page_text, find, read_page, computer, tabs_close_mcp`), call `tabs_context_mcp`, open a **new** tab. If several browsers are connected (one per Chrome profile), pick the one for this person.
3. **Right person signed in.** Open `https://www.linkedin.com/feed/` and read the signed-in member's name (the profile card or the "Me" menu). If it doesn't match `fullName` in `profile.yaml`, stop and say who is signed in. Never search from someone else's account.
4. Load canonical data once: `curl -s http://localhost:3007/api/p/<p>/canonical` — used for fit and drafting.

## Searches

LinkedIn (as of 2026-11-06) redirects `/jobs/search/` to `/jobs/search-results/` and drops `location`, `f_WT` and `f_E`. Use the new page directly:

`https://www.linkedin.com/jobs/search-results/?keywords=<q>&geoId=<geo>&f_TPR=r604800`

- `geoId` sets the location (the person's ids are in `hunt-profile.md`). Without a `geoId`, the page reuses the last location searched. `f_TPR=r604800` is the past week; `r2592000` is the past month.
- The remote filter does not stick, so on-site and hybrid roles appear. Check the work arrangement in every posting.
- The page may add the person's saved salary filter (`f_SAL=...`); that's fine to keep.
- Natural-language keywords work. Adding a country to a search set in another country is mostly ignored, so search from the person's own country first.

Queries: the person's `settings.queries`, in order. Each says the location, time window and keywords. The person may override them in their request; use theirs.

## Other sources (every run, after LinkedIn)

### Company watchlist (no browser)

`FENIX_HOME_MATCH='<pattern from hunt-profile.md>' FENIX_WATCHLIST_EXTRA='<settings.watchlistExtra, comma-separated>' OUT=.scratch/hunt/boards.json python3 .claude/skills/fenix-hunt/boards.py` reads every board in `watchlist.txt` plus the extras (Ashby, Greenhouse, Lever public APIs) and prints senior product/growth/AI roles with `sourceJobId`, location, a `home-mention` flag and posted pay. Full descriptions are in the JSON. Read each `home-mention=True` role (and any whose location says remote without a country) and judge it like a LinkedIn job. Save with `source` = `ashby` / `greenhouse` / `lever`, `sourceJobId` = the posting id, `url` = the posting URL. Pay from these boards is `compSource: "company_site"`. A slug that prints `NOT FOUND` has moved boards: find the new one or drop it from the list.

### Lenny's Jobs (browser, no login needed)

`https://www.lennysjobs.com/` (built on TrueUp). The filters don't go in the URL, so set them by clicking: Job category **Product Management** (the default), Level **4 - Director, 5 - VP, 6 - SVP/CXO** (or the levels matching `targetTitles`), Location: the person's country. With a country selected it also shows remote roles open to that country and global remote roles. Each card shows title, company, location, age and posted pay. Cards don't link to the posting, so find each role on the company's own board: `python3 .claude/skills/fenix-hunt/boards.py <slug>` (try the company name lowercased) and save it from there, with that board as `source`. If the company's board isn't Ashby, Greenhouse or Lever, open its careers page and save with `source: "company_site"` and the posting URL's id as `sourceJobId`. Add companies that keep showing up to `watchlist.txt`.

### Remote-job boards (browser, no login needed)

One pass each, after Lenny's Jobs. They list remote roles with posted pay and say which countries can apply, so they catch remote roles open to the person's country that LinkedIn buries. Pages read here count toward the job-detail and company-site bounds. The URLs and filters for the person's country are in `hunt-profile.md`; the boards are remote100k.com, Remote Rocketship and Sparc.

As with Lenny's Jobs, save each role from the company's own posting (its board via `boards.py`, or its careers page with `source: "company_site"`), never from the aggregator's page. Add companies that keep showing up to `watchlist.txt`.

### One job, one row

The same role often appears on LinkedIn and on the company board. Before saving a job from any source, run `GET /api/p/<p>/jobs?company=<name>`. If a stored row has the same title (ignoring punctuation and location suffixes), don't create a second one: update that row by re-posting with its `source` + `sourceJobId`, adding the better evidence (the company board's pay and location beat LinkedIn's).

## Per job

1. From the results list, collect job ids. Result cards have no `/jobs/view/` links; the id is the 10-digit number inside the `componentkey` attribute of each `div[role=button][componentkey]` card. Wait about 4s after navigating, then:
   `[...document.querySelectorAll('div[role=button][componentkey]')].map(d=>(d.getAttribute('componentkey').match(/\d{10}/)||[''])[0]).filter(Boolean)`
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
   - **Fit 0–100** against canonical and `targetTitles` (what to weigh is in `hunt-profile.md`). `whyGood`: 2–4 sentences naming the person's specific matching experience, with numbers only as they appear in their career record. `redFlags`: anything off (tiny company, crypto, heavy travel, equity-heavy comp, years-of-experience mismatch).
4. `POST http://localhost:3007/api/p/<p>/jobs` with:
   `source:"linkedin"`, `sourceJobId`, `url` (canonical `/jobs/view/<id>/`), `companyUrl` (careers page if visited), `company`, `title`, `locationText`, `compMin`, `compMax`, `currency` (USD, CAD, EUR or GBP — Fenix rejects others; for another currency, convert yourself, send USD with `compSource: "estimate"`, and put the original figure in `compEvidence`), `compSource`, `compEvidence`, `remoteVerdict`, `remoteEvidence`, `remoteEvidenceUrl`, `jdText` (full text), `fitScore`, `whyGood`, `redFlags`, `easyApply`, `applicants` (a number: "Over 100 applicants" → 100; Fenix rejects text).
   Fenix decides the stage. Read the response: `SHORTLISTED`, `FOUND` (needs a check), or `FILTERED_OUT`.

## Closed postings (every run, last)

1. **Company boards (no browser):** `pnpm check:closed <p> --write`. It asks Ashby, Greenhouse and Lever whether each job in Found, Shortlisted and CV ready is still posted (at most 60 requests) and flags the closed ones. Stages never change; the person decides.
2. **LinkedIn jobs (browser, at most 15 per run, counted in the job-detail bound):** open each LinkedIn job in those stages, oldest `lastSeenAt` first, and look for LinkedIn's notice that the job no longer accepts applications. **The exact wording isn't confirmed yet:** the first time you see a closed LinkedIn posting, quote the notice in the end-of-run report and add it here, and record nothing until then. Once the wording is here, a match is `PATCH /api/p/<p>/jobs/<id>` with `{"postingClosedAt":"<now ISO>","postingClosedEvidence":"LinkedIn: <the notice, quoted>"}`.

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
- counts per source (LinkedIn / Lenny's Jobs / remote boards / watchlist): new / already known (skipped) / shortlisted / found-needs-check / filtered out / CV ready
- postings flagged closed (company boards / LinkedIn), each with its job link
- one line per shortlisted or CV-ready job: company, title, base range + source, remote verdict, fit, link `http://localhost:3007/p/<p>/jobs/<id>`
- any bound hit or stop condition met
- anything about a site's page structure that differed from this skill (then update this file, or `docs/learnings/`)
