# CV designs

## Spec

*Status: approved 2026-11-11*

### Problem / motivation

Fenix ships three built-in CV designs (Sidebar, Classic, Compact). Third-party extraction tests show all three trip known parser problems:

- Letter-spaced headings extract as `S U M M A R Y` (all three letter-space their headings).
- Helvetica Neue ligatures extract as single characters (`Staﬀ`, `workﬂow`); Sidebar and Compact use it first.
- Dates right-aligned on the job line can extract after the job's bullets or next to the wrong job (all three).
- Sidebar puts `<aside>` before `<main>` in the HTML, so extractors read the side column before the experience.

There is no design built for two pages, which recruiter guidance treats as normal for director and VP candidates, and no design with a Key achievements block, the element most common across commercial CV galleries. Compact looks half-empty because the demo career is short (4 roles, 8 bullets).

The owner's own CVs are not affected: all 54 use their personal template `two-column-navy`.

### Scope

In:

1. **Three new original built-in designs.**
   - **Plain** (`plain`): one column, system sans 10–10.5pt, plain bold section titles, contact as one line of text, each job's title then "Company · City · dates" on the next line. Optional Key achievements after the summary. Built to parse cleanly first.
   - **Executive** (`executive`): one column, serif, centred name with a thin rule, Key achievements as 3–4 bold-titled one-liners after the summary, spacing designed to break onto page 2, page 2 repeating the name and page number. Education, skills and courses at the end in one column.
   - **Gutter** (`gutter`): dates and city in a left gutter about 1.1in wide in muted text, role, company and bullets to the right, each job one block (gutter then content inside the job element), accent colour on the name and role titles only. The gutter is wide enough that dates never wrap.
2. **Fixes to the existing three:** no `letter-spacing` on headings (weight or size instead), `font-variant-ligatures: none`, Sidebar's main column first in the HTML (CSS keeps it on the right).
3. **Compact:** display name "One page, dense", body text about 9pt, the three-column footer turned into ordinary one-column sections. The id stays `compact`.
4. **Key achievements:** an optional CV-version field, up to 4 items, each a short title and one line of text. The number rule applies (`check:claims`). Editable in the CV editor (add, edit, remove, reorder). Claude fills it when drafting a CV through the skills. Designs that don't show it ignore it.
5. **Longer demo career:** 2 more roles and about 5 more bullets in `examples/demo/career.yaml`, fictional companies; the README CV screenshot is regenerated.
6. **Parse test** in `check:templates`: render every built-in with the demo to PDF, extract with pdftotext and pdfminer, assert the rules in success criterion 1. The same test can be pointed at a personal template and reports problems without changing it.
7. **Default for new people:** Plain. `FALLBACK_TEMPLATE` and the settings default become `plain`; existing people's `defaultTemplate` is not changed.

Out:

- The Designs page and picking a default there (spec `app-home-and-navigation`).
- The paid "paste a job description" tailoring route writing Key achievements.
- Word (DOCX) export.
- Photos, icons, skill or language rating bars, company logos.
- Changing the owner's personal template. The parse test only reports on it.
- Copying any commercial design. EnhanceCV's gallery and the open-licence projects are a source of ideas only; every stylesheet is written fresh.

### Success criteria

1. `pnpm check:templates` renders all 6 built-ins with the demo and, for each PDF, through both pdftotext and pdfminer (run with `uvx`):
   - every section heading extracts as a whole word;
   - no ligature characters (U+FB00–U+FB06);
   - email, phone and LinkedIn are present;
   - each job's dates appear between its title and its first bullet;
   - jobs appear in career order;
   - in Sidebar, no side-column text appears between a job's title and its last bullet.
2. Executive prints a 10-role sample on 2 pages; no job title is separated from its first bullet across the page break; page 2 shows the name.
3. A CV version with 3 Key achievements shows them in Plain and Executive. An achievement with a number not in the career record or a story fails `pnpm check:claims`. The CV editor adds, edits, removes and reorders them, and a stale save is refused (409).
4. A newly created profile's settings name `plain`. Existing profiles' settings are unchanged.
5. `check:pdfs` for the owner's profile shows 0 differences. `pnpm lint`, `tsc`, `check:data`, `check:claims`, `check:isolation`, `check:start`, `check:public` and `check:store` pass.
6. The CV editor's design picker lists 6 built-ins with their new names and descriptions.
7. The owner reviews the 6 demo PDFs, copied to `~/Downloads`, before the build is called done.

### Approach

Hand-written designs in the existing Liquid template system (`templates/<id>/template.liquid`, `style.css`, `template.yaml`), filled by `lib/templates/view.ts`. Key achievements become a CV-version field resolved into `ResumeDocument` and exposed by `buildView`. The parse test extends `scripts/check-templates.ts`, which already prints a PDF and runs pdftotext.

Right-aligned dates stay in a design wherever the parse test passes in both extractors, and move onto the company line only where it fails.

Rejected:

- Porting RenderCV, Awesome-CV or a JSON Resume theme: different typesetting engines (Typst, LaTeX), and some licences put conditions on modified copies.
- Generating designs from EnhanceCV screenshots with the template skill: that is copying a commercial design.
- Only fixing the existing three: still no two-page design and no parse-first design.

### Open questions (for the plan)

- Page 2's repeated name relies on Chromium supporting CSS page-margin boxes (`@page { @top-left { … } }`, with `@page :first` empty). Confirm with the bundled Playwright Chromium; if it doesn't hold, Executive doesn't repeat the name.
- Where Key achievements live in the CV version file and how the CV editor lays them out.
- Whether the fenix-hunt and fenix-apply drafting steps always fill Key achievements or only for designs that show them.

