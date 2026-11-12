---
name: fenix-build
description: Use when docs/plans/<slug>.md has an approved ## Plan section and you're ready to execute. Step 3 of the Fenix spec-driven workflow (spec → plan → build). Runs each task with its verification, updates ## Status as it goes, and ends in one review over the whole plan.
model: opus
---

# Build (execute the plan)

Step 3 of the Fenix spec-driven workflow: **spec → plan → build**.

**Announce at start:** "I'm using the fenix-build skill to execute the plan in `<slug>`."

## When to use

- `docs/plans/<slug>.md` has an approved `## Plan` section

## Arguments

`/fenix-build <slug> [--no-review]` — `--no-review` skips Step 5's review. Say so in `## Status` rather than leaving the omission silent.

## Iron law

```
EACH TASK GETS VERIFIED BEFORE THE NEXT STARTS.
NO "ALL DONE, WILL CHECK AT THE END."
```

Run the task's verification fresh, read the full output, check the exit code, *then* mark complete. A claim made before the command ran in this session is a guess with a confident tone — and `## Status` is read by sessions that can't tell the difference.

## Process

### Step 1 — Decide where to run

In-session by default. Use a worktree (`Agent` with `isolation: "worktree"`, no `subagent_type`) only if the work spans days, or parallel work in the main checkout would be disturbed. In a worktree: `pnpm install` first, copy `.env`, never start the dev server — browser checks from a worktree hit the main checkout's server and are a false green; run them after merge-back.

### Step 2 — Review the plan critically

Re-read `## Spec` and `## Plan`. The bar to raise a concern is **"actively wrong,"** not "different opinion now."

"Actively wrong" has a cheap mechanical check: grep each entry in the plan's **Premises** once — the code may have moved since planning. A FALSE premise is fixed in the plan, never routed around in code: amend the task, File map, and Premises, note it in `## Status`, keep going.

**Stop list** — stop and ask the owner only when the fix needs an outward action (push, message, anything off this machine), real money (paid Claude API runs), or a user-visible change beyond the plan's intent. Everything else: decide, amend the plan, proceed, and report the amendment in the end-of-build summary.

### Step 3 — Execute each task

For each task in `## Plan`:

1. **Append `- in-progress: task <N>` to `## Status`.** Don't overwrite — history is useful.
2. **Implement the task.** Touch only the files the plan named. If you need a file outside that list, add it to the File map with a `## Status` note and proceed, unless it hits the stop list.
3. **Read your own diff** (`git diff`, plus every new file `git status` lists) for the classes review finds most:
   - every comment in a function you changed still describes the code;
   - every doc hunk you edited still matches the code as the task left it;
   - no new function duplicates an existing helper (grep before keeping it).
4. **Run the verification from the plan.** Full command, fresh, complete output. Tests → read the count. Type check → 0 errors. Build → exit 0. **A subagent's success report is not verification** — read `git diff` for the files it claimed to touch.
   - Browser/PDF behavior: defer interactive browsing to Step 5's single pass rather than snapshotting pages every task; per task, a curl or script check is enough.
5. **If it passes:** append `- done: task <N>: <verification summary>, <commit SHA>` to `## Status`.
6. **If it fails:** stop. Find root cause before fixing (`obra-systematic-debugging`) — symptom fixes are failure. Escalate if stuck.

### Step 4 — Commits

- Commit after each logical task (small commits over batched); follow `git log --oneline -10` style.
- After the last task, append `- final: <last SHA>, <N>/<N> tasks done` to `## Status` and commit it.
- Never push without the owner's explicit request to push in chat.
- Don't review per task — the review runs once, at Step 5.

### Step 5 — Review once, over the whole plan

**A build is finished only when nothing it implies is left open:** the data repair for rows already affected, the script it needs, the doc or CLAUDE.md line that changed, the memory entry that's now stale. Resolve each inside the build (asking only for outward actions); never report "done, 1–2 things open."

Then run `/code-review` once over the plan's range (`<first task's parent>..<tip SHA>` — resolve the tip to a SHA, not `HEAD`), checking against `## Spec` for dropped requirements and scope creep. Fix what it finds and record `review: <N> findings fixed` in `## Status`.

**If the plan touched UI or PDF** (`app/**/*.tsx`, `components/**`, `templates/**`), do one browse-and-assert pass over the affected flows with Playwright against the local dev server (the owner runs it; don't start or restart it — ask if it's down). Assert with scripted checks, not full-page screenshots, except for PDF/template fidelity, which needs eyeballing against the person's reference designs in `data/<person>/reference/`.

### Step 6 — Update `## Status` with final state

Append the final commit SHA(s) and anything deferred (follow-up plan in `docs/plans/`, TODO). Update CLAUDE.md or memory entries the build made stale.

## When the executor is a different session than the planner

The conversational context lives in the plan file, not your window. Re-read `## Spec` and `## Plan` carefully before starting, and surface scope concerns before executing — once coding starts, don't relitigate.
