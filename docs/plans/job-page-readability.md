# Job page readability

## Spec

*Status: approved 2026-11-15*

### Problem / motivation

The job page is where Mauricio decides whether to apply, and today he has to leave it to decide.

- **"Why it fits" and "Watch out for" are one paragraph each.** The hunt writes several separate points (level, pay, location, domain gap, posting age) into one run of sentences, and the page prints it as one `<p>`. He asked on 2026-11-15 for bullets, with short headlines where they help.
- **The saved job description is a block of text.** The page prints it in a `<pre>`. When the hunt saves the posting with its line breaks it is readable but long; when it saves an excerpt (as the 2026-11-14 hunt did for 15 jobs, to save reading cost) it is a single flat paragraph with the headings and bullets gone.
- **There is no summary.** To learn what the role owns, who it reports to and what it requires, he opens the posting on the company's site.

### Scope

In:
- The job page (`app/p/[profile]/jobs/[id]/page.tsx`): fit notes as a list, the description in a collapsible section with its formatting, a short role summary above it.
- What the hunt and apply skills save: fit notes one point per line, the full posting with its structure, a role summary.
- Getting the full posting without the hunt session reading it, for jobs on Ashby, Greenhouse and Lever.
- A one-off pass over open jobs (Found, Shortlisted, CV ready) to bring them to the new format.

Out:
- Job cards on the pipeline board. They do not show these fields.
- Rewriting closed, filtered-out or applied jobs. They keep working as they are.
- Any paid API call. The summary and fit notes are written in the Claude Code session, as now.
- Changing how fit is scored.

### Success criteria

1. A job whose `whyGood` has three lines shows three bullets under "Why it fits"; a line written `Pay: reaches his floor at the top of the band` shows "Pay" in bold followed by the text. Same for "Watch out for".
2. A job saved before this change (one paragraph, no line breaks) still shows its text, as a single paragraph, with nothing lost.
3. "Job description" is closed by default and opens on click. Open, a posting with headings and bullet lists shows headings as headings and bullets as bullets.
4. A job with a role summary shows it above the description without any click: at most six bullets covering what the role owns, who it reports to, the team, and the must-have requirements.
5. A job with no summary shows the description section only; the page does not print an empty heading.
6. For a job whose source is Ashby, Greenhouse or Lever, one command (or the save itself) stores the full posting, with headings and bullets, without the text passing through the session. Check: the stored body of an Ashby job matches the board's own description.
7. After a hunt, no newly saved job has a body that starts with "(Excerpt.)". Check: `grep -L` over the jobs saved in that run.
8. The hunt skill and the apply skill say how to write the three fields, with one example each.
9. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm check:data`, `pnpm check:jobs` and `pnpm check:hunt` pass.
10. Checked in the browser on three real jobs: one new-format, one old flat one, one with a long posting.

### Approach

Recommended: **keep the three text fields, agree a light format for them, and render it.**

- **Fit notes.** `whyGood` and `redFlags` stay plain text. The convention becomes one point per line, optionally starting with a short label and a colon (`Level:`, `Pay:`, `Location:`, `Domain gap:`, `Posting age:`). The page splits on line breaks, draws a list, and bolds a leading label. A value with no line breaks is drawn as one paragraph, which covers every existing job.
- **Description.** The body of the job file holds the posting as light Markdown: blank lines between paragraphs, `## ` for the posting's own section headings, `- ` for its bullets. The page renders it with `react-markdown` (already a dependency) inside a `<details>` element. Plain text with line breaks renders acceptably through the same path.
- **Summary.** A new optional field, `jdSummary`, plain text in the same one-point-per-line form, written by the session that judges the job. It is printed above the description.
- **Full posting without reading cost.** Fenix fetches the description itself for board-backed jobs (the Ashby, Greenhouse and Lever requests already exist in `lib/jobs/liveness.ts` and `lib/jobs/posted-date.ts`, for `check:closed` and `backfill:posted`) and converts the HTML to the light Markdown above. For LinkedIn-only jobs the hunt's in-page script builds the same light Markdown from the posting's DOM and the session passes it through, as it does today with plain text.

Judgment calls made here:
- Labels are a convention, not a fixed list. The skills name the usual five; the page bolds whatever precedes the first colon when it is three words or fewer.
- The description is closed by default, because the summary is meant to be enough.
- Open jobs are converted once; everything else is left alone.

