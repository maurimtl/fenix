# Posting recency

## Spec

*Status: approved by the owner in chat, 2026-11-13* ("spec plan build the recency spec"). The open questions below were resolved the same day; see the decisions at the top of the Plan.

**Problem / motivation.** Applying early raises the odds of a reply, and Fenix ignores when a job was posted. The hunt sees "17 hours ago" or "Reposted 1 week ago" on every LinkedIn posting and drops it; `jobInputSchema` and `jobSchema` have no field for it; `classify()` shortlists a five-week-old posting the same as one from this morning; the board and the hunt report order by pay and fit only.

Two things went wrong on 2026-11-13, when LinkedIn showed the owner jobs the hunts had never saved (Ascend "Principal Product Manager - Canada", reposted 5 days earlier; commonsku "AI Transformation Lead", 1 week old):

1. **Keywords.** No saved query contains "principal" or "product manager", so no hunt could surface Ascend.
2. **Depth and order.** The hunt read the first 25 results of each search in LinkedIn's default relevance order. commonsku's title matches two saved queries word for word and was not in the first 25 of either.

A third finding from the same day: LinkedIn's date is unreliable. Pacvue's "VP, AI Strategy & Delivery" showed "Reposted 1 day ago" on LinkedIn; its Greenhouse record says `first_published: 2026-10-05`, over five weeks old. Docker's Sandbox role showed "17 hours ago" and Ashby agrees (`publishedAt: 2026-11-12`).

**Scope.**

