---
name: fenix-plan
description: "Use when an approved spec exists at docs/plans/<slug>.md and needs ordered implementation steps. Step 2 of the Fenix spec → plan → build workflow: writes the ## Plan section with file paths, premises, and per-task verification, gated by an adversarial robustness review on non-trivial plans."
model: fable
---

# Plan (how — file structure + ordered steps + verification)

Step 2 of the Fenix spec-driven workflow: **spec → plan → build**.

**Announce at start:** "I'm using the fenix-plan skill to write the implementation plan for `<slug>`."

## When to use

- A spec exists at `docs/plans/<slug>.md` under `## Spec` and has been approved
- You're about to hand implementation to another session (or to future you)

## When to skip

- No spec yet — start with `/fenix-spec`
- Trivial scope (single file, one obvious verification) — go straight to coding
- Spec already names the files and steps — append a one-paragraph plan and move on

## Iron law

```
NO CODE IS WRITTEN BY fenix-plan. THE PLAN IS A DOCUMENT.
```

**The approved spec sets the scope, and the plan delivers all of it** — don't quietly narrow, widen, or swap it. If you see a real problem with the spec, say so in a sentence or two and keep planning under a stated assumption. A question that blocks one part goes at the end of a turn that already delivers every part that doesn't depend on it. Write tasks in plain, direct statements.

## Process

### Step 1 — Load the spec

Read `## Spec`. Re-read **Success criteria** — the plan drives to those, nothing more. Resolve the spec's **Open questions** here: decide the ones you can and state the decision; carry the rest to "Not yet specified".

### Step 2 — Map file structure

List every file created or modified and its **single responsibility**. This is where decomposition gets locked in. Prefer smaller focused files with clear interfaces. Fenix conventions: server-only DB/AI code under `lib/<domain>/`; data schemas in `lib/store/schemas.ts` (files under `data/<person>/`, no migrations); API routes under `app/api/`; components under `components/` or colocated; project skills under `.claude/skills/`.

### Step 3 — Research implementation specifics (as needed)

For each major decision (library, API surface, file layout, Next.js feature), confirm current practice against the stack — generic Next.js advice is often stale for 16 / React 19. Compat-check both directions. Cite findings next to the task that uses them.

### Step 3b — Engineering verification (adversarial, for technique choices)

When a task encodes a technique choice (drag-and-drop library, upsert/dedupe strategy, PDF mechanism), spawn one `general-purpose` agent per cluster of decisions told to **find problems**: official docs for the pattern, known GitHub issues for the exact combination, a11y requirements. Verdict per decision: **SOUND / SOUND WITH CAVEAT / WRONG**. Fold every caveat into the task text or Risks — a caveat that lives only in the agent's output is lost at build time. **Cross-check "missing X" findings against the repo** before accepting them; often the code already has it.

Skip 3b when every task is plain CRUD/config.

### Step 4 — Break into bite-sized tasks

Each task = one logical chunk an executor can complete and verify before moving on. Order by dependency. 5-30 min of focused work, exactly one verification.

**Slice vertically.** A task cuts a narrow but complete path through every layer it needs (schema → lib → API → UI) so finishing it leaves something demoable and green. Avoid horizontal slices ("add all the types", "write all the routes") — they verify imagined behavior and leave nothing runnable. Size a slice to fit one context window.

Break a task further if it touches more than ~3 files, has more than one verification, or you'd want to commit midway.

**Wide-refactor exception:** a mechanical change that fans across the codebase (renaming a column or a widely-imported module) can't be a vertical slice. Sequence it **expand → migrate → contract**: add the new form alongside the old (green), move call sites in batches (each green), delete the old form last.

### Step 4b — Answer the questions review keeps asking

For each task, answer the ones that apply in the task text; where the answer is behavior, make it an assertion in that task's verification:

- **Reuse:** which existing helper does each new function duplicate? Name it, or write "none — grepped `<term>`".
- **Writes:** for each new DB write, what happens on a retry, a double submit, and a concurrent caller (e.g. an open editor tab saving over a scripted edit)?
- **Surfaces:** which surfaces run this path — UI pages, `app/api/` routes, `scripts/`, project skills — and does each one get the change?
- **Edges:** empty, zero, malformed, and non-ASCII input?
- **Bounds:** what caps every new loop, fetch, list, and page crawl?
- **Tests:** is each expected value a literal or derived independently, never computed with the code under test?

### Step 5 — Name the verification for each task

- Data schema change → `pnpm check:store` passes, and a script on a copy (`FENIX_DATA_DIR=.scratch/data-copy`) shows the new shape
- TS/lib change → `pnpm tsc --noEmit` clean (or `pnpm build`)
- Resolve/tailor logic → `pnpm check:resolve` / `pnpm check:tailor`
- API route → curl the route against the running dev server, assert the response shape
- UI/PDF behavior → state explicitly: "manual: open `/cv/<id>`, expect X" or "download PDF, expect 2-page layout matching template". Type checks verify code, not features.

**Never make a paid call a task's verification** (e.g. the Claude API tailoring endpoint): the builder would spend without asking. Name it once under Risks as "owner-approved run, once after the build" with a measured price, and give the task a free check instead.

### Step 6 — Write the plan

Append under a top-level `## Plan` section, and add an empty `## Status` section after it if none exists.

Plan structure:
- **File map** — table: `path` | `responsibility` | `new/modified`
- **Tasks** — numbered. Each: what to do (1-2 sentences) → files → verification → commit point
- **Premises** — load-bearing claims about the codebase, one line each: `path or symbol — claim` (e.g. `lib/resume/load.ts — loadCanonical returns positions with bullet ids`). Only those that, if false, break a task as written. fenix-build re-greps these before starting.
- **Risks / unknowns** — anything that could break a task as written. Each gets a mitigation or "we'll find out at task N."
- **Not yet specified** — in-scope work you can see but can't task yet because it hangs on a question a later task answers. It graduates into tasks once answered.
- **Out of scope** — work deliberately outside the success criteria, one line each with why. If it comes back, it comes back as a new spec.
- **Research notes** — links, one line each

### Step 7 — Robustness review (adversarial, conditional)

The owner should never have to ask "is this a good plan?" — the answer ships with the plan.

**Run it when the plan is worth it:** multi-session work, 3+ files, a schema migration, or anything touching the PDF/render path or AI calls. Below that bar, skip it — subagents double-checking small plans add tokens without improving the result.

When it runs, spawn fresh-context `general-purpose` agents (they did NOT write the plan) with `## Spec` + `## Plan`, told to **find patchwork, not bless the plan**. Fan out in one message so it runs in parallel:

- **Plan-shape agent** — reconstruction smell, bolt-on vs best-practice, one mechanism forced onto mismatched profiles, altitude not named.
- **Premise agent** — handed the **Premises** list; greps every entry and reports HOLDS / FALSE / UNVERIFIED, plus any load-bearing premise the list missed. Also checks cross-boundary reach (app code importing from `scripts/`).

The tells:
- **Reconstruction smell** — a task re-derives data the producing code already had (reading back from DB/logs what a variable upstream held). Capture at the source instead.
- **Bolt-on vs best-practice** — is each mechanism the current standard, or a workaround for a local quirk? Name the standard; confirm the plan is it.
- **Unverified load-bearing assumption** — FALSE = PATCHWORK; UNVERIFIED is reported, never silently dropped.
- **Mismatched profiles** — one mechanism shoved onto sub-problems with different cost/shape (free deterministic check vs paid LLM judgment). Split by profile.
- **Cross-boundary reach** — app runtime importing from `scripts/` or reaching across modules instead of promoting shared code to `lib/`.
- **Altitude not named** — where the plan took the smaller diff over the more robust direction, is the tradeoff stated?

Verdict per tell: **ROBUST** / **PATCHWORK** (with the more-robust alternative). Fold every PATCHWORK finding back into the plan, or surface it as an explicit velocity-vs-robustness choice. Present the plan **with the verdict attached** (one line per tell).

## Next

Once the plan is written (and the Step 7 verdict attached, when it ran) → `/fenix-build <slug>`.