Rejected:
- **Structured fields** (lists of label and text in the schema): a schema change and a migration for every job file, for the same result on screen.
- **Page-only formatting** (split the existing paragraphs into sentences, guess headings in the description): no change to what is saved, but it guesses wrong on real text ("U.S.-based", "25%. The pay band") and does nothing for flat excerpts.

### Open questions (for the plan)

- Whether the board fetch runs inside the save route, or as a separate command the hunt calls after saving (`pnpm fenix fetch-jd <person>`).
- How Workday, Workable, SmartRecruiters, Recruitee and Rippling jobs get their full text: `scan.py` already downloads descriptions for these, so the scan may be able to hand them to Fenix directly.
- The in-page DOM-to-Markdown script for LinkedIn postings: which elements LinkedIn uses for headings and lists in "About the job" (to be read from a live posting, not assumed).
- Whether `jdSummary` should be capped (length, number of lines) in the schema.
- The one-off pass: 2026-11-15 there are few open jobs; the plan should count them first.

### Research notes

- `app/p/[profile]/jobs/[id]/page.tsx` lines 102–141: the three sections as drawn today.
- `app/globals.css` lines 310 and 315: `.prose` and `.jd` already keep line breaks (`white-space: pre-wrap`).
- `lib/jobs/schema.ts` lines 36–39: `jdText` up to 60,000 characters, `whyGood` and `redFlags` up to 4,000.
- `lib/jobs/repo.ts` lines 29–72: the description is the Markdown body of the job file; a re-save without `jdText` keeps the stored body.
- `package.json`: `react-markdown` 10.1.0 is installed.
- No earlier plan in `docs/plans/` covers the job page's content sections.

## Plan

*Written 2026-11-15. One change from the spec's approach is stated under "Decisions on the spec's open questions"; the scope and success criteria are unchanged.*

### Decisions on the spec's open questions

- **Where the full posting comes from.** The spec proposed that Fenix fetch it for Ashby, Greenhouse and Lever. The plan uses the hunt scanner instead: `scan.py` and `boards.py` already download the description for every board type they read (eight, not three) and write it to `scan.json` / `boards.json`. A small helper in the hunt skill posts a role to Fenix straight from that file, adding the fields the session wrote. The text never passes through the session, criterion 6 is met for more boards, and no second copy of the board requests is written in TypeScript.
- **Workday, Workable, SmartRecruiters, Recruitee, Rippling:** covered by the same helper.
- **`jdSummary` cap:** 1,500 characters, at most 8 lines. The page shows the first 6.
- **One-off pass:** when the plan was written there was one open job (Edward Jones). It was applied to the same day, so no open job is left to convert; task 9 converts the Edward Jones job anyway as the worked example. Applied, closed and filtered-out jobs are otherwise left as they are.
- **LinkedIn postings:** still passed through the session, because there is no board file for them. Task 7 changes the in-page script so the text keeps its headings and bullets.

### File map

| Path | Responsibility | New / modified |
|---|---|---|
| `lib/jobs/notes.ts` | Turn a fit-notes string into list items; cap the summary at six | new |
| `components/fit-notes.tsx` | Draw fit notes as a list, or one paragraph for old one-line values | new |
| `app/p/[profile]/jobs/[id]/page.tsx` | Use `FitNotes`; print the summary; put the description in a closed `<details>`, as Markdown only when the job says so | modified |
| `app/globals.css` | Styles for the notes list, the summary and the collapsible description | modified |
| `lib/jobs/schema.ts` | Accept `jdSummary` and `jdFormat` on save | modified |
| `lib/store/schemas.ts` | `jdSummary` and `jdFormat` on the stored job | modified |
| `lib/store/jobs.ts` | Pass both through `toJob` | modified |
| `scripts/check-jobs.ts` | Assertions for `parseNotes`, `summaryItems` and the two new schema fields | modified |
| `.claude/skills/fenix-hunt/hunt_core.py` | `html_to_md`; `role()` derives `text` and `jd` from one description; `merge()` carries `jd` | modified |
| `.claude/skills/fenix-hunt/hunt_ats.py` | Parsers and `*_detail` functions hand the description to `role()` / set `jd` | modified |
| `.claude/skills/fenix-hunt/post_job.py` | Post one role from `scan.json` / `boards.json` to Fenix with the session's judgment fields | new |
| `.claude/skills/fenix-hunt/test_scan.py` | Tests for `html_to_md`, `jd` on each board, and the body `post_job.py` builds | modified |
| `.claude/skills/fenix-hunt/SKILL.md` | How to write the three fields; `post_job.py`; the LinkedIn script that keeps structure; no excerpts | modified |
| `.claude/skills/fenix-apply/SKILL.md` | One paragraph: a job it re-saves follows the same field format | modified |
| `docs/architecture.md`, `docs/learnings/linkedin.md` | The body format and `jdSummary`; LinkedIn's posting elements | modified |

