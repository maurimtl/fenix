# App home and navigation

## Spec

*Status: approved 2026-11-11*

### Problem / motivation

Fenix opens on the Pipeline. Nothing in the app says what it can do, what needs attention today, or which pages are daily work and which are one-time setup. The header is a flat list of seven links in no order; the CV designs are only visible inside the CV editor's dropdown; the Applied column has 38 cards and grows forever; and the saved PDFs are reachable only through a symlink the owner made by hand. A second person and the public release both need the app to explain itself.

### Scope

In:

1. **Home page** at `/p/<person>/home`, replacing `/start`. Four blocks, top to bottom:
   - **Today.** Interviews in the next 7 days (from `interviews/`, with a link to the round's brief), CVs ready to send (jobs in CV_READY), jobs waiting on a check (FOUND), and applications with no reply in 30 days (see item 3). Each line links to its page. When nothing is due, the block says so in one line.
   - **Setup.** The existing 7-step checklist, unchanged, shown until the required steps (career record, settings, 3 stories) are done; after that it collapses to one line ("Setup done · optional: LinkedIn rewrite, interview recordings") with the open optional steps' prompts.
   - **What Fenix can do.** One row per feature (find jobs, make a CV for a job, apply, interview brief and review, stories, LinkedIn rewrite and banner, CV designs), each with its "What to tell Claude" sentence from `lib/start/prompts.ts` and a link to the page. The "Open Claude Code in this folder" command stays at the top of this block.
   - **Works better with.** A short list: Claude in Chrome (needed for finding jobs, applying and reading LinkedIn; how to install it); Exa and Tavily MCP servers (optional, the hunt finds more postings; one line each on how to add them to Claude Code); and a line that everything else works with Codex or ChatGPT from the same files. No in-app detection of any of these: the app can't see Chrome or Claude Code, and the skills already check the signed-in LinkedIn name before browsing.
   - `/` and the Fenix wordmark go to Home. `/start` redirects to `/home`. `proxy.ts` drops the career-record check.
2. **Header in two groups.** Left: *Home · Pipeline · Interviews · CVs*. Right of a divider: *Career record · Stories · Designs · LinkedIn · Banner*. The "Getting started" link is gone; Home covers it. The person switcher stays at the far right. On narrow windows the second group wraps under the first.
3. **Pipeline columns capped.** Each column shows at most 8 cards (the column's current sort) and a "See all N" link when there are more. "See all" opens `/p/<person>/jobs/stage/<stage>`: a table of every job in that stage (role, company, pay, remote, days in stage, closed reason), sortable by column, with the same since/from/to window as the board. The `PipelineTabs` segment gains the stage views as the active tab when on one. Applied jobs with no reply in 30 days get a "No reply in N days" tag on the card and in the table, and the stage menu's closed reasons gain `no_response` ("No response") so they can be closed in one click. "No reply" means: stage APPLIED, `stageEnteredAt` more than 30 days ago.
4. **Designs page** at `/p/<person>/designs`. Every design the person can use (built-in plus their own `templates/`), each rendered as a page-1 image with the person's own career record (the `base` document), its name and description, and a "Make default" button that writes `settings.defaultTemplate`. The current default is marked. A design that fails to render shows the error in its card instead of breaking the page. The page lists whatever exists; new built-in designs come from the separate `cv-designs` spec.
5. **CV folder.** A per-person setting `cvFolder` (absolute path, optional). When set, every PDF the app saves (`save-pdf` route) is also copied there under the same file name, replacing an older copy with that name. Deleting a CV version removes its copy. The CVs page shows the folder and a "Show in Finder" button that calls a local API route running `open <folder>` on macOS and `xdg-open` on Linux. The folder is set on the Settings part of the career-record page (a text field: the browser can't return a native folder path to a localhost page) or by telling Claude ("Put my CVs in ~/Documents/CVs"). `pnpm fenix set-profile` already writes settings; `fenix-onboard` asks for the folder as one of its questions. A one-time `pnpm fenix sync-cvs <person>` copies every existing PDF into the folder. The owner's existing symlink stays until they remove it; the memory entry `reference-machine-setup.md` is updated at build time.

Out:
- An in-app chat or a button that runs Claude.
- Detecting Claude in Chrome, MCP servers or the LinkedIn sign-in from the app.
- Paid scraper APIs as recommendations.
- Drag-and-drop between columns, or editing stories in the app.
- A native folder picker. Browsers don't hand a path to a page; the text field and Claude cover it.
- Syncing the folder the other way (edits made to a copied PDF never flow back).
- New built-in CV designs (the `cv-designs` spec).

### Success criteria

1. `curl -sI localhost:3007/` ends at `/p/<owner>/home` (302 chain); `/p/<owner>/start` redirects to `/p/<owner>/home`. On a fresh profile with no career record, Home shows the Setup block first with 0 of 7 done.
2. Home for the owner lists their next interview round under Today while it is within 7 days, and each CV_READY job by name; after an interview's date passes it disappears from Today.
3. The header renders the two groups in the stated order on every page (`check:start`-style script asserts the link texts and order; 1 check per page).
4. With 38 Applied jobs, the board shows 8 cards in Applied and "See all 38"; `/p/<owner>/jobs/stage/APPLIED` lists all 38; `?sort=` and `?since=30d` work there as on the board. A column with 8 or fewer shows no link.
5. A job in APPLIED whose `stageEnteredAt` is 31 days ago shows "No reply in 31 days"; one at 29 days doesn't. The stage menu offers "Closed: No response"; choosing it writes `closedReason: no_response`, and `check:data` accepts it. `pnpm check:jobs` covers the 30-day boundary with literal dates.
6. `/p/<owner>/designs` shows one card per template from `listTemplates` (sidebar, classic, compact, two-column-navy), each with an image rendered from their career record; "Make default" on classic sets `settings.defaultTemplate: classic` in `profile.yaml` and the next new CV version uses it. `check:isolation` adds the Designs page: a personal template of one person never appears on another's page.
7. With `cvFolder: ~/Documents/CVs` set, saving a PDF from the CV editor produces the file in `data/<p>/cvs/` and the same bytes in the folder; deleting that CV removes the copy; an unset or unwritable folder makes the save still succeed and shows a warning on the CVs page. `pnpm fenix sync-cvs <owner>` copies every PDF in their `cvs/` (44 today) and reports the count.
8. `pnpm lint`, `tsc --noEmit`, `check:data`, `check:start`, `check:jobs`, `check:isolation` and `check:public` pass; the browser pass covers Home, a stage list, Designs and Show in Finder (the route returns 200 and nothing is asserted about Finder itself).

### Approach

**Home.** Extend `lib/start/progress.ts` with a `computeToday(profile)` that reads interviews, jobs and settings once and returns typed lines; the page composes blocks from it and the existing `computeProgress`. The feature list is static data next to `prompts.ts`. `isSetupPending` stays for the collapse decision. Rejected: keeping `/start` and adding a separate `/home` (two pages that overlap); a dashboard with charts (nothing to chart yet).

**Header.** Two arrays in `app-header.tsx` with a divider element; no new component. Rejected: a sidebar layout (the pipeline needs the full width).

**Capped columns.** The board page slices each sorted column to 8 and links to the stage page, which reuses `listJobs`, `filterBoard`, `sortColumn` and the ledger table style from `/jobs/filtered`. The no-reply tag is computed in `lib/jobs/format.ts` from `stageEnteredAt`, with the 30 days as one constant. `no_response` joins `ClosedReason` in `lib/jobs/types.ts`, `CLOSED_REASON_LABEL`, the schema and `docs/plans/closed-reasons.md`'s list. Rejected: infinite scroll inside the column (hides the count and breaks keyboard use); collapsing Applied to a count only (recent ones still matter); auto-closing after 30 days (a job can get a reply at day 40; the person decides).

**Designs page.** Each card's image comes from a new `GET /api/p/<p>/designs/<id>/preview.png`: render the `base` document with that `templateId` through the existing `renderDocument` and Playwright, page 1 only, cached in memory by (template files hash, career record version) so the page doesn't re-render on every visit. "Make default" is a `PATCH /api/p/<p>/settings { defaultTemplate }` through `lib/store` under the profile lock, the first settings write from the app; `cvFolder` uses the same route. Rejected: rendering with the demo person's data (people want to see their own CV); an `<iframe>` of the print route per card (five Chromium-free iframes are cheap, but the print route's CSP and page size make them awkward to scale down; an image is simpler).

**CV folder: copy, not symlink.** A symlink to `cvs/` exposes the YAML files and makes Finder show the whole folder; it also doesn't survive a cloud-synced Documents folder cleanly, and the app can't make one per person without knowing the path anyway. Copying each saved PDF is one `fs.copyFile` at save time, with deletion handled at `deleteCv`. Failure modes: the folder goes away (the save still succeeds; the CVs page warns), a copy is edited by hand (it is overwritten at the next save of that CV; the spec says so on the page), two CVs with the same file name (the file-name pattern already includes company and role; same-name collisions overwrite, as in `cvs/` itself). Rejected: a symlink per person (above); a watcher that mirrors `cvs/` (a background process for a one-line copy).

### Judgment calls

- Home replaces Getting started rather than sitting beside it; the checklist lives on inside Home.
- "Today" uses 7 days for interviews and 30 days for no reply, both constants, not settings.
- The 8-card cap is a constant, not a setting.
- `no_response` is a new closed reason rather than reusing `fell_off`: "fell off" is used today for processes that stalled after contact; no response means never heard back.
- Designs render with the career record (`base`), not with the person's latest CV version.
- The folder is a per-person setting, since two people on one Mac want different folders.
- Copy rather than symlink for the CV folder.
- "Show in Finder" is a local API route; it only runs `open` / `xdg-open` with the configured path, never a path from the request.

### Open questions

- Should the stage list page replace `/jobs/filtered` as a general `/jobs/stage/FILTERED_OUT` view? (Plan decides; it would remove one page.)
- Where the settings fields (folder, default design, file-name pattern) live on the career-record page, or whether they get their own small Settings page under Your profile. Plan decides; the spec only requires a text field somewhere reachable from the CVs page.
- Preview image size and caching location (memory vs `data/<p>/.cache/`) are for the plan.

### Research notes

- Browsers expose a directory picker (`showDirectoryPicker`) but it returns handles, not paths, so an app on localhost can't learn where the folder is: hence the text field.
- `open <dir>` opens a folder in Finder on macOS; `xdg-open <dir>` opens a folder in the desktop's file manager on Linux.

## Plan

*Written 2026-11-11. Build after `cv-designs` (see Risks).*

### Decisions on the spec's open questions

- **Stage list vs `/jobs/filtered`:** keep `/jobs/filtered` as it is. The stage page accepts only the board stages (`BOARD_STAGES`); Filtered out has its own columns (why it was dropped) and its own tab. Merging them saves one page but changes a page that works; not worth it here.
- **Where settings fields live:** no Settings page. The CV folder field sits at the top of the CVs page (`/variants`), next to "Show in Finder"; the default design is set on the Designs page. Both write through one `PATCH /api/p/<p>/settings` route. The file-name pattern stays a Claude-only setting.
- **Preview size and cache:** page 1 at 60 dpi (about 510×660 px), shown scaled in the card. Cached in server memory, at most 32 entries, keyed by profile, template id, the template files' hash, and the `career.yaml` and `profile.yaml` versions that `readCareer` and `readProfileVersioned` already return (no re-hashing of the document). Taken with Playwright `page.screenshot` of the print page, not a PDF converted to PNG. Nothing is written under `data/`, so no new ignore rule and nothing to clean up.
- **Opening the folder:** `open <folder>` on macOS (shows the folder's contents) rather than `open -R` (which only selects the folder in its parent). Linux: `xdg-open <folder>`. Anything else: 501 with a message.
- **Same-origin guard:** one `sameOrigin(req)` helper in `lib/http.ts`, applied to every state-changing route this plan adds or touches: settings PATCH, open folder, save-pdf, CV delete. Other existing routes are out of scope. *Amended at build:* a request with neither `Origin` nor `Sec-Fetch-Site` is allowed. Browsers send at least one on every POST, PATCH and DELETE, so such a request comes from a local tool, and the fenix-apply skill saves PDFs with a header-less `curl` to save-pdf; refusing it would break applying. Foreign origins, cross-site `Sec-Fetch-Site` and non-local Host stay refused.
- **Changing the folder:** old copies stay where they are. The field says so and offers "Copy all to the new folder" (the same code as `sync-cvs`).
- **`sync-cvs` count rule:** it copies only PDFs named by a live CV version's `pdf:` field, not every `cvs/*.pdf` (a deleted CV's PDF stays in `cvs/` as a record and is not copied back).

### File map

| path | responsibility | new/modified |
| --- | --- | --- |
| `lib/store/schemas.ts` | `no_response` in `CLOSED_REASONS`; `cvFolder` (optional absolute path) in `settingsSchema` | modified |
| `lib/jobs/format.ts` | label for `no_response`; `NO_REPLY_DAYS = 30`; `noReplyDays(job, now)` | modified |
| `scripts/check-jobs.ts` | the 29/30/31-day boundary with literal dates; a `no_response` patch accepted (`jobPatchSchema` in `lib/jobs/schema.ts` derives the enum from `CLOSED_REASONS`, so no change there) | modified |
| `components/job-card.tsx` | "No reply in N days" tag | modified |
| `app/p/[profile]/jobs/page.tsx` | 8 cards per column, "See all N" link | modified |
| `app/p/[profile]/jobs/stage/[stage]/page.tsx` | every job in one board stage as a sortable table, same window as the board | new |
| `components/pipeline-tabs.tsx` | a third, optional active value for a stage page | modified |
| `lib/start/today.ts` | `computeToday(profile, now)`: interviews in 7 days, CV_READY, FOUND, no-reply lines | new |
| `lib/start/features.ts` | the "What Fenix can do" rows (label, page, prompt key) | new |
| `scripts/check-start.ts` | `computeToday` on a scratch profile with literal dates | modified |
| `app/p/[profile]/home/page.tsx` | Home: Today, Setup, What Fenix can do, Works better with | new |
| `app/p/[profile]/start/page.tsx` | redirect to `/home` | modified |
| `proxy.ts` | `/` goes to `/home`; drop the career-record check | modified |
| `components/create-profile-form.tsx` | new person lands on `/home` | modified |
| `components/app-header.tsx` | two groups with a divider; wordmark to Home; no `setupPending` | modified |
| `components/site-header.tsx`, `components/banner-editor.tsx`, `components/canonical-editor.tsx`, `app/p/[profile]/banner/page.tsx`, `app/p/[profile]/canonical/page.tsx` | drop the `setupPending` prop plumbing | modified |
| `app/globals.css` | Home blocks, header divider, lane "See all", no-reply tag, design cards, folder bar | modified |
| `app/api/p/[profile]/settings/route.ts` | `PATCH { defaultTemplate?, cvFolder? }` under the profile lock | new |
| `app/print/[profile]/[id]/route.ts` | `?template=<id>` for `base` only, validated against `listTemplates` | modified |
| `lib/pdf/render.ts` | `renderPng(url)`: page-1 screenshot of a print page (print media, Letter clip, pooled Chromium) | modified |
| `lib/templates/preview.ts` | page-1 PNG of a design for a person, memory cache | new |
| `lib/http.ts` | `sameOrigin(req)`: Sec-Fetch-Site / Origin and Host checks | modified |
| `app/api/p/[profile]/designs/[id]/preview/route.ts` | `GET` → `image/png` | new |
| `app/p/[profile]/designs/page.tsx`, `components/make-default-button.tsx` | the Designs page and its one client button | new |
| `lib/store/cv-folder.ts` | `resolveFolder`, `copyToFolder`, `removeFromFolder`, `syncFolder` | new |
| `app/api/p/[profile]/cvs/[id]/save-pdf/route.ts` | copy the saved PDF; drop the previous name's copy; `folderWarning` in the response | modified |
| `lib/store/cvs.ts` | `deleteCv` returns the removed PDF name so the route removes the folder copy after the lock | modified |
| `app/api/p/[profile]/cvs/[id]/route.ts` | CV delete: `sameOrigin`, then the folder copy removal | modified |
| `app/api/p/[profile]/cv-folder/open/route.ts` | `POST`: open the configured folder; same-origin only | new |
| `components/cv-folder-bar.tsx`, `app/p/[profile]/variants/page.tsx` | folder field, Show in Finder, warning | new / modified |
| `scripts/fenix.ts` | `sync-cvs <person>` | modified |
| `.claude/skills/fenix-onboard/SKILL.md` | ask for the CV folder with the settings questions | modified |
| `scripts/check-isolation.ts` | `/home`, `/designs`, a design preview in the other-person list | modified |
| `README.md`, `CLAUDE.md`, `docs/architecture.md` | Home, Designs, CV folder, `sync-cvs` | modified |
| `data/<owner>/memory/reference-machine-setup.md` | the CV folder setting replaces the hand-made symlink note | modified (data repo) |

### Tasks

1. **No-response closed reason and the no-reply rule.**
   - Do: add `no_response` to `CLOSED_REASONS` and `CLOSED_REASON_LABEL` ("No response"); the stage menu picks it up from the label map. Add `NO_REPLY_DAYS = 30` and `noReplyDays(job: { stage; stageEnteredAt }, now): number | null` (days when stage is APPLIED and more than 30 days have passed, else null) in `lib/jobs/format.ts`.
   - Reuse: `stageEnteredAt` from `lib/store/jobs.ts` (already on every listed job); no new date maths beyond the day count.
   - Edges: `stageEnteredAt` unknown (`stageDateKnown: false`, falls back to `firstSeenAt`) still counts; the tag says "No reply in N days" either way.
   - Verify: `pnpm check:jobs` with literal dates: 29 and 30 days → null, 31 → 31; non-APPLIED at 90 days → null; `jobPatchSchema` accepts `closedReason: "no_response"`. `pnpm check:data` passes.
   - Commit.
2. **Capped columns and the tag on cards.**
   - Do: in the board, slice each sorted column to 8 and render "See all N" (N = the column's count after the window filter) linking to `/jobs/stage/<STAGE>` with the same `?sort`/`?since`/`?from`/`?to` (use `viewHref`). The card shows the no-reply tag.
   - Bounds: 8 is a constant `LANE_CAP` next to `BOARD_STAGES`.
   - Verify: curl the board: the Applied lane holds exactly 8 cards and a "See all" link with the right count; a lane with ≤ 8 has no link. `tsc` clean.
   - Commit.
3. **Stage list page.**
   - Do: `/jobs/stage/[stage]` validates the stage against `BOARD_STAGES` (404 otherwise), lists every job in it after `filterBoard`, sorted by `sortColumn`, as the `ledger` table: role and company, pay (`formatComp`), remote (`remoteLabel`), days in stage, closed reason (Closed only), the no-reply tag, and the stage menu (`JobStageSelect`). `BoardControls` gives sort and window. `PipelineTabs` gets `active="stage"` with no extra tab (the page title names the stage; a "Board" link returns).
   - Reuse: `filterBoard`, `sortColumn`, `parseBoardView`, `viewHref`, `JobStageSelect`, the `ledger` CSS; grepped `ledger` and `BoardControls`.
   - Verify: curl `/jobs/stage/APPLIED` → 200, row count equals the board's Applied count; `?sort=oldest` reverses the first and last rows; `?since=30d` gives the same count as the board's Applied lane with `?since=30d`; `/jobs/stage/NOPE` → 404.
   - Commit.
4. **What needs you today (logic).**
   - Do: `computeToday(profile, now)` reads interviews, jobs and settings once and returns typed lines: interviews whose `date` is today or within the next 7 days (local date string, not UTC), each with its brief link; CV_READY jobs; FOUND jobs; APPLIED jobs with `noReplyDays` set. Each list capped at 10 with a "+N more" count. `readAllInterviews` already skips unreadable rounds (and `check:data` reports them), so Today has no error line for them.
   - Verify: `pnpm check:start` gains cases on its scratch profile with literal dates: an interview 3 days ahead is listed, one 8 days ahead and one yesterday are not; a job in APPLIED entered 31 days ago is listed; a broken interview file is skipped without a crash.
   - Commit.
5. **Home page and routing.**
   - Do: `/home` renders, in order: Today (from task 4; "Nothing due today." when empty), Setup (`computeProgress`; full checklist while `setupPending`, else one line naming the open optional steps with their prompts), What Fenix can do (`lib/start/features.ts`: one row per feature with its `PromptBox` and a link; the "Open Claude Code in this folder" command first), Works better with (static text: Claude in Chrome required for finding jobs, applying and reading LinkedIn; Exa and Tavily optional with one line each on adding them to Claude Code; Codex or ChatGPT for the rest). Move the start page's JSX into Home; `/start` becomes `redirect(pagePath(profile, "/home"))`. `proxy.ts` sends `/` to `/home` and no longer imports `hasCareer`. The create-profile form goes to `/home`. `check:isolation` swaps `/start` for `/home` in the other-person list.
   - Surfaces: `prompts.ts` stays the single source of every sentence; README's "Getting started page" wording changes in task 11.
   - Verify: `curl -sI localhost:3007/` → 302 to `/p/<p>/home`; `/p/<p>/start` → redirect to `/home`; Home HTML holds the four headings in order; on a scratch profile Setup shows 0 of 7. `pnpm check:isolation` passes.
   - Commit.
6. **Settings write route.**
   - Do: add `sameOrigin(req)` to `lib/http.ts`: allow when `Sec-Fetch-Site` is `same-origin` or `none`, or when `Origin` equals the app's own origin; reject (403) when neither header is present or either names another site; and reject unless `Host` is `localhost:<port>` or `127.0.0.1:<port>` (DNS rebinding). `PATCH /api/p/<p>/settings` (guarded) with a zod body `{ defaultTemplate?: string, cvFolder?: string | null }`. `defaultTemplate` must be an id from `listTemplates(profile)` (400 otherwise). `cvFolder`: `~` expanded to the home folder, must be absolute after expansion, stored normalised; `null` or `""` clears it. Writes through `updateProfileRecord(profile, undefined, …)` (merges into the latest file under the lock, so a concurrent `pnpm fenix set-profile` isn't overwritten field-wide) and commits `profile.yaml` only. Add `cvFolder: optStr` to `settingsSchema`.
   - Writes: retry and double submit set the same value (idempotent); a concurrent edit to another field survives because the patch touches only the named fields.
   - Edges: a relative path → 400; non-ASCII paths are allowed; the folder doesn't have to exist yet (created on first copy).
   - Verify: on a scratch profile, curl PATCH `defaultTemplate: classic` → 200 and `profile.yaml` says `classic`; an unknown id → 400; `cvFolder: "~/x"` stores the absolute path; the same PATCH with `Origin: https://evil.example` → 403, with no Origin and no Sec-Fetch-Site → 403, with `Host: evil.example:3007` → 403; `pnpm check:store` passes.
   - Commit.
7. **Design previews.**
   - Do: the print route accepts `?template=<id>` only when the id is `base`, and only an id from `listTemplates(profile)` (404 otherwise, never a silent fallback to another design); after `loadResumeDoc` it overrides `doc.templateId`. `renderPng(url)` in `lib/pdf/render.ts` opens the print page in the pooled Chromium with print media emulated and takes `page.screenshot` clipped to page 1 (Letter at 60 dpi scale). `lib/templates/preview.ts` builds the print URL from `APP_URL`, calls `renderPng`, and caches the PNG in a `Map` (insertion-order eviction at 32 entries) keyed by profile, template id, the template files' hash and the `career.yaml` and `profile.yaml` versions. `GET /api/p/<p>/designs/<id>/preview` returns `image/png` with `cache-control: no-store`; a render error returns 500 with the message as text.
   - Reuse: `getBrowser` (pooled Chromium), `loadTemplate`, `hashText`, `readCareer`/`readProfileVersioned` versions. No poppler dependency.
   - Bounds: one render per request; the cache caps memory at roughly 32 × 60 KB.
   - Verify: curl the preview for `classic` → 200, `image/png`, a PNG signature; the second call is at least 5× faster (cache hit); an unknown id → 404; `?template=` on a CV-version id is ignored.
   - Commit.
8. **Designs page.**
   - Do: `/designs` lists `listTemplates(profile)` as cards: the preview image (`loading="lazy"`), name, description, "Yours" for personal ones, "Default" on the current one, and a "Make default" button (client component) that calls the settings route and refreshes. A card whose preview fails shows the error text instead of the image (`onError` swaps in a message; the route's 500 body is not fetched twice).
   - Verify: curl `/designs` → one card per template from `/api/p/<p>/templates`; Make default on a scratch profile changes `/api/p/<p>/templates`'s `default`, and the next CV version created through `POST /api/p/<p>/variants` names that design; a personal template whose files fail to load shows its error in the card, not another design; `pnpm check:isolation` adds `/designs` and a preview URL for the other person and asserts the first person's personal template name is absent.
   - Commit.
9. **Header in two groups.**
   - Do: `AREAS` becomes `DAILY` (Home, Pipeline, Interviews, CVs) and `PROFILE` (Career record, Stories, Designs, LinkedIn, Banner) with a divider element between; the wordmark goes to `/home`. Remove `START` and the `setupPending` prop from `AppHeader`, `SiteHeader`, `BannerEditor`, `CanonicalEditor` and their pages (Home carries setup now). On narrow widths the second group wraps under the first (CSS only).
   - Verify: a script fetches each page (`/home`, `/jobs`, `/interviews`, `/variants`, `/canonical`, `/stories`, `/designs`, `/linkedin`, `/banner`) and asserts the nav link texts in that exact order on each; `tsc` and `lint` clean.
   - Commit.
10. **CV folder: copy on save, remove on delete.**
    - Do: `lib/store/cv-folder.ts`: `resolveFolder(settings)` (null when unset); `copyToFolder(profile, pdfPath)` (`mkdir -p`, `copyFile` to `<folder>/<basename>`); `removeFromFolder(profile, name)`, which removes a copy only when no other live CV's `pdf` has that name; each returns a warning string instead of throwing. The save-pdf route (guarded by `sameOrigin`) reads the CV's previous `pdf` name inside the lock, commits, releases the lock, then copies and, when the name changed, removes the old copy; it returns `folderWarning` when the copy failed. CV delete (guarded) gets the removed PDF name from `deleteCv` and removes the copy after the lock. The PDF in `cvs/` keeps its current rule (it stays as the record of what was sent).
    - Writes: a retried save overwrites the same file. The copy runs outside the profile lock so a slow synced or network folder never holds it; a delete racing a copy can at worst leave one stray copy, which the next save or `sync-cvs` corrects.
    - Edges: unset folder → no-op; a folder that can't be created → save still 200 with `folderWarning`; a hand-edited copy is overwritten at the next save of that CV.
    - Verify: on a scratch profile with `cvFolder` = `.scratch/cv-folder-check`: save-pdf → `cmp` of the two files succeeds; rename the CV and save again → the old copy is gone and the new one exists; delete → the copy is gone; two CVs sharing a PDF name: deleting one keeps the copy; `cvFolder` = `/nonexistent-root/x` → 200 with `folderWarning`; save-pdf and delete with a foreign Origin → 403.
    - Commit.
11. **Folder field, Show in Finder, sync-cvs, onboarding, docs.**
    - Do: `CvFolderBar` on `/variants`: the folder as text with an Edit field (saves through the settings route), "Show in Finder" (POST to the open route), and the last save's warning if any. The bar notes that changing the folder leaves old copies behind, with a "Copy all to the new folder" button (calls the same `syncFolder`). The open route reads `settings.cvFolder` only (never a path from the request), uses `sameOrigin` (403 otherwise), checks the folder exists and is a directory, and runs `execFile("open", [folder])` on macOS or `execFile("xdg-open", [folder])` on Linux (501 elsewhere). `pnpm fenix sync-cvs <person>` copies each PDF named by a live CV version's `pdf:` field through `copyToFolder` and prints the count. `fenix-onboard` asks "Where should your CV PDFs go?" with the settings questions and writes `cvFolder` with `set-profile`. README, CLAUDE.md and `docs/architecture.md` describe Home, Designs, the CV folder and `sync-cvs`.
    - Bounds: `sync-cvs` touches only PDFs named by live CV versions (no recursion, no orphan PDFs).
    - Verify: curl POST to the open route with `Origin: https://evil.example` → 403; with neither Origin nor Sec-Fetch-Site → 403; with the app's origin on a scratch profile whose folder exists → 200 (Finder opens that scratch folder); unset folder → 409. `pnpm fenix sync-cvs <scratch>` reports the number of live CV versions with a `pdf:` (an orphan PDF in `cvs/` is not copied). `pnpm check:data` and `check:public` pass.
    - Commit.
12. **The owner's machine note.**
    - Do: in the data repo, update `data/<owner>/memory/reference-machine-setup.md`: the CV folder is now the `cvFolder` setting; the old `~/Documents/Fenix CVs` symlink still exists until the owner removes it. Commit with `pnpm data:commit`.
    - Verify: `pnpm check:data` passes; the session-start memory index still lists the file.
    - Commit (data repo).

After task 12, fenix-build's single review and browser pass cover Home, a stage list, Designs (images load, Make default), the folder bar and the open route.

### Premises

- `lib/store/jobs.ts` — `toJob` puts `stageEnteredAt: Date` (and `stageDateKnown`) on every listed job.
- `lib/store/schemas.ts` — `CLOSED_REASONS` drives both the job schema's `closedReason` enum and the `ClosedReason` type.
- `lib/jobs/format.ts` — `stageOptions` builds the Closed entries from `Object.keys(CLOSED_REASON_LABEL)`.
- `lib/jobs/board-view.ts` — `filterBoard`, `sortColumn`, `parseBoardView`, `viewHref` exist and are generic over `{ stageEnteredAt: Date }`.
- `lib/store/career.ts` — `updateProfileRecord(profile, expected, fn)` does a locked read-modify-write of `profile.yaml`.
- `lib/resume/load.ts` — `loadResumeDoc(profile, "base")` resolves with `defaultTemplateId(profile)`; nothing else picks the template for `base`.
- `app/print/[profile]/[id]/route.ts` — serves the CV HTML under a CSP with `script-src 'none'`.
- `lib/pdf/render.ts` — `renderPdf(url)` uses one pooled Chromium and a fresh context per call.
- `lib/templates/registry.ts` — `listTemplates(profile)` returns built-ins plus that person's own, and `loadTemplate` returns the files and CSS.
- `lib/store/interviews.ts` — `readAllInterviews` returns rounds with `data.date` as `YYYY-MM-DD`.
- `app/api/p/[profile]/cvs/[id]/save-pdf/route.ts` — writes the PDF next to the CV file inside the profile lock and sets `pdf:`.
- `lib/store/cvs.ts` — `deleteCv` keeps the PDF in `cvs/` and removes only the YAML.
- `components/app-header.tsx` — the `setupPending` prop is passed by `SiteHeader`, `BannerEditor` and `CanonicalEditor` only.
- `scripts/check-isolation.ts` — lists `/p/${b}/start` among the other-person routes.
- `components/create-profile-form.tsx` — sends a new person to `/start`.
- `proxy.ts` — its matcher includes `/` and `/p/:path*`, so the `/` → `/home` change takes effect; dropping the career check also drops the `hasCareer` import.
- `lib/store/schemas.ts` — `settingsSchema` is a `looseObject`, so an unknown `cvFolder` already survives; task 6 still adds it as a typed field.
- `lib/jobs/schema.ts` — `jobPatchSchema`'s `closedReason` is `z.enum(CLOSED_REASONS)`, so `no_response` is accepted once added to `CLOSED_REASONS`.
- `lib/store/career.ts` — `readCareer` and `readProfileVersioned` return `{ data, version }`, the preview cache key.
- `lib/resume/load.ts` — `loadResumeDoc` takes no template argument; the print route overrides `doc.templateId` after loading.
- `lib/templates/registry.ts` — `loadTemplate` falls back silently on an unknown id, so the print route validates the id against `listTemplates` before rendering.
- `lib/store/interviews.ts` — `readAllInterviews` skips unreadable rounds instead of throwing.
- `app/api/p/[profile]/cvs/[id]/save-pdf/route.ts` — reads the CV outside the lock; the previous `pdf` name must be re-read inside it.

### Risks / unknowns

- **Build `cv-designs` first.** It adds three built-ins and makes `plain` the default for new people. The Designs page lists whatever exists, so the order isn't required for correctness, but building this first means reviewing the Designs page twice.
- **Cold preview renders.** The first visit renders every design (about 1 s each on the pooled Chromium). Cards load lazily and in parallel; if it feels slow we'll find out at task 8 and can render on first scroll only.
- **Cross-site requests to localhost.** No API route checked the origin before. `sameOrigin` now guards every route this plan adds or touches (settings, open folder, save-pdf, CV delete), including a Host check against DNS rebinding; the other existing routes are out of scope (see below).
- **Interview dates and time zones.** Dates are local calendar dates; comparing against `now` in UTC would drop an evening interview a day early. Task 4 compares local date strings.
- **Removing Getting started.** Bookmarks to `/start` keep working through the redirect.
- **A cloud-synced folder** (iCloud Documents) may show a copy a few seconds late; nothing to do.
- **Verification opens Finder once** (task 11) on a scratch folder; that's the only visible side effect on the owner's machine.

### Not yet specified

Nothing: every spec item maps to a task.

### Out of scope

- An origin check on the existing state-changing routes this plan doesn't touch (jobs, answers, career record, LinkedIn, banner): a separate hardening change that reuses `sameOrigin`. *Done at build after review:* the check moved into `proxy.ts` for every non-GET API request.
- Merging `/jobs/filtered` into the stage page: decided against above.
- A Settings page: the two settings this spec needs live where they're used.
- Writing previews to disk: memory is enough for one local user.

### Research notes

- Previews use Playwright `page.screenshot` with print media emulated, the standard way to image a page, so no poppler (`pdftoppm`) dependency is added.
- `open <dir>` opens a folder in Finder; `open -R` selects an item in its parent (macOS `open(1)`).
- Next.js 16 `redirect()` from `next/navigation` works in a server page for the `/start` redirect, as other pages in this repo already do with `notFound()`.
- Review method: two independent reviewers (plan shape; premises) read the spec, plan and code with fresh context on 2026-11-11. Their findings are folded in above.

### Robustness review (2026-11-11)

Two independent reviewers, fresh context. Verdicts as found, then what was folded in.

- Reconstruction smell: PATCHWORK → fixed. Previews no longer fetch a PDF and convert it, or re-hash the document: a page-1 screenshot keyed on the record versions the store already returns. The previous `pdf` name is read inside the lock instead of inferred later.
- Bolt-on vs best-practice: PATCHWORK for previews → fixed (Playwright `page.screenshot` is the standard; poppler was not a declared prerequisite for `pdftoppm`). ROBUST: settings PATCH, capped board plus a stage list (the Linear/Jira pattern), copy instead of symlink.
- Unverified load-bearing assumption: all 16 listed premises HOLD. Eight missing premises were added (proxy matcher, `looseObject` settings, `jobPatchSchema` deriving from `CLOSED_REASONS`, record versions, `loadResumeDoc` without a template argument, `loadTemplate`'s silent fallback, `readAllInterviews` skipping broken rounds, save-pdf reading the CV outside the lock). Task 4's "error line" case was dropped because it couldn't happen.
- Mismatched profiles: ROBUST.
- Cross-boundary reach: ROBUST. `scripts/` only calls `lib/`; no app code imports from `scripts/`.
- Altitude not named: PATCHWORK → fixed. The origin check covered one route while the settings route that sets its folder was open; `sameOrigin` now guards every route this plan adds or touches, rejects requests with neither header, and checks Host.
- Also folded: copies are made outside the lock; a shared PDF name never deletes another CV's copy; `sync-cvs` copies only live CVs' PDFs; changing the folder says old copies stay and offers "Copy all"; criteria 4 (`?since=`) and 6 (next CV uses the new default) gained verifications; spec text corrected (`open <folder>`, four blocks).

## Status

- in-progress: task 1
- done: task 1: check:jobs 52/52 (29/30 days untagged, 31 tagged, Interviewing at 90 untagged, no_response accepted), check:data ok, tsc ok, 19beb85
- in-progress: task 2
- done: task 2: board curl: Applied 8 cards + See all 38, Closed 8 + See all 48, lanes with <=8 have no link; no-reply tags 0 (oldest Applied is 5 days, checked); tsc + lint ok, b270260
- in-progress: task 3
- done: task 3: /jobs/stage/APPLIED 38 rows = board count; oldest/newest reverse first and last rows; date windows match the board (1 and 18 rows on two custom ranges; 7d/30d equal because every Applied job is under a week old); NOPE and FILTERED_OUT 404; tsc + lint ok, d89bc94
- in-progress: task 4
- done: task 4: check:start 21/21 (interview 3 days ahead listed, 8 ahead and yesterday not, broken round skipped; 31 days no-reply listed, 30 not; CV ready and needs-a-check listed), also passes under UTC+14 and UTC-11; 7670a3b
- in-progress: task 5
- done: task 5: / -> 302 /p/<owner>/home, /start -> 307 /home; Home has the four headings in order and lists the owner's next interview under Today; owner's Setup shows 'Setup done.'; a scratch profile shows 0 of 7 and 'Nothing due today'; check:isolation 28/28; tsc + lint ok, c677a3c
- in-progress: task 6
- done: task 6: scratch profile: classic saved; unknown design 400; ~/x stored absolute; relative 400; non-ASCII ok; empty clears; foreign Origin, no headers, foreign Host and cross-site Sec-Fetch-Site all 403; same-origin Sec-Fetch-Site 200; check:store 19; tsc + lint ok, 251083f
- in-progress: task 7
- done: task 7: classic preview 200 image/png with PNG signature, 0.72s cold then 0.018s cached (40x); unknown design 404 on the preview and the print route; ?template is ignored on a CV-version id; image checked by eye (page margins applied). Amended: 96 dpi (816x1056) instead of 60 dpi so text stays readable when scaled; tsc + lint ok, cbc2298
- in-progress: task 8
- done: task 8: owner's /designs shows 7 cards = 7 templates; on a scratch profile Make default (gutter) changes /templates' default and the next new CV version names gutter; a broken personal design's preview answers 400 and its card keeps its own name (no fallback); check:isolation 31/31 (adds /designs and B can't preview A's design). File map amended: components/design-card.tsx (card + Make default) replaces make-default-button.tsx, since the image's error fallback is client-side too; 36130b8
- in-progress: task 9
- done: task 9: a script fetched 9 pages; each has the 9 links in order and marks only its own; isSetupPending removed (no caller left) with its 4 check:start cases, check:start 17/17; tsc + lint ok, c90de51
- in-progress: task 10
- done: task 10: scratch profile, folder under .scratch/: save -> copy identical (cmp); rename + save -> old copy gone, new present; two CVs share a name: deleting one keeps the copy; deleting the other CV removes its copy; unwritable folder -> 200 with folderWarning; foreign Origin on save and delete -> 403; header-less save (the apply skill's curl) -> 200. FALSE premise fixed: the plan refused header-less requests, but fenix-apply POSTs save-pdf with plain curl; sameOrigin now allows requests with neither header (browsers always send one on POST/PATCH/DELETE) and the decision is amended above. File map: the CV delete route is app/api/p/[profile]/variants/[id]/route.ts (no cvs/[id]/route.ts exists). check:isolation 31/31; 43bd00f
- in-progress: task 11
- done: task 11: scratch profile: open with no folder 409, foreign Origin 403, cross-site 403, same-origin 200 (opened the scratch folder once); sync-cvs copied 2 live PDFs and skipped an orphan; the CVs page shows the folder, and a folder Fenix can't write to shows a warning there (save-pdf is only called by the apply skill today, so the bar checks the folder itself and the skill reports folderWarning); check:data ok, check:public only the 5 known plan files; tsc + lint ok. File map: added app/api/p/[profile]/cv-folder/sync/route.ts for Copy all, and fenix-apply's SKILL.md for folderWarning; 7db0b66
- in-progress: task 12
- done: task 12: memory note updated (CV folder setting; symlink still exists until removed); check:data ok; still listed in MEMORY.md; data repo 663fe86 (one file)
- review: /code-review high over cbfa18b..5473d1d, 10 findings, 10 fixed in 69e4746. (1) Home caught no error from Today, so one broken job file took it down: now an error line, setup still shows. (2) Only five routes had the origin check: it moved into `proxy.ts` for every non-GET `/api/*` request (foreign PATCH variant, POST tailor, cross-site POST jobs now 403; skills' header-less curl still passes). (3) A CV folder inside `data/` could delete a sent PDF on rename: the settings route refuses it and `resolveFolder` ignores it. (4) The folder warning fired when only a parent was missing: it now checks the nearest existing folder. (5) Preview renders deduplicated (two concurrent requests, one render). (6) No-reply ignores jobs with no recorded stage date (new check:jobs case). (7) README said "8 most recent"; it's the first 8 in the chosen sort. (8) `renderPdf`'s doc comment was above `renderPng`. (9) `syncFolder` resolved the folder once per CV. (10) Folder bar: fetch errors shown, Show in Finder confirms, the field shows the stored path after a save; the open route reports a failed `open`.
- browser pass: `.scratch/browser-pass/app-home.ts` 16/16 against the dev server (/ lands on Home; Home blocks in order with an interview under Today; header groups and Designs link; Applied shows 8 cards and See all lists all 38; a 40-day application shows "No reply in 40 days" on its card and on Home; all 6 previews render on a scratch profile; Make default marks Gutter and writes profile.yaml; CV folder saved and shown; a relative path refused). Show in Finder was opened once, on a scratch folder (task 11), and not clicked in the pass.
- checks after review: check:jobs 53/53, check:start 17/17, check:store 19, check:isolation 31/31, check:templates 32/32, check:resolve, check:tailor, check:data (258 files), lint, tsc; check:public: only the 5 plan files already listed.
- final: 7db028e, 12/12 tasks done. Nothing deferred. The owner has no CV folder set; it's set on the CVs page or by asking Claude.