### External verification (2026-11-11)

The ATS findings come from third-party extraction tests (sources below), not from the ATS vendors, none of whom publish their parsing. They are not load-bearing: success criterion 1 is our own extraction test, so each fix is proved or disproved on our PDFs. Claims that Workday is stricter than Greenhouse or Lever, and that DOCX parses better than PDF, are unconfirmed and not used.

### Research notes

- Full research: `.scratch/cv-design-research.md` (EnhanceCV gallery read without signing in, about 15 templates, nothing saved).
- Letter-spacing, ligatures, right-aligned dates: https://shortlist.cruscible.com/guides/resume-parsing-test
- Text layer and wrapped dates: https://readableresume.com/research/ats-parsing-test
- Two-column reading order: https://atsprep.com/blog/resume-pdf-extraction-study.md, https://luceria.careers/research/parser-benchmark
- Columns built with tables vs real columns: https://hiretop.com/blog/can-ats-read-columns-tables-text-boxes/
- Two pages for senior candidates (survey, self-reported): https://ireformat.com/blog/ideal-resume-length-staffing
- Open-licence references (ideas only): RenderCV (MIT) https://github.com/rendercv/rendercv, basic-resume (Unlicense) https://github.com/stuxf/basic-typst-resume-template, brilliant-cv (Apache 2.0) https://github.com/yunanwg/brilliant-cv

## Plan

*Written 2026-11-11. Technique checks were run for real in `.scratch/plan-cv-designs/` (free, no paid calls); results are folded into the tasks.*

### Decisions on the spec's open questions

- **Page 2's repeated name: yes.** The bundled Chromium (149) prints CSS page-margin boxes. `@page { @top-left { content: "<name>" } @bottom-right { content: "Page " counter(page) " of " counter(pages) } }` with `@page :first { @top-left { content: none } }` printed the name and "Page 2 of 2" on page 2 only. Both extractors read the header as ordinary text at the top of page 2.
- **Where Key achievements live:** `overrides.keyAchievements: [{ title, text }]`, at most 4 items, title up to 60 characters, text up to 200. The CV editor shows them as a section under Summary. A design says it shows them with `features: [keyAchievements]` in its `template.yaml`. The editor reads that and says "Not shown by <design>" when the chosen design doesn't. No design ids are hard-coded.
- **Do the skills always fill them?** Only when the CV's design declares `features: [keyAchievements]`. Achievements on a design that doesn't show them would still be checked by the number rule and could block `check:claims` for text nobody sees (independent review, finding 6).

### Spec amendments (found while planning)

- **A third extractor, pypdf.** pdftotext and pdfminer both order text by position on the page, so the HTML order of Sidebar's columns makes no difference to them. pypdf reads in drawing order (HTML order): with the side column first in the HTML it reads the side column first; with the main column first it reads name, headline and experience first. The parse test therefore runs pypdf too (through `uvx --with pypdf`), and for Sidebar asserts that pypdf reads the name before any side-column text.
- **"Dates between title and first bullet" means "dates inside the job's block".** Gutter puts dates to the left of the title, so an extractor may read the dates first. The rule becomes: each job's dates come after the previous job's last bullet and before the job's own first bullet. That's the intent of the spec (dates never next to the wrong job), and it holds for every design.
- **A broken LinkedIn handle counts as missing.** Sidebar wraps `linkedin.com/in/example-alex-morgan` at the hyphen, and pdftotext then drops the hyphen (`examplealex-morgan`). The contact rule asserts the handle comes out intact.
- **Baseline of today's failures on the demo** (run 2026-11-11, before any change):
  - letter-spaced headings: Sidebar and Compact in both extractors, Classic in pdfminer;
  - ligatures: Sidebar and Compact in pdfminer;
  - LinkedIn handle broken: Sidebar in pdftotext;
  - dates stayed with their jobs in all three.

### File map

