# Architecture

## Files, not a database

Each person is a folder under `data/` (or `$FENIX_DATA_DIR`). `data/` is its own git repository, ignored by the app repo, so the app can be public while the data stays private.

```
data/<person>/
  profile.yaml          name, contact, default headline and summary, settings (pay floor, where they can work, searches)
  career.yaml           companies → positions → bullets; education, skills, courses
  cvs/<name>.yaml       one CV version each, plus the PDF that was sent
  jobs/<company-title--source-id>.md   front matter: the job's facts, stage, history, answers; body: the job description
  stories/<slug>.md     a career story with numbers and their proof
  interviews/<date>-<company>-r<n>.md   one interview round: a brief before it, a review after it (+ .transcript.txt)
  interview-answers.md  best current answer per common question, and lines that landed (feeds tailoring and LinkedIn)
  memory/               what Claude has learned about the person (MEMORY.md is the index)
  templates/<id>/       the person's own CV designs
  linkedin/             LinkedIn draft and banner
  claims-baseline.yaml  known unbacked numbers waiting on the person (optional)
```

All reads and writes go through `lib/store/`: zod schemas (`schemas.ts`), atomic writes (`files.ts`), a per-person lock that also works across processes (`lock.ts`), and a version hash on every record, so a save based on an old read fails with "this changed elsewhere" instead of overwriting. After each save, `history.ts` commits the files that save wrote, and only those, to `data/`'s git history; `pnpm data:commit` commits a person's whole folder after a skill writes files directly. `pnpm check:data` (`validate.ts`) checks every file and every link between files; a Stop hook runs it at the end of each Claude Code turn.

## People

Pages are `/p/<person>/…`, API routes `/api/p/<person>/…`. `lib/http.ts` turns the URL segment into a checked folder name; nothing reads another person's folder. `pnpm check:isolation` proves it against the running app.

Each person's Home (`/p/<person>/home`, where `/` goes) shows what needs them today (`lib/start/today.ts`), their setup steps until the needed ones are done (`lib/start/progress.ts`), and what Fenix can do with the sentence to tell Claude (`lib/start/prompts.ts`, `features.ts`). The header puts the day-to-day pages first (Home, Pipeline, Interviews, CVs), then the ones about the person (Career record, Stories, Designs, LinkedIn, Banner).

The app has no login. `pnpm dev` listens on 127.0.0.1 only, so other computers can't reach it, and `proxy.ts` answers only requests whose Host is `localhost`, `127.0.0.1` or `[::1]` (`localHost`), which stops a DNS-rebinding page from reading Fenix under its own name. Any website open in the browser can still send requests to localhost, so `proxy.ts` also refuses every API request that changes something (anything but GET, HEAD and OPTIONS) unless `sameOrigin` (`lib/same-origin.ts`) passes: a local Host, and Origin or Sec-Fetch-Site naming Fenix when the browser sends them. Browsers always send one on such requests; the skills' `curl` calls send neither and pass.

## CV versions

`lib/resume/resolve.ts` turns the career record plus a CV version's overrides into the document that gets printed. Overrides never change the career record. Per position there are two modes:

- **reflow** (default): bullets show unless hidden; rewordings and hides are stored as deltas, and bullets added to the career record later appear automatically.
- **curated**: an explicit ordered list of bullet ids, a snapshot; new career bullets don't appear.

A bullet can carry an alternate text in another currency (`altText`, `altCurrency`); the CV version's currency picks which prints.

The PDF to send is saved next to its CV version (`save-pdf`) and stays as the record of what was sent, even after the version is deleted. When the person sets `settings.cvFolder`, `lib/store/cv-folder.ts` also copies each saved PDF there after the save's lock is released, removes the copy of a renamed or deleted version unless another live version uses that file name, and never fails a save over the folder. `pnpm fenix sync-cvs <person>` (or Copy all on the CVs page) copies every live version's PDF.

## Designs

A design is a folder with `template.liquid`, `style.css` and `template.yaml`: built-in under `templates/`, personal under `data/<person>/templates/`. `lib/templates/view.ts` precomputes what a template can print (formatted dates, grouped courses). `lib/templates/render.ts` renders Liquid in a worker thread with every output HTML-escaped, unknown variables and filters as errors, only the template's own files visible, render limits, and a hard timeout. The print route (`app/print/[profile]/[id]`) serves the page with `script-src 'none'` and no outside loads; Playwright prints it to PDF (`lib/pdf/`).

The built-ins are Plain (the default for new people), Classic, Executive, Gutter, Sidebar and One page, dense (`compact`). `template.yaml` holds the name, the description and optional `features`: a design that prints Key achievements (a CV version's `overrides.keyAchievements`, up to 4 titled one-liners under the number rule) lists `keyAchievements`, and the CV editor says when the chosen design doesn't. `pnpm check:templates` prints every built-in with the demo person and reads the PDF back with pdftotext, pdfminer and pypdf, the kind of text extraction applicant tracking systems start from: no letter-spaced headings or ligature characters, contact details intact, each job's dates inside its own block, jobs in order, and for two-column designs no side-column text inside a job. `--report <person> <templateId>` runs the same rules on a person's own design. The Designs page shows every design with the person's career record (`lib/templates/preview.ts`: page 1 as a PNG, kept in memory until the design or record changes) and sets their default.

## Jobs

The hunt skill's scanner (`.claude/skills/fenix-hunt/scan.py`, Python standard library only) reads every job source that needs no browser: company boards and multi-company feeds, merged into one list. It gets the person's hunt settings and the roles already judged from `/api/p/<p>/hunt` (`lib/store/hunt.ts`, `data/<p>/hunt/seen.yaml`). The hunt skill posts each job to `/api/p/<p>/jobs` with the facts it read and the page's own words as evidence. `lib/jobs/` decides the stage from the person's settings: Shortlisted, Needs a check (pay or remote policy unclear) or Filtered out. A stage the person sets is never moved by a later hunt. `pnpm check:closed` asks Ashby, Greenhouse and Lever whether open jobs are still posted.

## The number rule

`lib/store/claims.ts` finds every number in a CV version's headline, summary and reworded bullets, and in a LinkedIn draft, and requires it to appear in the career record or a story's numbers. A new unbacked number fails `check:data`; numbers on CVs already sent, or recorded in `claims-baseline.yaml`, are listed by `pnpm check:claims` without blocking.

## Claude Code

The skills in `.claude/skills/` hold the judgment work: onboarding, stories, interviews, designs, hunting, applying, LinkedIn. They write through the API or `pnpm fenix <command>`, except memory, stories, interviews and personal templates, which they write directly and then check with `pnpm check:data`. The session-start hook prints who has a profile and loads one person's memory index.