### Tasks

1. **Fit notes as a list.** Add `parseNotes(text)` in `lib/jobs/notes.ts`: split on line breaks, drop empty lines and a leading `- ` or `• `. **A value with one line is returned as one unlabelled item, whatever it contains**, so every existing job is drawn as the paragraph it is today. With two or more lines, each item is `{ label, text }`, where `label` is the part before the first `: ` when it is three words or fewer and under 30 characters, otherwise `null`. Add `components/fit-notes.tsx` (one unlabelled item draws the existing `<p className="prose">`; otherwise a `<ul>` with the label in `<strong>`) and use it for "Why it fits" and "Watch out for".
   - Reuse: none; grepped `split("\n")` and `prose` in `components/` and `lib/jobs/`.
   - Edges, asserted in `scripts/check-jobs.ts` with literal expected values: a one-line value starting `Pay: …` stays one unlabelled item; two lines give two items; `Pay: reaches his floor` gives label `Pay`; a line starting `https://example.com` has no label; a colon after 40 characters gives no label; Windows line endings; a line of only spaces is dropped; accented text survives.
   - Known tradeoff: the label is read by a rule, not stored as a field. The spec chose this over a schema change.
   - Verification: `pnpm check:jobs` passes with the new cases. Commit.

2. **`jdSummary` and `jdFormat` saved; summary shown.** Add `jdSummary: text(1500).nullish()` and `jdFormat: z.enum(["md"]).nullish()` to `jobInputSchema`; `jdSummary: optStr` and `jdFormat` to `jobSchema`; both to `toJob`. Add `summaryItems(text)` to `lib/jobs/notes.ts`: `parseNotes` cut to the first six items. On the page, print the summary with `FitNotes` under the "Job description" heading; the heading is drawn when there is a summary or a description, and not otherwise.
   - Writes: `upsertJob` merges with `Object.assign(d, facts, …)`: an omitted `jdSummary` keeps the stored one, `null` clears it (confirmed by review against `lib/jobs/repo.ts:67`).
   - Tests: `scripts/check-jobs.ts` has no `upsertJob` scaffolding, so it asserts at the schema level only (a body with `jdSummary` and `jdFormat` parses and keeps them; an 8-line summary gives six items). The merge is checked once by hand: `pnpm fenix create-profile --scratch`, two `curl` saves (with, then without `jdSummary`), read the file, `remove-scratch`.
   - Surfaces: the save route takes the schema as is; `pnpm check:data` reads `jobSchema` (a loose object, so older files stay valid); job cards do not show these fields.
   - Verification: `pnpm check:jobs`, `pnpm check:data`, `pnpm exec tsc --noEmit` pass, and the hand check above. Commit.

3. **Description in a collapsible section, two renderers.** Inside "Job description", wrap the body in `<details className="jd-wrap">` with `<summary>Show the full posting</summary>`. When `job.jdFormat === "md"`, draw it with `Markdown` (`components/markdown.tsx`: raw HTML shown as text, links open in a new tab). Otherwise keep today's `<pre className="jd">`, so plain-text bodies saved before this change are never read as Markdown.
   - Edges: a 60,000-character body opens without the page hanging; `.md` heading sizes (`app/globals.css` line 418 on) are scoped down inside `.jd-wrap` so a posting's headings do not outrank the page's.
   - Verification: manual, in the browser on port 3007: the Autodesk AEC Data job (flat excerpt, no flag) and the Cohere job (plain text with line breaks, no flag) look as they do today once opened; both are closed on load. Commit.

