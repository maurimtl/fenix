# Fenix

A local CV studio and job-hunt pipeline, run with Claude Code. Each person keeps one career record; Fenix makes a lightly tailored CV version per application (viewable in the browser, downloadable as a PDF) and tracks the jobs they're applying to, the answers they gave and the CVs they sent. Several people can share one install; each has their own folder in `data/`.

Localhost-only, no auth. Start with `README.md`; the design is in `docs/architecture.md`.

## Stack

- **Next.js** (App Router) + React + TypeScript
- **Plain files, no database:** each person's data is YAML and Markdown under `data/<person>/`, read and written through `lib/store/` (zod schemas, atomic writes, a per-person lock, a git commit per save)
- **CV designs** are Liquid templates (`templates/` built in, `data/<person>/templates/` personal), rendered in a sandboxed worker
- **Anthropic Claude API** for the optional paste-a-job-description tailoring route (see the `claude-api` skill for model IDs and pricing before touching AI code)
- **Playwright** headless Chromium for print-to-PDF
- Package manager: pnpm (never npm/npx)

## People and pages

- Every page and API route is under `/p/<person>/…` and `/api/p/<person>/…`; `/profiles` lists people.
- Skills take the person as `<p>`. With one profile it's that one; otherwise name it or set `FENIX_PROFILE`.
- **Never read or write one person's data while working for another.** Before LinkedIn or an application form, the skills check the signed-in name matches the profile.

## Data model

- **Career record** (`career.yaml`, `profile.yaml`) = the fixed truth: profile, positions with bullets, education, skills, courses. Edited rarely.
- **CV version** (`cvs/*.yaml`) = one tailored CV: overrides the headline/summary, picks and rewords bullets, picks skills, names a template. Never changes the career record.
- **Hunt state** (`hunt/seen.yaml`): the roles and posts the hunt has already judged, written through `/api/p/<person>/hunt`.
- **Jobs** (`jobs/*.md`), **stories** (`stories/*.md`), **interviews** (`interviews/*.md`, one per round, plus `interview-answers.md`), **memory** (`memory/`), **templates** (`templates/`).
- **Number rule:** every number in a CV version or LinkedIn draft must already be in the career record or a story (`pnpm check:claims`).

## Writing data

- The app's API and `pnpm fenix <command>` own jobs, answers, CV versions, the career record and settings; both go through `lib/store`. Skills write memory, stories, interviews and personal templates directly, then run `pnpm check:data`.
- A profile folder with a `.scratch-profile` file is a throwaway: its saves are never committed (`pnpm fenix create-profile --scratch`, `remove-scratch`).
- `settings.cvFolder` gets a copy of each saved CV PDF; `pnpm fenix sync-cvs <person>` fills it from the live CV versions.

## Memory

Claude's private memory folder is off (`autoMemoryEnabled: false`). Write each kind where it belongs:
- **About a person** (preferences, applications in flight, facts not in their career record): `data/<person>/memory/`, one file per fact with `name` and `description` front matter, listed in that folder's `MEMORY.md`. The session-start hook prints the index; `pnpm check:data` checks the links.
- **About the job-hunt workflow** (a site changed, a form trap): `docs/learnings/`.
- **About building Fenix**: this file or the code.

## Workflow for changes

Spec-driven: **fenix-spec → fenix-plan → fenix-build** (skills in `.claude/skills/`). Plans live in `docs/plans/<slug>.md`, one file per topic; each skill appends its own section (`## Spec`, `## Plan`, `## Status`). No code until the spec is approved.

## Commands

- `pnpm get-started` — first run: installs the libraries, makes `data/` a git repo, adds the demo person, creates `.env`, installs Chromium.
- `pnpm dev` — dev server on **port 3007**. Server code that calls the app itself (PDF render) uses `APP_URL` from `lib/app-url.ts`; keep its default in step with the `-p` port in `package.json`.
- **`data/` is its own git repo**, ignored by this one. `pnpm backup` commits it and pushes when it has a remote. Restore: `git clone <private data repo> data`.
- **Never run `git clean -ffdx` in this repo** (it is denied in `.claude/settings.json`): the doubled `-f` deletes the nested `data/` repo. A git worktree has no `data/`; set `FENIX_DATA_DIR` to the main checkout's `data/` there.
- `pnpm check:closed <person> [--write]` asks Ashby, Greenhouse and Lever whether open jobs are still posted; `--write` marks closed ones.
- `pnpm backfill:posted <person> [--write]` asks the same boards when open and applied jobs were posted; `--write` stores the date. Jobs carry `postedAt`; one 21 days old or more with fit under `strongMatchFit` is held in Found as stale (`lib/jobs/freshness.ts`).
- Checks: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm check:data`, `check:claims`, `check:templates`, `check:isolation`, `check:public`, `check:store`, `check:jobs`, `check:hunt` (the hunt scanner's parsers, offline), `check:resolve`, `check:tailor`, `check:liveness`, `check:start`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