In:
- **A posting date on every job.** Three new optional fields, accepted by `POST /api/p/<p>/jobs` (`lib/jobs/schema.ts`) and stored in the job file (`jobSchema` in `lib/store/schemas.ts`):
  - `postedAt`: ISO date-time the posting went up.
  - `postedAtSource`: `board` (the company's Ashby, Greenhouse or Lever record) or `listing` (the age shown on LinkedIn or an aggregator, converted to a date when read).
  - `reposted`: true when the listing says "Reposted".
- **The board date wins.** In `upsertJob` (`lib/jobs/repo.ts`), a `listing` date never replaces a stored `board` date, and a later re-post never moves a stored date forward. A `board` date replaces a `listing` date.
- **`boards.py` reports the date.** It reads Ashby `publishedAt`, Greenhouse `first_published` and Lever `createdAt` (all three confirmed present in the public APIs on 2026-11-13), prints it per role, writes it to the JSON, and lists roles newest first.
- **Freshness scale**, computed from `postedAt` when shown (so it ages without a re-save):

  | Age | Label |
  |---|---|
  | up to 1 day | Today |
  | 2 to 7 days | This week |
  | 8 to 14 days | Edge |
  | 15 to 20 days | Old |
  | 21 days or more | Stale |
  | no date | Age unknown |

- **Stale jobs stay off the shortlist.** `classify()` (`lib/jobs/classify.ts`) takes the posting age and `fitScore`. A job that would be `SHORTLISTED` but is 21 days or older, with fit below `settings.strongMatchFit` (default 75), goes to `FOUND` with `stale` in `needsCheck`. It is not filtered out: he can still see it and move it. A job with no date is not penalized. Stages he set himself are never changed (existing rule).
- **Board and job page.** The job card (`components/job-card.tsx`) and the job page show the label and the age ("Today", "5 days · reposted", "Stale · 39 days"). The board's "Best match" order (`listJobs`) puts fresher jobs first among jobs with equal pay-confirmed status, before fit decides ties the other way round: order is pay confirmed, then freshness label, then fit.
- **Hunt skill (`.claude/skills/fenix-hunt/SKILL.md`).**
  - Read the age line from each posting's top card and send `postedAt`, `postedAtSource: "listing"` and `reposted`.
  - For a strong candidate or any "Reposted" job whose company uses Ashby, Greenhouse or Lever, look up the board date with `boards.py <slug>` and send that instead.
  - Run every LinkedIn search newest first, and read up to 100 results per search (was 25 read, 50 allowed).
  - Add a first pass limited to the past 24 hours across the saved queries, read before the weekly searches.
  - Open postings newest first, so the read limit is spent on fresh jobs.
  - Raise the per-run limits to fit (see open questions).
- **Hunt report.** New jobs listed newest first, each with its age and a "reposted" mark; stale ones in their own line at the end.
- **Checks.** `scripts/check-jobs.ts` covers the stale rule and the board-date-wins rule; `check:store` accepts the new fields.

Out:
- New saved queries for titles the current ones miss ("principal product manager", "forward deployed", "practice lead"). The owner passed on those roles for level and pay the same day, so the keyword gap is recorded here and left alone.
- Filtering old jobs out entirely (`FILTERED_OUT`). Stale is a flag, not a rejection.
- Backfilling dates on jobs that are closed or filtered out. (Open and applied jobs from Ashby, Greenhouse and Lever are backfilled: decided 2026-11-13.)
- Scheduling hunts to run daily on their own.
- Any change to `check:closed`, the Closed reasons or the pay and remote rules.

**Success criteria.**
1. `POST /api/p/<p>/jobs` with `postedAt`, `postedAtSource` and `reposted` returns 200 and the job file's front matter holds all three. Without them it still returns 200.
2. Posting the same job again with `postedAtSource: "listing"` and a later date leaves a stored `board` date unchanged; posting with `postedAtSource: "board"` replaces a stored `listing` date. `pnpm check:jobs` asserts both.
3. A job with confirmed pay above the floor, `country_ok`, fit 60 and `postedAt` 30 days ago comes back `FOUND` with `needsCheck: ["stale"]`. The same job with fit 80, or with `postedAt` 3 days ago, or with no `postedAt`, comes back `SHORTLISTED`. `pnpm check:jobs` asserts all four.
4. `python3 .claude/skills/fenix-hunt/boards.py docker` prints a posted date for each role and lists them newest first; `boards.json` has the date per role.
5. On `/p/<p>/jobs`, a card for a job posted yesterday shows "Today"; one posted 30 days ago shows "Stale · 30 days"; one with `reposted: true` shows "reposted"; one with no date shows "Age unknown". The job page shows the same line and whether the date came from the company board or the listing.
6. In the board's default order, of two pay-confirmed jobs in one column the fresher label is listed first.
7. A hunt run saves `postedAt` on every new LinkedIn job, reads up to 100 results per search, and its report lists new jobs newest first with ages. (Observed in a real run; depends on the open LinkedIn questions.)
8. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm check:store`, `pnpm check:jobs` and `pnpm check:data` pass, and existing job files (no date) still load.

**Approach.** Store one absolute date plus where it came from, and derive the label at display time. Recommended because the label keeps ageing after the job is saved, the board date can overrule LinkedIn's without losing the "reposted" signal, and old job files need no migration (all three fields optional).

Rejected:
- *Store the label or "days ago" as read.* It is wrong the next day and cannot be re-sorted.
- *Filter stale jobs out (`FILTERED_OUT`, reason `stale`).* Hides a strong but old role in a list he rarely opens; a wrong LinkedIn date would bury a good job silently.
- *Hunt-instructions only (sort newest, no stored field).* Fixes discovery but the board, the shortlist rule and later hunts still cannot tell fresh from stale.

Judgment calls made on his behalf:
- Stale starts at 21 days ("3 weeks is probably not great"); 15 to 20 days is labelled "Old" but not held back.
- "Strong fit" reuses `settings.strongMatchFit` (75) instead of adding a setting.
- A stale job goes to Found with a flag, not to Filtered out.
- A job with no date is treated as not stale.
- The rule applies when a job is saved or re-saved by a hunt. A shortlisted job that ages past 21 days is relabelled on the board but not moved.

**Open questions.**
1. **LinkedIn newest-first: not available (tested 2026-11-13).** `/jobs/search-results/` drops `sortBy=DD` from the URL and the cards are not in date order. The past-24-hours pass plus reading 100 results is the way to reach fresh jobs first.
2. **LinkedIn paging (tested 2026-11-13).** The page shows 25 cards with "Page 1", "Page 2" and "Next" controls. Whether a `start=` parameter also works was not tested; clicking the controls does.
3. **Past 24 hours filter: works (tested 2026-11-13).** `f_TPR=r86400` returned 36 results for head or VP of product in Canada, all posted within the day, and each card shows its age.
4. **Run limits (his decision).** 100 results on six searches is up to 600 result cards, against a limit of 40 postings opened per run. Proposed: keep triage on the card (title, company, location, pay, age), raise opened postings from 40 to 60, and keep six searches plus the 24-hours pass. More page loads per run raises the chance LinkedIn shows a challenge. OK, or a different number?
5. **Backfill (his decision).** Run a one-off that sets `postedAt` from the company boards for the stored jobs in Found, Shortlisted and CV ready that came from Ashby, Greenhouse or Lever (a handful of requests)? Recommended yes; LinkedIn-only jobs stay "Age unknown".
6. **Reposts with no company board.** For a LinkedIn "Reposted 5 days ago" on a company with no Ashby, Greenhouse or Lever board (Workday, own site), the true age is unknown. Proposed: store the repost date, mark `reposted`, and show "reposted" on the card so he reads it as "at least this old".
7. **Greenhouse `first_published` on re-opened requisitions.** A role closed and re-opened months later keeps its first date and would read as stale. `updated_at` is not a substitute (it changes on any edit). Proposed: accept it and let him override by moving the job; revisit if it misfires.

**Research notes.**
- Ashby posting API returns `publishedAt` per job: `https://api.ashbyhq.com/posting-api/job-board/<slug>` (checked on `docker`, 2026-11-13).
- Greenhouse board API returns `first_published` and `updated_at` per job: `https://boards-api.greenhouse.io/v1/boards/<slug>/jobs` (checked on `opswat`, `pacvue`, `helloheart`, 2026-11-13).
- Lever postings API returns `createdAt` in milliseconds: `https://api.lever.co/v0/postings/<slug>?mode=json` (checked on `distru`, 2026-11-13).
- Board dates for today's jobs: Docker Sandbox 2026-11-12, OPSWAT MFT 2026-11-10, Hello Heart 2026-11-02, Pacvue 2026-10-05.
- LinkedIn search page behaviour so far: `docs/learnings/linkedin.md`.

## Plan

**Decisions on the spec's open questions (2026-11-13).**
1. *Newest first.* LinkedIn has no date sort (`sortBy=DD` is dropped). The hunt reaches fresh jobs with a past-24-hours pass (`f_TPR=r86400`) and an under-10-applicants pass (`f_EA=true`, the filter the owner uses by hand), then reads 4 pages of each past-week query and opens candidates in order of the age printed on the card.
2. *Paging.* `start=25`, `start=50`, `start=75` work (25 cards a page), so pages are read by URL.
3. *Past 24 hours.* Works; used as the first pass.
4. *Run limits.* Opened postings go from 40 to 60. Triage stays on the card (title, company, location, pay, age).
5. *Backfill.* Yes, for jobs in Found, Shortlisted and CV ready whose source is Ashby, Greenhouse or Lever, through an explicit command with a dry run.
6. *Reposts with no supported board.* Store the repost date with `reposted: true`; the card says "reposted".
7. *Greenhouse `first_published` on re-opened roles.* Accepted; he overrides by moving the job.
8. *Stale rule.* 21 days; strong fit is `settings.strongMatchFit` (75); a stale would-be-shortlisted job goes to Found with `stale` in `needsCheck`; an already shortlisted job that ages past 21 days is relabelled on the board, not moved.
9. *Where "Age unknown" sorts (new, mine).* In the board's default order it ranks with "Edge": behind Today and This week, ahead of Old and Stale. Nearly every stored job is undated today, and the spec says an undated job is not penalized.

**File map**

| Path | Responsibility | |
|---|---|---|
| `lib/jobs/freshness.ts` | Pure rules: age in days, freshness label and rank, the card line, which posting date wins on a re-save | new |
| `lib/jobs/schema.ts` | `postedAt`, `postedAtSource`, `reposted` on the job input | modified |
| `lib/store/schemas.ts`, `lib/store/jobs.ts` | The three fields in the job file and on the loaded job | modified |
| `lib/jobs/classify.ts` | Stale rule | modified |
| `lib/jobs/repo.ts` | Merge the date on upsert, classify on the merged date, default board order, `setPostedFromBoard` | modified |
| `lib/jobs/format.ts` | Label for the `stale` check | modified |
| `lib/jobs/posted-date.ts` | Ask a company board for a posting's date (Ashby, Greenhouse, Lever) | new |
| `components/job-card.tsx`, `app/p/[profile]/jobs/[id]/page.tsx`, `app/globals.css` | Show the age line | modified |
| `scripts/backfill-posted.ts`, `package.json` | `pnpm backfill:posted <profile> [--write]` | new / modified |
| `scripts/check-jobs.ts`, `scripts/check-store.ts` | Assertions for the rules and the new fields | modified |
| `.claude/skills/fenix-hunt/boards.py` | Posted date per role, newest first | modified |
| `.claude/skills/fenix-hunt/SKILL.md`, `docs/learnings/linkedin.md`, `CLAUDE.md` | Hunt procedure, LinkedIn facts, the new command | modified |

**Tasks**

1. **Rules and fields, end to end through the API.** Add `lib/jobs/freshness.ts` (`postingAgeDays`, `freshness`, `FRESHNESS_RANK`, `ageLine`, `mergePosted`, `STALE_DAYS = 21`). Add the three fields to `jobInputSchema` (`postedAt` an ISO date-time with offset; `postedAt` and `postedAtSource` required together; a date more than 2 days in the future refused), to `jobSchema`, and to `toJob`. In `upsertJob`, merge with `mergePosted` and write the merged values after `Object.assign` so an explicit `null` from a caller cannot wipe a stored date.
   - Reuse: none for age maths (grepped `86_400_000`: only `noReplyDays`, which counts stage days).
   - Writes: runs inside the existing profile lock; a retry or double post re-merges to the same values (the merge is idempotent: earliest date within a source rank, board over listing, `reposted` sticky).
   - Edges: no date → nothing stored, label "Age unknown"; malformed date → 400 from zod; date in the future by clock skew up to 2 days → age 0.
   - Verify: `pnpm check:jobs` (new merge cases with literal dates) and a `curl` POST to a scratch profile showing the three fields in the file (criterion 1, 2).
2. **Stale rule.** `classify(facts, settings, now = new Date())` takes `postedAt` and `fitScore` in the facts and `strongMatchFit` (optional, default 75) in the settings. When nothing else needs a check, age ≥ 21 days and fit < strong (a missing fit counts as below), return `FOUND` with `needsCheck: ["stale"]`. `upsertJob` classifies on the merged date inside the lock. Add "Posted over 3 weeks ago" to `CHECK_LABEL`.
   - Surfaces: only `upsertJob` calls `classify` (grepped). Stages set by the person are untouched (existing `reclassify` guard).
   - Verify: `pnpm check:jobs`, four literal cases from criterion 3 plus "fit missing and stale → Found" and "stale but comp unknown keeps comp_unknown only".
3. **Board and job page.** `listJobs` orders by pay confirmed, then `FRESHNESS_RANK`, then fit. `JobCard` shows `ageLine` under the stage date; the job page gets a "Posted" fact with the line, the date and "from the company's board" or "from the listing".
   - Verify: `pnpm check:jobs` for the order and the four card lines (criterion 5, 6) as pure-function cases; `pnpm exec tsc --noEmit`; manual: open `/p/<p>/jobs` (he runs the dev server; a browser check is his or the main session's).
4. **`boards.py`.** Each role carries `postedAt` (Ashby `publishedAt`, Greenhouse `first_published`, Lever `createdAt` ms → ISO); printed as a date; roles listed newest first per company; written to the JSON.
   - Bounds: unchanged (one request per board).
   - Verify: `python3 .claude/skills/fenix-hunt/boards.py docker` prints dates in descending order (criterion 4).
5. **Backfill command.** `lib/jobs/posted-date.ts` reuses `slugCandidates` from `liveness.ts` and asks the board for one posting's date. `scripts/backfill-posted.ts` lists what it would set for open board jobs with no board date (dry run by default, at most 60 requests, like `check:closed`); `--write` stores them through `setPostedFromBoard` in the repo (profile lock, one data commit per job, stage untouched).
   - Writes: re-running finds nothing left to set. Reversible with `git revert` in `data/`.
   - Verify: dry run, then `--write`, then a second dry run reporting 0 to set.
6. **Hunt procedure.** Rewrite the Searches, Bounds, Per job and End-of-run sections of the hunt skill for the decisions above, including reading the age from the card (`Posted 18 hours ago`, `Reposted 1 day ago`), converting it to a date, and the board-date lookup for strong candidates and reposts. Record the LinkedIn facts in `docs/learnings/linkedin.md`; add the command to `CLAUDE.md`.
   - Verify: read-through against the spec's hunt bullets; criterion 7 needs a real hunt run (not part of this build).
7. **Checks.** `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm check:store` (sample job gains the fields), `pnpm check:jobs`, `pnpm check:data` (existing undated job files still load).

**Premises** (grepped 2026-11-13)
- `lib/jobs/repo.ts` — `upsertJob` is the only caller of `classify`; it spreads the input into the job record.
- `lib/store/schemas.ts` — `jobSchema` is a `looseObject`, so undated files load unchanged; `optIsoDate` accepts a full ISO date-time.
- `lib/store/jobs.ts` — `toJob` is the one place a job file becomes the object pages use.
- `lib/jobs/liveness.ts` — `slugCandidates` and `isBoardSource` are exported.
- `scripts/check-jobs.ts` — pure assertions, no data folder; `classify(input, { floorUsd })` is called with two arguments, so the new settings field and `now` must be optional.
- `components/job-card.tsx` — receives `now` already.

**Risks / unknowns**
- LinkedIn's card age wording could change; the skill says to store no date when the line is missing or unreadable rather than guess.
- A listing date is approximate ("2 weeks ago" is 14 to 20 days). Stored as now minus the stated span; the board date replaces it when the company uses a supported board.
- More page loads per hunt (up to 4 pages on six queries plus two extra passes) raise the chance of a LinkedIn challenge; the stop rule is unchanged.
- The dev server hot-reloads these files while he uses the app; the change is additive (optional fields).

**Not yet specified**
- Criterion 7 (a real hunt run saving dates and reporting by age) is observed on the next hunt.

**Out of scope**
- New saved queries, daily scheduling, filtering stale jobs out, backfilling closed or filtered-out jobs: as in the spec.

**Robustness review.** Not run by separate agents: this plan was written in a session that could not start them. I checked the premises above by grep myself; the plan-shape review is owed if he wants one.

## Status

Build run 2026-11-13 in one session, without commits (the owner asked for the working tree to be left for review) and without the browser.

- done: task 1 (fields, merge, API): `pnpm check:jobs` 77/77; against a throwaway profile on the running app, a POST with a board date of 2026-10-05 stored all three fields, a re-POST with a later listing date and `reposted` left the board date and set `reposted: true`, a later board date replaced a 3-day-old listing date, a POST with no posting fields returned 200, and a date without its source returned 400.
- done: task 2 (stale rule): the four cases of criterion 3 plus five edge cases pass in `check:jobs`; on the running app the fit-60 job dated 2026-10-05 came back `FOUND` with `stale`, the fit-80 one `SHORTLISTED`.
- done: task 3 (board and job page): rendered HTML for the throwaway profile showed "Today · reposted", "Age unknown", "Stale · 39 days", "Stale · 39 days · reposted" on cards and "from the company's board" on the job page; the Shortlisted column listed today, undated, stale in that order. The order is `bestMatchOrder` in `lib/jobs/freshness.ts` (a small addition to the plan so it could be tested without the data folder). Not looked at in a real browser.
- done: task 4 (`boards.py`): `docker`, `opswat` and `distru` print `posted <date>` and list newest first; the JSON carries `postedAt`.
- done: task 5 (backfill): `pnpm backfill:posted <person>` found 1 open board job (AIOS Product Expansion Lead, 2026-11-02); `--write` set it (data commit 3e58346); a second dry run found 0. The lookup has stubbed-board cases in `check:liveness` (file added to the plan's map).
- done: task 6 (hunt procedure): SKILL.md, `docs/learnings/linkedin.md`, CLAUDE.md.
- done: task 7 (checks): `pnpm lint` clean, `pnpm exec tsc --noEmit` clean, `check:store` 20 passed, `check:jobs` 77/77, `check:data` ok (314 files), `check:liveness` and `check:isolation` pass. `check:public` still fails on `docs/plans/hunt-coverage.md`, a file from another session.
- backfill widened to applied jobs (owner's decision, 2026-11-13): a run dated 21 of 23 open and applied board jobs; two had no date on their board.
- review: `/code-review` over both builds' uncommitted files. Fixed: a re-save that sends no fit score now classifies on the stored one (checked on a throwaway profile: fit 90, posted 2026-10-01, re-saved without a fit, stayed Shortlisted); a 1-day-old posting reads "1 day", not "Today"; one mis-indented line. Left as designed: the backfill never moves a stage, an earlier board date wins over a later one, undated cards say "Age unknown".
- not done: a browser pass over the board; criterion 7, which needs a real hunt run.
