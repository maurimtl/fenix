---
name: fenix-spec
description: Use when starting a new feature or non-trivial task in Fenix. Step 1 of the Fenix spec-driven workflow (spec → plan → build). Captures what + why + success criteria into docs/plans/<slug>.md as the artifact downstream sessions pick up. No code until the spec is approved.
model: fable
---

# Spec (what + why + success criteria)

Step 1 of the Fenix spec-driven workflow: **spec → plan → build**. Written for this project's stack (Next.js + plain files under `data/`, localhost-only, no auth).

**Model routing:** `model: fable` covers only the turn that invoked this skill; follow-up turns run on the session's model. Never ask the owner to pick a model. Settle the judgment-heavy decisions inside this turn, and if the spec needs another round, say that `/fenix-spec <slug>` resumes it on Fable.

**Announce at start:** "I'm using the fenix-spec skill to capture the spec for this idea."

## When to use

- Starting a feature or non-trivial task (multi-file, multi-session)
- Anything that will outlive the current session — the spec is the handoff artifact between you, future you, and other sessions

## When to skip

- One-file fixes you'll knock out in this session
- Refactors with obvious scope and a single verification command

## Iron law

```
NO CODE, NO PLAN, NO IMPLEMENTATION UNTIL THE SPEC IS WRITTEN
AND THE OWNER HAS APPROVED IT.
```

Locking scope here is what makes downstream velocity safe. Re-opening strategic decisions mid-build wastes the most expensive minutes of the day.

## Process

### Step 1 — Explore project context

Before asking anything:
- Read `CLAUDE.md` (re-check the section closest to the topic)
- Scan memory (`MEMORY.md` index, then linked entries)
- Read 2-3 files closest to the topic — actual source, not just docs
- Skim recent commits in that area: `git log --oneline -20 -- path/to/area/`

If the topic touches a settled decision (an earlier plan in `docs/plans/`, a memory entry), name it before proposing alternatives — don't relitigate by accident.

### Step 2 — Research (light touch for a personal tool)

Surface 1-3 relevant findings with source links if a library or non-obvious pattern is on the table. Compat-check against the stack in both directions: **Next.js 16, React 19, TypeScript, plain files (YAML/Markdown), Anthropic Claude API (see the `claude-api` skill), Playwright (PDF)**. For a library, check active maintenance and last release. Summarize; don't paste quotes. Don't over-invest — velocity matters for a single-user tool.

### Step 2b — External-claim verification (adversarial, only when load-bearing)

When a design decision rests on a claim about an outside product, site, or rule ("LinkedIn shows salary on X", "TN covers Y", "EnhanceCV does Z"), verify it by trying to refute it. Spawn one `general-purpose` agent told to **REFUTE each claim** against current docs and evidence, not confirm it. One verdict per claim: **SOUND / SOUND WITH CAVEAT (exact correction) / WRONG (evidence) / UNSUPPORTED**. Record verdicts, including claims that survived, in a `### External verification (date)` subsection of the spec.

Skip 2b when the spec has no outside claims (internal refactor, schema, UI on our own data).

### Step 3 — Close only the questions that change the spec

Done when you can write every success criterion as a command or observable behavior. Make routine judgment calls yourself and state them as assumptions in the spec. Ask only where different readings would produce materially different specs, after Steps 1–2 answered what the repo and the web can. If the owner gave a long brief, you're already past this step.

### Step 4 — Propose 2-3 approaches

Compare honest failure modes. When one option's worst case is another's normal case, say so; don't offer the dominated option as a velocity shortcut. Pick a recommendation and say why.

### Step 5 — Present the spec, get explicit approval

Walk through the sections first; get sign-off before writing the file. Call out every judgment call you made on his behalf.

### Step 6 — Write the spec

Write to `docs/plans/<slug>.md` under a top-level `## Spec` section, with a status line (`*Status: awaiting approval*` / `*Status: approved <date>*`). `<slug>` is kebab-case and descriptive. One file per topic — plan and build append to the same file.

Write in plain, direct statements. No metaphor or flourish where a literal phrase exists.

Spec structure:
- **Problem / motivation** — what's missing today, why now
- **Scope** — what's in, what's out (be explicit about out)
- **Success criteria** — concrete "done" checks, each verifiable by a command or observable behavior
- **Approach** — recommended approach with rationale; rejected approaches in one line each
- **Open questions** — anything deferred to the plan
- **Research notes** — links, one line each

## Next

Once approved → `/fenix-plan <slug>` to break it into implementation steps.