| path | responsibility | new/modified |
| --- | --- | --- |
| `scripts/snapshot-app.ts` | `capture --live`: read the person's CV ids from their files (`readAllCvs`) and rewrite `ids.json`, instead of the list frozen at the database migration; `compare` for PDFs also compares each CV's page-1 PNG bytes | modified |
| `examples/demo/career.yaml`, `examples/demo/profile.yaml` | Longer fictional career (2 more roles, about 5 more bullets); a fictional phone number (555-01xx range) | modified |
| `lib/resume/load.ts` | Split `canonicalFromRecords(profile, career)` (pure) out of `loadCanonical`, so checks can build a document from fixture files without changing `FENIX_DATA_DIR` | modified |
| `lib/pdf/render.ts` | Export `PDF_OPTIONS` (Letter, `printBackground`, `preferCSSPageSize`), used by `renderPdf` and the parse test so both print the same way | modified |
| `scripts/template-parse.ts` | Extract a PDF's text with pdftotext, pdfminer and pypdf; check it against the parse rules; return issues as strings | new |
| `scripts/check-templates.ts` | New section 3: render every built-in with the demo, run the parse rules, run the Executive two-page sample; `--report <person> <templateId>` prints findings for a personal design and exits 0 | modified |
| `templates/classic/*`, `templates/compact/*`, `templates/sidebar/*` | Parse fixes; Compact renamed and reworked; Sidebar's main column first in the HTML | modified |
| `lib/templates/view.ts` | New fields only: `linkedinPrefix` and `linkedinHandle` (so a design can let the label wrap only between them), `keyAchievements` | modified |
| `templates/plain/*`, `templates/executive/*`, `templates/gutter/*` | The three new designs (`template.liquid`, `style.css`, `template.yaml`) | new |
| `lib/templates/registry.ts` | `FALLBACK_TEMPLATE = "plain"`; `TemplateInfo.features` read from `template.yaml` | modified |
| `lib/store/profiles.ts` | `NEW_SETTINGS.defaultTemplate = "plain"` | modified |
| `lib/resume/schema.ts`, `lib/resume/types.ts`, `lib/resume/resolve.ts` | `keyAchievements` in overrides, resolved into `ResumeDocument` | modified |
| `lib/store/claims.ts` | `inventedNumbers` also checks each achievement's title and text | modified |
| `components/key-achievements-editor.tsx` | Add, edit, remove and reorder up to 4 achievements; "Not shown by <design>" note | new |
| `components/variant-editor.tsx` | Mount the achievements section under Summary; pass the chosen design's features | modified |
| `scripts/check-resolve.ts` | Key achievements resolve (literal expectations) | modified |
| `.claude/skills/fenix-hunt/SKILL.md`, `docs/cv-tailoring.md` | Draft 3 Key achievements per CV, numbers only from the record or a story | modified |
| `README.md`, `docs/architecture.md`, `docs/images/cv.png` | Six designs, the uv requirement for `check:templates`, a new screenshot in Plain | modified |

### Tasks