4. **Posting HTML to light Markdown, list-call boards.** Add `html_to_md(html)` to `hunt_core.py`, built on the standard library's `html.parser.HTMLParser`: `h1`–`h6` become `## `, `li` becomes `- `, `p`, `div`, `br`, `ul`, `ol` become line breaks, a paragraph that is only bold text becomes a `## ` heading, other tags are dropped, entities are unescaped, runs of blank lines collapse to one, and text that would start a line with `#`, `-`, `*`, `>` or `1.` is backslash-escaped. `role()` takes the description once and derives both `text` (via `strip_html`, unchanged) and `jd`; `merge()` adds `jd` to the fields it copies. Greenhouse, Lever, Recruitee and Amazon pass their HTML; Ashby passes `descriptionHtml` when the listing offers it and `descriptionPlain` otherwise.
   - Bounds: `jd` is cut at 60,000 characters, the save schema's limit.
   - Edges, in `test_scan.py` against the existing fixtures with literal expected strings: nested lists, a heading inside a `div`, `&nbsp;` and `&mdash;`, a posting with no tags, an empty description, Greenhouse's once-escaped `content`, and text containing `C#`, `5*`, `snake_case` and `$209,040—$296,140` coming through unchanged.
   - Verification: `pnpm check:hunt` passes. Commit.

5. **Detail boards.** Workable, SmartRecruiters, Rippling and Workday set `text` in their `*_detail` functions, and only for the first 15 kept roles (`MAX_DETAILS`). Each `*_detail` also sets `jd`. Expose one function, `fetch_detail(role)`, that runs the right `*_detail` for a single role, for task 6.
   - Verification: `pnpm check:hunt` passes with a `jd` assertion per detail fixture (`workable_detail.json`, `smartrecruiters_detail.json`, `rippling_detail.json`, `workday_detail.json`). Commit.

6. **Post a role from the scan file.** Add `post_job.py`: `python3 post_job.py --profile <p> --key <source:id> [--from <file>] --json '<fields>' [--dry-run]`. It reads the role by key, calls `fetch_detail` when the role has no `jd` (a detail-board role past the cap), builds the save body from the role's facts (`source`, `sourceJobId`, `url`, `company`, `title`, `locationText`, `postedAt` with `postedAtSource: "board"`, `jdText` from `jd`, `jdFormat: "md"`), overlays the session's fields, posts to `http://localhost:3007/api/p/<p>/jobs`, and prints the stage Fenix returned.
   - Writes: the save route dedupes on `source` + `sourceJobId` under the profile lock, so a retry updates the same job.
   - Edges: an unknown key exits non-zero, names the file, and says to run `boards.py <company>` and retry with `--from boards.json` (a full scan leaves out roles already marked seen; a lookup does not); a role whose `source` is a feed is refused with the reason; a body that is empty or starts with `(Excerpt` is refused; Fenix not running prints the address it tried.
   - Bounds: one role per call, at most two requests, 20-second timeouts.
   - Verification: `pnpm check:hunt` compares the `--dry-run` body to a literal. Then one real run for an Ashby role into a scratch profile, and a comparison of the stored body with the board's own description for that role, ignoring whitespace (criterion 6). Commit.

7. **LinkedIn postings keep their structure.** Read the DOM of two live LinkedIn postings in Chrome (one with headings and lists, one plain) and write the in-page script for "Per job" step 2 so it returns light Markdown, saved with `jdFormat: "md"`. Record the elements it relies on in `docs/learnings/linkedin.md`. The plain-text script stays as the fallback, saved without the flag.
   - Verification: manual: run the script on both postings; the `<pre>` it leaves shows headings and bullets, and no sentence of "About the job" is missing. Commit.

8. **Skill text.** In `fenix-hunt/SKILL.md`: a "How to write the fit notes and the summary" section with the format and one example of each field; "Per job" and the script-sources section say to save board roles with `post_job.py`; a hard rule that a saved description is the whole posting or nothing, never an excerpt; save before `--mark-seen`. In `fenix-apply/SKILL.md`: one paragraph pointing to that section.
   - Verification: manual read of both files for contradictions; `grep -n -i excerpt .claude/skills/fenix-hunt/SKILL.md` shows only the rule. Commit.

