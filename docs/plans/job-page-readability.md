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