0. **Capture the owner's PDFs before anything changes.**
   - **Do:**
     - `scripts/snapshot-app.ts`: add `--live`, which reads the person's CV ids from their files (`readAllCvs`) and rewrites `ids.json` before capturing. Today `capture` reuses `ids.json` written at the database migration, which lists 31 CVs; the owner has 54 CV versions now.
     - `compare --only pdfs` also compares each CV's page-1 PNG (already written by `capture` with `pdftoppm`) byte for byte, next to the page count and `pdftotext -layout` text it compares today. If two captures of the same PDFs differ in PNG bytes, drop the PNG compare and say so in Status: text plus page count is then the evidence, backed by task 3's structural check.
     - `FENIX_PROFILE=<owner> pnpm exec tsx scripts/snapshot-app.ts capture before --profile <owner> --live` against the running app (the owner runs `pnpm dev`; ask if it's down, never start it). `capture` deletes the old `before` folder first, which is intended.
     - Prove the baseline is stable before any design changes: `capture after --profile <owner>` straight away, then `compare before after --only pdfs`.
   - **Verify:** `ids.json` lists all 54 CV versions; `before/pdf/` holds one PDF per CV; the immediate compare prints `no differences (pdfs)`. A difference here means the PDFs aren't deterministic, and task 11 can't use them as proof until that's fixed.
   - **Commit:** `snapshot-app: capture the person's live CV list; compare page-1 images too`.

1. **Longer demo career and a phone.**
   - **Do:** add two earlier roles at fictional companies (Contoso-style names) with about 5 bullets in total, and a phone in the 555-01xx fictional range. Every number in a new bullet is in the career record by definition, so the number rule holds. No story changes.
   - **Reuse:** none; data only.
   - **Edges:** a bullet with non-ASCII text (an accented city name), so the extractors' handling is covered.
   - **Verify:** on a scratch copy (`FENIX_DATA_DIR=.scratch/demo-data`, with `examples/demo` copied to `demo/`), `pnpm check:data` passes; `pnpm check:tailor` and `pnpm check:start` pass; `pnpm check:isolation` passes (needs the dev server).
   - **Commit:** `demo: longer career and a phone, so every design shows a realistic page`.

2. **Parse harness, failing on today's designs.**
   - **Do:** split `canonicalFromRecords` out of `loadCanonical` (`loadCanonical` keeps its signature and calls it). Export `PDF_OPTIONS` from `lib/pdf/render.ts` and use it in `renderPdf`. Write `scripts/template-parse.ts`:
     - `extract(pdfPath)` returns `{ pdftotext, pdfminer, pypdf }` texts. pdfminer runs as `uvx -q --from pdfminer.six==20260107 pdf2txt.py`; pypdf as `uvx -q --with pypdf==7.0.1 python -c …`. Both versions are pinned, so a new release can't change the test's result; they were the current releases on 2026-11-11 (checked with `uvx`). A missing `uvx` fails with "install uv: brew install uv".
     - `parseIssues(texts, expect)` checks, per extractor:
       - no run of 4 or more single letters separated by spaces (`/\b(?:\p{L} ){3,}\p{L}\b/u`);
       - no character in U+FB00–U+FB06;
       - the email, the phone and the LinkedIn handle appear intact;
       - each job's dates come after the previous job's last bullet and before its own first bullet;
       - job titles appear in career order;
       - when `expect.side` is given, no side-column string appears between a job's title and its last bullet, and pypdf reads the name before the first side-column string.
     - Expectations for the demo are literals written in the check (titles, dates such as `"Apr 2022 - Present"`, first and last bullet text), not computed with `view.ts`'s `monthYear`, so a formatting bug can't pass its own test. Only `--report` on a personal design builds expectations from the document, since it has no literals.
   - In `check-templates.ts` section 3, for each built-in: parse `examples/demo` with `profileSchema` and `careerSchema`, build the document with `canonicalFromRecords` and `resolve`, render with `renderFiles`, and print with Playwright `setContent` plus `PDF_OPTIONS` into `.scratch/check-templates/<id>.pdf`. Sections 1 and 2 are unchanged, and `FENIX_DATA_DIR` is never touched, since section 2 writes its probe into the app's data folder.
   - `--report <person> <templateId>`: build that person's `base` document with that design, run the same rules, print the findings, and exit 0.
   - **Reuse:** `renderFiles` (registry), `resolve`; none for extraction (grepped `pdf2txt`, `pypdf`: none).
   - **Platform:** verified on macOS. The built-in designs name system fonts (Georgia, Helvetica Neue) that Linux lacks; there a fallback font changes wrapping and ligatures, so the rules may pass or fail differently. The README says the parse test is macOS-verified.
   - **Bounds:** at most one PDF per built-in plus one sample; each `uvx` call has a 60 s timeout.
   - **Verify:** `pnpm check:templates` exits 1, and its parse failures are exactly the baseline under "Spec amendments" (letter-spacing: sidebar and compact in both, classic in pdfminer; ligatures: sidebar and compact in pdfminer; LinkedIn handle: sidebar in pdftotext) plus "sidebar: pypdf reads side column before the name". `pnpm check:templates --report <owner> two-column-navy` prints its findings and exits 0. `tsc` clean.
   - **Commit:** `check:templates: parse test with three extractors (fails on today's designs, fixed next)`.

3. **Fix Classic and rework Compact.**
   - **Do:**
     - Remove `letter-spacing` from headings; keep small caps or capitals by size and weight.
     - Add `font-variant-ligatures: none` to `body` in both.
     - Compact: `template.yaml` name "One page, dense" (id stays `compact`); body text about 9pt; skills, education and courses as ordinary one-column sections in that order after Experience.
     - Description lines in `template.yaml` updated to say what each design is for.
   - **Structural check:** built-in changes can't reach a personal design. `registry.ts` loads a personal template only from its own folder (`loadDir(path.join(personalRoot(profile), id))`), and the owner's `two-column-navy` has no `@import` or `url(` (grepped 2026-11-11). `check:templates` gains an assertion that no personal template of any profile contains `@import`; with that, text plus page count plus page-1 pixels in task 11 is enough proof.
   - **Verify:** `pnpm check:templates` shows no parse failures for `classic` or `compact`; the remaining failures are Sidebar's only.
   - **Commit:** `templates: classic and compact parse cleanly; compact becomes 'One page, dense'`.

4. **Fix Sidebar.**
   - **Do:**
     - `<main>` before `<aside>` in the HTML, with grid placement keeping the side column on the left.
     - No letter-spacing on headings; ligatures off.
     - Add `linkedinPrefix` (`linkedin.com/in/`) and `linkedinHandle` to `buildView`, alongside the existing `linkedinLabel`, which stays because personal designs use it. Sidebar prints the two as separate `inline-block` spans, so the label can only wrap between them. Outputs are HTML-escaped (`outputEscape: "escape"`), so `<wbr>` from data isn't an option.
     - Edge: a LinkedIn URL that isn't a `/in/` profile gives `linkedinPrefix: null` and the whole label in `linkedinHandle`.
   - **Verify:** `pnpm check:templates` passes every parse rule for all three existing designs, including "pypdf reads the name first" for Sidebar. `check:resolve` passes.
   - **Commit:** `templates: sidebar parses cleanly (main column first, handle never split)`.

5. **Key achievements: data path.**
   - **Do:**
     - Add `keyAchievements: z.array(z.object({ title: z.string().trim().min(1).max(60), text: z.string().trim().min(1).max(200) })).max(4).optional()` to `overridesSchema`.
     - Add `keyAchievements: { title, text }[]` to `ResumeDocument`; `resolve` copies it (default `[]`).
     - Add `keyAchievements` to `buildView`.
     - `inventedNumbers` adds `key achievement N title` and `key achievement N text` fields.
     - `registry.ts` reads `features` (array of strings, default `[]`) into `TemplateInfo`.
   - **Writes:** none new. Achievements save through the existing variant PATCH (versioned, 409 when stale) and the job-variant POST, which both parse `overridesSchema`. A retry or double submit writes the same overrides.
   - **Surfaces:** the CV editor (task 9), the variant PATCH route and the job-variant POST (both via `overridesSchema`), fenix-hunt (task 10), `check:claims` and `check:data` (via `inventedNumbers`). The paid tailoring route builds its overrides from its own `DraftSchema`, so it's unchanged.
   - **Edges:** empty list renders nothing; 5 items is a 400 from the routes; non-ASCII titles round-trip.
   - **Verify:** `pnpm check:resolve` gains literal cases: no field gives `[]`; 2 items come through in order. A scratch copy of the demo with a CV whose achievement text says "37%" (not in the record) makes `pnpm check:claims demo` print `BLOCKS … key achievement 1 text: "37%"`, and one saying "13%" (in the record) prints nothing. `tsc` clean.
   - **Commit:** `cv versions: optional Key achievements, under the number rule`.

6. **Plain, and Plain as the default for new people.**
   - **Do:**
     - Write `templates/plain/` (one column, system sans 10–10.5pt, bold section titles, contact as one line, "Company · City · dates" under each title, Key achievements after the summary when present, `features: [keyAchievements]`).
     - Set `FALLBACK_TEMPLATE` and `NEW_SETTINGS.defaultTemplate` to `plain`.
     - The settings schema default stays `sidebar`: it only fills profile files that lack the field, and changing it would switch their design silently. Every profile Fenix creates writes the field explicitly.
     - `lib/start/progress.ts` compares against `NEW_SETTINGS.defaultTemplate`, so "design picked" still means "changed from the starting design".
     - One silent effect, stated: when a person's default names a personal design that has been deleted, `loadTemplate` (`registry.ts:81`) now falls back to Plain instead of Sidebar. Existing profiles are otherwise unaffected, since the schema default stays `sidebar` and the fallback is only reached when the named design is missing or empty.
   - **Verify:**
     - `pnpm check:templates` passes for `plain`, including a demo variant with 3 achievements (the block appears in all three extractors).
     - `pnpm fenix create-profile --scratch zz-plain` writes `defaultTemplate: plain`, then `pnpm fenix remove-scratch zz-plain`.
     - The owner's `profile.yaml` still says `two-column-navy`.
     - `pnpm check:start` passes.
     - `check:templates` gains a fallback case: a scratch profile whose `defaultTemplate` names a missing personal design loads `plain`. It goes in `check:templates`, not `check:resolve` as the review suggested, because the fallback lives in `registry.ts`, which `check:templates` already tests.
   - **Commit:** `templates: 'plain', the parse-first default for new people`.

7. **Executive.**
   - **Do:**
     - Write `templates/executive/` (serif, centred name with a thin rule, Key achievements as 3–4 bold-titled one-liners, one column, education, skills and courses at the end, `features: [keyAchievements]`).
     - Page 2+ shows the name top left and "Page N of M" bottom right through `@page` margin boxes; `@page :first` clears the top box.
     - `.job-head { break-after: avoid }` keeps a title with its first bullet; jobs may split across the break. In the technique check, 8 of 41 layouts stranded a title without it and 0 with it.
     - The margin-box name is CSS text (`content:`), which can't take Liquid output safely. The template writes it inside a `<style>` block as `content: "{{ fullName }}"`, so the plan checks escaping: a name with a double quote or backslash must not break the stylesheet. If HTML escaping isn't enough inside CSS, use a view field `fullNameCss` that escapes `"` and `\` for CSS.
   - **Verify:** `pnpm check:templates` gains an Executive sample of 10 literal roles with 4 bullets each, plus 3 literal Key achievements:
     - it prints on 2 or more pages (`pdfinfo`). The sample is long enough to need 2 pages with any fallback font, so the check doesn't depend on Georgia being installed;
     - the 3 achievement titles and texts appear in all three extractors;
     - page 2's text (`pdftotext -f 2 -l 2`) contains the name, page 1's top doesn't repeat it;
     - at every page break, the last non-empty line of the page is neither a job title nor a company line, and the first line of the next page is a bullet or the continuation of one. Checking only "the page doesn't end on a title" would miss a break between the title and the company line, which also strands the title (independent review, finding 3);
     - the parse rules pass for the demo;
     - a sample named `Zoë "Q" O'Neil\` renders with the name intact on page 2.
   - **Commit:** `templates: 'executive', two pages with Key achievements`.

8. **Gutter.**
   - **Do:** write `templates/gutter/`. Each job is one block: the gutter (dates, then city, muted, about 1.1in, `white-space: nowrap` on the dates) then the content (title, company, bullets). Accent colour on the name and titles only. No Key achievements.
   - **Verify:** `pnpm check:templates` passes for `gutter`, plus one more assertion for this design: every date range appears on one line exactly as formatted (`Apr 2022 - Present`) in all three extractors.
   - **Commit:** `templates: 'gutter', dates in a left column`.

9. **Key achievements in the CV editor.**
   - **Do:** `components/key-achievements-editor.tsx`: rows of title and text inputs (counters at 60 and 200), up/down buttons, remove, and "Add" (disabled at 4). Under the list: "Shown by: Plain, Executive. Not shown by <current design>." when the chosen design lacks the feature. `variant-editor.tsx` mounts it under Summary and feeds it `ov.keyAchievements`, writing through the existing `update()`. Empty rows are dropped on save.
   - **Reuse:** the editor's `update()`, `save()` and 409 handling; field styles from `.fld`.
   - **Verify:** a Playwright script in `.scratch/` on a scratch profile against the running app:
     - add 3 achievements, save, reload, see 3 in order;
     - move the third up, save, reload, order changed;
     - remove one, save, reload, 2 left;
     - "Add" is disabled at 4;
     - with Sidebar chosen the note says "Not shown by Sidebar".
     - A `curl` PATCH with an old version returns 409.
     - Then `pnpm fenix remove-scratch`.
   - **Commit:** `cv editor: Key achievements`.

10. **Skills, docs, screenshot.**
    - **Do:**
      - fenix-hunt step 2 and `docs/cv-tailoring.md`: when the CV's design declares `features: [keyAchievements]` (read from `/api/p/<p>/templates`), draft 3 Key achievements (title 2–5 words and at most 60 characters, text one line and at most 200, picked from bullets and stories whose numbers are backed). Otherwise draft none. fenix-hunt step 3 POSTs `overrides` to the job-variant route, so an achievement over the limits comes back as a 400; the skill says to shorten it and retry.
      - README: "Six built-in CV designs"; `check:templates` needs uv (`brew install uv`).
      - `docs/architecture.md`: the designs list, `features` in `template.yaml`, the parse test.
      - Regenerate `docs/images/cv.png` from the demo in Plain with the harness's renderer (a Playwright screenshot of page 1, no server), and update the alt text.
    - **Verify:** `pnpm check:public` passes; `pnpm lint` clean; `grep -n "Three built-in" README.md` finds nothing.
    - **Commit:** `docs: six designs, Key achievements in drafting, Plain screenshot`.

11. **Prove the owner's PDFs are untouched; hand over for review.**
    - **Do:** `FENIX_PROFILE=<owner> pnpm check:pdfs`. Copy the 6 demo PDFs from `.scratch/check-templates/` to `~/Downloads/fenix-design-<id>.pdf` for the owner (criterion 7).
    - **Verify:** `check:pdfs` reports 0 differences across all 54 CV versions (text, page count and page-1 PNG, per task 0). `pnpm lint`, `pnpm exec tsc --noEmit`, `check:data`, `check:claims`, `check:store`, `check:resolve`, `check:start`, `check:isolation`, `check:templates` and `check:public` pass. The CV editor's design picker lists 6 built-ins plus the owner's own design (curl `/api/p/<owner>/templates`: 7 entries with the new names).
    - **Commit:** `plan: cv-designs final` with the Status lines.

### Premises

- `lib/templates/render.ts` — every Liquid output is HTML-escaped (`outputEscape: "escape"`), so markup such as `<wbr>` can't come from data.
- `lib/pdf/render.ts` — `renderPdf` prints with `format: "Letter"`, `printBackground: true`, `preferCSSPageSize: true`.
- `lib/resume/load.ts` — `loadCanonical` only reads two files and maps them; the mapping can move into a pure function without changing callers.
- `lib/resume/schema.ts` — `overridesSchema` is `z.object` (unknown keys are stripped), and both `app/api/p/[profile]/variants/[id]/route.ts` (PATCH, 409 on a stale version) and `app/api/p/[profile]/jobs/[id]/variant/route.ts` parse with it.
- `lib/ai/tailor.ts` — the paid call's output format is `DraftSchema`; `overridesSchema.parse` runs afterwards on the result, so adding an optional overrides field doesn't change the paid call.
- `lib/store/claims.ts` — `inventedNumbers` is the one list of CV fields checked by both `check:claims` and `check:data`.
- `lib/store/profiles.ts` — `NEW_SETTINGS` is written in full into every new `profile.yaml`; `lib/store/schemas.ts`'s `defaultTemplate: str.default("sidebar")` only fills files that lack the field.
- `lib/start/progress.ts:75` — "design picked" compares against `NEW_SETTINGS.defaultTemplate`.
- `lib/templates/registry.ts` — `readInfo` reads only `name` and `description` from `template.yaml`; adding `features` is additive.
- `scripts/check-templates.ts` — section 2 writes its probe into `dataRoot()` and needs the running app; section 3 must not change `FENIX_DATA_DIR`.
- The owner's 54 CV versions and their profile default all use the personal design `two-column-navy`, which reads `linkedinLabel` (kept unchanged).
- `package.json` `check:pdfs` — captures `after` through the running app and compares it with `.scratch/migration/before`.
- `scripts/snapshot-app.ts` — `capture` reads CV ids from `.scratch/migration/ids.json` (31 entries, frozen at the database migration), deletes the label's folder first, and writes a page-1 PNG per CV with `pdftoppm`; `compare --only pdfs` compares page count and `pdftotext -layout` text only. Task 0 changes both.
- `lib/store/cvs.ts` — `readAllCvs(profile)` lists every CV version from files.
- `lib/resume/schema.ts` — `overridesSchema.parse({})` succeeds: `positions` defaults to `{}` and `currency` to `"USD"`, so fixture CVs with no overrides are valid (read 2026-11-11).
- `lib/store/claims.ts:70-75` — `inventedNumbers` lists fixed fields (headline, summary, reworded bullets); a new field isn't checked until it's added there (task 5).
- `.claude/skills/fenix-hunt/SKILL.md` step 3 — drafts are POSTed as `overrides` to `/api/p/<p>/jobs/<id>/variant`, which parses `overridesSchema`.
- `lib/templates/registry.ts:84` — a personal template is loaded only from `data/<p>/templates/<id>/`; built-in CSS is never merged in.
- `uvx` 0.13.7 is installed; pdfminer.six 20260107 and pypdf 7.0.1 are fetched on the first run (not installed locally).
- Bundled Playwright Chromium 149 — supports `@page` margin boxes and `break-after: avoid` (both tested 2026-11-11).

### Risks / unknowns

- **Build order with `app-home-and-navigation`.** Both plans touch the template list: its Designs page lists every template via `listTemplates` and `TemplateInfo`, and this plan adds three designs and a `features` field to `TemplateInfo`. Both also touch the CV editor. Build cv-designs first, so the Designs page is built against six designs and the final `TemplateInfo`.
- **uv on other machines.** The parse test needs `uvx`; the first run downloads pdfminer.six and pypdf (about 16 s here). Mitigation: a clear error naming `brew install uv`, and the README line.
- **Fonts on Linux.** Georgia and Helvetica Neue are macOS fonts; on Linux the parse rules may give different results. The test is stated as macOS-verified; the Executive page check uses "2 or more pages" so it doesn't hinge on font metrics.
- **Non-deterministic PDFs.** If task 0's immediate self-compare shows differences, task 11's proof is void until the cause is found.
- **The owner's dev server.** Tasks 0, 1 (isolation), 9 and 11 need it. If it's down, ask; never start or restart it.
- **Sidebar's header lines still interleave in pdftotext.** pdftotext reads the location, name, email and headline across both columns line by line. The rules only constrain jobs and the contact strings, which stay intact. We'll see at task 4 whether more is needed; the spec doesn't require side-column-free headers.
- **Executive's name inside CSS.** Liquid escapes for HTML, not CSS. Task 7 tests a name with a quote and a backslash; if it breaks, it gets a CSS-escaped view field.
- **Removing letter-spacing changes the look** of Sidebar and Compact headings. The owner reviews all six PDFs at task 11 before the build is done.
- **Demo changes ripple into checks** that read `examples/demo` (`check:start`, `check:tailor`, `check:isolation`, `check:banner-api`). Task 1 runs them.

### Not yet specified

- Nothing. The open questions are decided above.

### Out of scope

- The Designs page and choosing a default from it: spec `app-home-and-navigation`.
- The paid tailoring route writing Key achievements: it would change a paid call's output format.
- Fixing the owner's personal design: the parse test reports on it (task 2); any change is the owner's call.
- Gutter showing Key achievements: not in the spec; the `features` field makes it a one-line change later.
- Word export, photos, icons, rating bars, logos: excluded by the spec.

### Research notes

- CSS page-margin boxes in Chromium: tested locally (`.scratch/plan-cv-designs/margin-box.ts`, Chromium 149.0.7827.55).
- `break-after: avoid`: tested locally (`.scratch/plan-cv-designs/break2.ts`, 41 layouts).
- Extraction order by HTML order: tested locally (`.scratch/plan-cv-designs/order.ts`): pdftotext and pdfminer.six v20260107 order by position, pypdf by drawing order.
- Pinned extractor versions: pdfminer.six 20260107 and pypdf 7.0.1, the current releases on 2026-11-11 (`uvx … python -c 'print(__version__)'`).
- Baseline parse failures of today's designs: `.scratch/designs/*.pdf` read with pdftotext 26.10.0 and pdfminer.six.

### Robustness review (2026-11-11)

Two fresh agents reviewed the plan independently: one for plan shape, one for premises. Their findings are folded into the tasks above.

**Plan shape:**
- Reconstruction smell: ROBUST. One exception, now fixed: expected dates were computed with `monthYear`; they are literals now (task 2).
- Bolt-on vs best practice: the extraction test was PATCHWORK as written (unpinned extractors, font-dependent page count). Now the versions are pinned, it's stated as macOS-verified, and the Executive check uses "2 or more pages" (tasks 2, 7). Page-margin boxes, `break-after`, `overrides.keyAchievements` with `features`, and number-rule coverage were ROBUST.
- Mismatched profiles: ROBUST.
- Cross-boundary reach: ROBUST.
- Altitude not named: PATCHWORK, because the first review was the planner's own. These two reviews replace it.

Folded from the shape review:
- Task 0's baseline is proved stable by a self-compare before any change.
- Task 7 checks every page break against title and company lines, and its sample includes Key achievements.
- Task 6 states the deleted-personal-design fallback and tests it.
- Skills draft Key achievements only for designs that show them.
- Task 3 makes the "personal designs can't be touched" argument explicit and adds the `@import` check.

**Premises:** every listed premise HOLDS. Chromium 149's margin boxes and `break-after` were UNVERIFIED by the reviewer, who didn't re-run the scratch tests; the planner ran them. Missing premises now listed:
- `snapshot-app` reads a stale `ids.json` of 31 CVs and compares text only, so task 0 adds `--live` and the page-1 image compare.
- `inventedNumbers` covers only fixed fields.
- fenix-hunt POSTs overrides to the job-variant route.
- `uvx` is present, and the extractors download on first run.
- `overridesSchema.parse({})` is valid.

No app code imports from `scripts/`.

## Status
- in-progress: task 0
- done: task 0: ids.json from live files lists 54 CV versions; before/pdf has 54 PDFs; immediate self-compare (text, page count, page-1 PNG hash): no differences, 027a0cd
- in-progress: task 1
- done: task 1: demo now 7 positions, 11 bullets, phone 416-555-0142 and a Québec City role; scratch check:data ok (13 files), check:tailor passed, check:start 17/17, check:isolation 28/28, 3efc1bd
- in-progress: task 2
- done: task 2: check:templates exits 1 with 11/14; the parse failures, run on the longer demo from task 1, are a superset of the planned baseline: letter-spacing in classic (pdfminer, pypdf), compact (all three), sidebar (all three); ligatures in compact (pdfminer, pypdf) and sidebar (pdfminer, pypdf); LinkedIn handle broken in sidebar (all three); sidebar pypdf reads the side column first; and one new one, classic's right-aligned dates for the 4th job land after its first bullet in pdfminer. `--report <owner> two-column-navy` exits 0 with 2 issues (letter-spaced headings in pdftotext and pdfminer). tsc clean, lint clean. 13915cb
- in-progress: task 3
- done: task 3: classic and compact pass every parse rule in all three extractors; the remaining failure is sidebar's only (14/15). Both had right-aligned dates that drifted (classic in pdfminer, compact in pdftotext), so per the spec their dates moved onto the company line. Headings lost their letter-spacing, ligatures are off, compact is 9pt with skills, education and courses as one-column sections. check:templates now also asserts no personal design has @import (the owner's two-column-navy: ok). 13647ef
- in-progress: task 4
- done: task 4: check:templates 15/15 (all three existing designs pass every rule in all three extractors, including pypdf reading the name first); check:resolve passed; tsc clean. Found while building: pdftotext's column split in Sidebar depends on how the two columns' lines happen to line up, not on HTML order. With headings at 8.6pt it read side text inside the first job; at 8pt (the original size) it reads cleanly. Headings stay 8pt; the parse test guards any later change. Long handles: the handle span doesn't wrap, so a handle wider than about 1.5in would overflow the side column. fc93c8f
- in-progress: task 5
- done: task 5: check:resolve gains 3 literal cases (none gives [], 2 items in order with non-ASCII, 5 refused), all pass; on a scratch demo copy a Key achievement saying "37%" BLOCKS in check:claims and fails check:data, "9% to 13%" passes; the owner's check:claims and check:data unchanged; check:templates 15/15; tsc and lint clean. TemplateInfo.features read from template.yaml. f667610
- in-progress: task 6
- done: task 6: check:templates 19/19 (plain parses cleanly; with 3 Key achievements every title and text appears in all three extractors; a deleted personal default falls back to plain); create-profile --scratch zz-plain wrote defaultTemplate: plain, then removed; the owner's profile still names two-column-navy; check:start 17/17; tsc and lint clean. 0f1c244
- in-progress: task 7
- done: task 7: check:templates 28/28. Executive parses cleanly on the demo with and without Key achievements; a 10-role sample prints on 3 pages; page 1 shows the name once, page 2 shows it with "Page 2 of 3"; the 3 Key achievements print in all three extractors; no title or company line stranded at a break (with the keep rule removed, at 9pt job spacing the same check fails on pages 1 and 2, so it detects strandings); a name with quotes and a backslash prints intact on page 2 through the new view field fullNameCss. Found while building: Chromium let the template's later `@page` rule override `@page :first`, so the page-1 rule now follows it in the same <style>. b65782f
- in-progress: task 8
- done: task 8: check:templates 31/31; gutter parses cleanly in all three extractors and every demo date range comes out on one line in each. 9263369
- in-progress: task 9
- done: task 9: Playwright on a scratch profile against the running app (.scratch/cv-designs-pass/ka.ts), 7/7: 3 achievements saved and reloaded in order; moving the third up reorders; removing one leaves 2; Add disabled at 4; Sidebar shows "Not shown by Sidebar", Plain shows no such note; a PATCH with an old version returns 409. Scratch profile removed. Files outside the map: `app/p/[profile]/cv/[id]/page.tsx` (passes each design's features and the person's default design) and `app/globals.css` (row styles). The editor previews and saves only complete rows, so a half-typed row never breaks the preview. 8b2c2a7
- in-progress: task 10
- done: task 10: check:public clean, lint clean, README no longer says "Three built-in"; fenix-hunt drafts Key achievements only for designs listing the feature and shortens on a 400; cv-tailoring.md and architecture.md describe the six designs, features and the parse test; docs/images/cv.png is page 1 of the demo in Plain. Found while making the screenshot: Plain's page 1 ended on a stranded "Tools & Stack" heading, so every design's section headings now keep with their content (`break-after: avoid`); check:templates still 31/31, and on the demo Plain, Classic, Gutter and Executive run to 2 pages with each page 2 starting on a heading or job with its content. 8e8fa04
- in-progress: task 11
- done: task 11: FENIX_PROFILE=<owner> check:pdfs: no differences across all 54 CV versions (text, page count, page-1 PNG hash). lint, tsc, check:data (258 files), check:claims (0 blocking), check:store 19, check:resolve, check:start 17/17, check:isolation 28/28, check:templates 31/31, check:tailor, check:jobs 47/47 and check:public (no hits in this plan) pass. `/api/p/<owner>/templates` lists 7: the six built-ins with their new names (Plain and Executive with `features: [keyAchievements]`) plus the owner's own. The 6 demo PDFs are in ~/Downloads as fenix-design-<id>.pdf (Plain and Executive with 3 Key achievements); criterion 7 waits on the owner's look.
- review: /code-review high over bdfd340..e111117 found 10; 7 fixed in a505008, 3 skipped.
  - Fixed: a long LinkedIn handle overflowed Sidebar's side column (handles over 24 characters now wrap at 7.5pt; new check, which fails with the rule disabled); the handle split ignored query strings and extra path segments; the CV editor's "Not shown by" note now follows the same fallback as printing (CV's design, else default, else Plain); Executive puts a space between an achievement's title and line; the fenix-template skill lists the new variables, `features`, the six built-ins and the parse rules; check:templates shares one browser, and `--report` checks its arguments first and takes expectations from `buildView`; the parse loop reports every missing job instead of stopping at the first.
  - Skipped: the settings schema default stays `sidebar` (the plan's decision: changing it would silently switch profile files that lack the field); the paid tailoring route doesn't write Key achievements (out of scope in the spec); `--report` doesn't check side text or Key achievements (a personal design has no hand-written expectations for them).
  - Also from the browser pass: the editor's note was missing a space ("navy.Rows"); fixed in the same commit.
- browser pass: the CV editor's design picker lists 7 (the six built-ins with their new names plus the owner's own); the Key achievements pass re-run after the fixes, 7/7. check:pdfs re-run after the fixes: no differences across 54 CV versions. check:templates 32/32.
- final: a505008, 12/12 tasks done (tasks 0–11). Criterion 7 is open until the owner looks at the 6 PDFs in ~/Downloads/fenix-design-<id>.pdf.
- criterion 7: the owner looked at the 6 PDFs on 2026-11-12 and approved them. Build complete.