9. **Convert the open job, document, final checks.** Rewrite the Edward Jones job's `whyGood` and `redFlags` as labelled lines and add a `jdSummary`, through the save route. Add two short paragraphs to `docs/architecture.md`. Save one board role with `post_job.py` into the real profile if a hunt turns one up; otherwise use the scratch run from task 6.
   - Verification: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm check:data`, `pnpm check:jobs`, `pnpm check:hunt` pass. Manual, criterion 10: three real jobs in the browser, named in the Status section: Edward Jones (new format, with summary), Autodesk AEC Data (old flat excerpt), and the scratch Ashby role or a new board role (Markdown body). Criterion 7: no job saved after this build has a body starting `(Excerpt`. Commit.

### Premises

- `components/markdown.tsx` — exports `Markdown({ text })` on `react-markdown` with `remark-gfm`; raw HTML is shown as text. (Review: holds.)
- `app/p/[profile]/jobs/[id]/page.tsx` — is the only place `whyGood`, `redFlags` and `jdText` are drawn. (Holds.)
- `lib/jobs/repo.ts` `upsertJob` — keeps a stored field when a re-save omits it and clears it on `null`; keeps the stored body when `jdText` is absent or null. (Holds.)
- `lib/jobs/schema.ts` `jobInputSchema` — is not strict; unknown keys are dropped silently, so `jdSummary` and `jdFormat` must be added to be stored. (Holds.)
- `lib/store/schemas.ts` `jobSchema` — is a loose object. (Holds.)
- `.claude/skills/fenix-hunt/hunt_core.py` — `role()` builds every role record; `merge()` copies a fixed list of fields (`comp`, `postedAt`, `loc`, `text`). (Holds.)
- `.claude/skills/fenix-hunt/hunt_ats.py` — Greenhouse, Lever, Recruitee and Amazon have the description in the list call; Workable, SmartRecruiters, Rippling and Workday get it from a detail request capped at 15 roles. (Corrected by review.)
- `scan.py` — writes the printed roles to `OUT`, leaving out roles marked seen; a `boards.py` lookup leaves nothing out. (Holds.)
- `scripts/fenix.ts` — has `create-profile --scratch` and `remove-scratch`. (Holds.)
- `scripts/check-jobs.ts` — is a plain assert script with no data-directory scaffolding. (Corrected by review.)

### Risks / unknowns

- **Markdown mangling a posting.** Limited to bodies written by `html_to_md` or the LinkedIn script, which escape line-leading markup; old bodies are not rendered as Markdown at all.
- **Ashby may only offer plain text in the listing call.** Then Ashby bodies have line breaks but no headings. Task 4 checks the fixture and a live board; if there is no HTML field, Ashby bodies are saved without the `md` flag and drawn as plain text.
- **No on-demand fetch from the app.** Because the description comes from the scanner's files, an existing job cannot be refreshed from the page or by `pnpm fenix`; it needs a `boards.py` lookup and `post_job.py`. A TypeScript fetcher would allow that and is left out to avoid a second copy of the board requests. Accepted for now.
- **Stale rows.** Jobs saved on 2026-11-14 with "(Excerpt.)" bodies stay that way; twelve of the fifteen are filtered out or closed.
- **LinkedIn's DOM changes.** Task 7's script may break later; the plain-text fallback stays.

### Not yet specified

- Whether Ashby's listing carries `descriptionHtml` (task 4 reads it).
- The elements LinkedIn uses inside "About the job" (task 7 reads them).

### Out of scope

- Job cards on the board: they do not show these fields.
- A TypeScript fetcher for board descriptions: see Risks.
- Rewriting applied, closed or filtered-out jobs: no decision is pending on them.
- Summaries written by a paid API call: all judgment stays in the session.

### Research notes

- `react-markdown` 10.1.0 and `remark-gfm` 4.0.1 are installed and used by `components/markdown.tsx`.
- `app/globals.css` line 418 on: `.md` styles for headings and lists exist; `.jd` (line 315) is the current box.
- `scripts/check-store.ts` lines 7–8 show how a script sets `FENIX_DATA_DIR` before a dynamic import, if scaffolding is wanted later.
- 2026-11-15 stage counts: 1 CV ready, 52 applied, 2 interviewing, 65 closed, 121 filtered out.

### Robustness review (2026-11-15)

Two fresh reviewers read the spec, the plan and the code. Their findings are folded into the tasks above.

- **Reconstruction smell — was PATCHWORK, fixed.** The first draft assumed every board parser had the description in hand; four boards fetch it separately and only for 15 roles, and `merge()` would have dropped the new field. Tasks 4–6 now cover this.
- **Bolt-on vs best practice — was PATCHWORK, fixed.** Old plain text is no longer pushed through the Markdown renderer; a `jdFormat` flag picks the renderer. `html_to_md` uses the standard HTML parser. The label rule for fit notes stays a heuristic, named as a tradeoff.
- **Mismatched profiles — was PATCHWORK, fixed.** Same change: two body formats, two renderers.
- **Cross-boundary reach — ROBUST.** Nothing in `app/` or `lib/` imports from `scripts/` or the skills.
- **Altitude — named.** The plan uses the scanner's files instead of a TypeScript fetcher; the cost (no refresh from the app) is under Risks.
- **Task quality — fixed.** The scanner work is split in two; the LinkedIn script comes before the skill text that describes it; one-line fit notes are never split; the section heading matches the spec; criteria 4, 6, 7 and 10 each have a named check.

## Status

- build started 2026-11-15 from e9aabd8, in session. Premises: checked against the code by the plan review the same day; no change since.
- in-progress: task 1
- done: task 1: check:jobs 85/85 (7 new fit-notes cases), tsc clean, 93d21a4
- in-progress: task 2
- done: task 2: check:jobs 89/89 (4 new), check:data ok, tsc clean; by hand in a scratch profile a re-save without jdSummary kept the stored one and the page drew the summary as a labelled list, 02da8ae
- in-progress: task 3
- done: task 3: tsc and lint clean; served HTML checked: a Markdown body renders h2 and ul inside a closed details, a plain-text body (Cohere) still renders in pre.jd, f6ce663
- in-progress: task 4
- done: task 4: check:hunt 89/89 (19 new). Amendments: role() takes the Markdown as a separate jd argument instead of deriving both forms from one description, because Lever and Amazon build text from several fields; bullets typed as text become bullets and numbered lines are left alone (the plan said to escape both); Ashby's listing does carry descriptionHtml, so Ashby bodies are Markdown, 5171267
- in-progress: task 5
- done: task 5: check:hunt 96/96 (7 new). Kept roles from a detail board now carry the board, slug and extra needed to fetch one description later, and Workday roles past the cap keep their path; html_to_md drops a tag the source cut off, 640e39c
- in-progress: task 6
- done: task 6: check:hunt 105/105 (9 new, incl. links). Real run: 1Password's Senior Director, Product Security saved from boards.json into a scratch profile; the stored body matches the board's own description letter for letter (10,827 letters), carries jdFormat md, and a re-save without jdSummary kept the summary. Amendment: html_to_md keeps link addresses, which the first comparison showed were being dropped, b8a2267
- in-progress: task 7
- done: task 7: run on two live postings (Cohere: 8 headings, 34 bullets; Aria InsurTech: 8 headings, 37 bullets); in both the output's letters equal the page's own text for the section. Amendment: the script lives in its own file, .claude/skills/fenix-hunt/linkedin_posting.js (added to the file map), so the session pastes it instead of retyping it, d81f13d
- in-progress: task 8
- done: task 8: both skill files read through; 'excerpt' appears in the hunt skill only in the new hard rule; every boards.py call in the skill now sets OUT so no boards.json lands in the repo root, a8660ea
- in-progress: task 9
- done: task 9: Edward Jones job converted through the save route (stage, CV link and answers kept; 3 fit lines, 3 watch-out lines, 5 summary lines); architecture doc updated; lint, tsc, check:data, check:jobs 89/89, check:hunt 105/105 pass; no job saved since the build started has an excerpt body, e455edc
- review: 10 findings, 10 fixed, bca5cff. (1) a plain-text re-save left a stale jdFormat md; (2) post_job.py saved the board's slug as the company when --json had none; (3) a Lever posting with null lists crashed the parser; (4) Ashby HTML that converted to nothing was still marked Markdown; (5) the posting's own *, `, [ ], word-edge _ and leading + were not escaped, nor parentheses in link addresses; (6) a failed Workday detail request lost the role's path; (7) every listed role was converted before the title filter, now only kept roles are; (8) post_job.py blamed a seen role when the scan file was simply missing; (9) older multi-line prose notes would have been split into bullets; (10) the LinkedIn script threw on a page with no posting.
- browser pass (Playwright, port 3007): Edward Jones shows 3 + 3 labelled fit notes, a 5-line summary and a closed plain-text posting; Autodesk AEC Data (old format) shows its two paragraphs and a closed flat posting; a Markdown body (1Password, saved into a scratch profile, since removed) showed 9 headings at 15px, 23 bullets and 4 links inside the closed section. No page errors, no sideways scroll at desktop or phone width.
- data repair: the Edward Jones posting saved on 2026-11-15 before the build carried a repeated tail and stray style text; it is now the exact posting (9,894 characters). The scratch profile is removed.
- deferred: jobs saved on 2026-11-14 with "(Excerpt.)" bodies are left as they are (all are filtered out, closed or applied). The real profile has no Markdown-body job yet; the next hunt will save the first one.
- final: bca5cff, 9/9 tasks done. lint, tsc, check:data, check:jobs 92/92, check:hunt 115/115, check:store pass. Not pushed.
