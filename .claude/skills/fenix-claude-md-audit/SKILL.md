---
name: fenix-claude-md-audit
description: Audit the project's instruction set — CLAUDE.md, .claude/rules/*, nested CLAUDE.md, skill frontmatter, AND the auto-memory store (MEMORY.md index + its memory files) — against Anthropic's official memory guidance plus best practices. Use when asked to review/optimize/clean up CLAUDE.md, the rules, or memory, when you suspect instruction drift or bloat, or for a periodic "is our instruction set still optimal?" check. Diagnostic by default — flags and proposes fixes, doesn't rewrite unless asked.
---

# CLAUDE.md Audit

Audit the always-/conditionally-loaded instruction set: a **mechanical floor** (deterministic checks) and a **judgment layer** (drift, framing, mechanism-fit no regex catches). Diagnostic, not a rewrite tool — flag the exact line, say why it fails, propose a specific fix. Apply only when the user opts in (Step 6).

**Announce at start:** "I'm running the fenix-claude-md-audit skill."

Rubric grounded in official Anthropic docs (code.claude.com/docs/en/memory and /best-practices). Written for Fenix (no `check-claude-md.mjs` yet — Step 1 runs its sub-checks by hand; the memory-integrity one-liners below are machine-local and portable as-is).

## In scope

| Layer | Lives in | Load behavior |
|---|---|---|
| Root instructions | `CLAUDE.md` | Every session, in full — most expensive |
| Path-scoped rules | `.claude/rules/*.md` | `paths:` frontmatter → only when Claude **reads** a matching file; no frontmatter → every session |
| Nested instructions | `**/CLAUDE.md` in subdirs | On-demand, when Claude reads files there |
| Auto-memory store | `~/.claude/projects/<proj>/memory/` — `MEMORY.md` index + per-fact `*.md` | Index: first 200 lines every session. Files: on recall |
| Skill discovery surface | `.claude/skills/*/SKILL.md` frontmatter | `description` always loaded; body on-demand |

## Step 1 — Mechanical floor (deterministic)

Run these by hand (no ported script yet):
1. **Size.** Lines AND words per always-loaded file. Official target **under 200 lines**, but treat **words** as the real always-loaded cost. Flag the root over 200 lines OR visibly word-heavy.
2. **Density offenders.** Single lines over ~60 words — trim or migrate first.
3. **Dead references.** Grep each `path/like/this` mentioned in instruction files against the real tree. A stale ref is worse than none.
4. **Ephemeral references.** Any concrete `docs/plans/<name>.md` citation in an instruction file — plans are churned/deleted working specs; instruction files must point at a stable `docs/*.md`. (Placeholders like `docs/plans/<slug>.md` are exempt.)
5. **Glob coverage.** Each `paths:` glob must match ≥1 real file. Path-scoped rules load on **read**, not on **Write** of a new file.
6. **Coverage gaps (informational).** Only a finding if the root carries HEAVY always-loaded prose about a subtree that could move into a scoped rule. A lean one-line pointer is fine.

## Step 2 — Judgment audit

Per dimension: pass = note briefly; violation = exact quote + file:line, severity, specific fix.

1. **Bloat in the always-loaded root.** Per line: *"would removing this cause Claude to make a mistake?"* If not, cut it. Reference material and enumerations belong in an on-demand doc, a scoped rule, or a skill. `@path` imports do NOT save context (load at launch like inline text); only scoped rules and skills defer it.
2. **Root ↔ rules redundancy.** Content in both `CLAUDE.md` and a rule is paid twice and drifts. Cross-reference good; restating the body is the anti-pattern.
3. **Action-first framing.** Tell Claude what to *do*, then name the wrong path. "Use `npm`, never yarn/pnpm" is good (names the rejected attractor). A bare prohibition with no alternative is the anti-pattern — flip it.
4. **Staleness / judgment.** Version numbers, dated notes, tool/symbol names that may have moved. High-risk = anything with a number or proper name — including renamed components/symbols a path-grep won't catch.
5. **Contradictions — required independent pass.** Conflicting instructions across root + rules. Run as a **subagent with fresh eyes** (`Agent`/`Explore`): hand it the concatenated instruction set, ask *only* for contradictions and near-duplicates. If none, say so explicitly.
6. **Mechanism fit.** CLAUDE.md is a *user message, not enforced config*. "Must happen every time" prose → belongs in a **hook**. Style rules a linter/formatter/`tsc` already enforces → delete from prose. Genuine always-true facts → correctly belong in CLAUDE.md.
7. **Specificity.** Concrete and checkable ("API routes live in `app/api/`") beats vague ("keep files organized").
8. **Untapped official mechanisms.** Block-level `<!-- -->` comments (stripped before injection — free notes), the `InstructionsLoaded` hook, `/memory` to inspect what's loaded.
9. **The other always-loaded surfaces — audit, don't wave through.**
   - **Auto-memory store (`MEMORY.md` index + files).** The index loads every session — highest staleness risk. Two failure modes: **hoarding** (drown the signal) and **amnesia** (prune away a rare-but-vital gotcha).
     - **Index size.** Pointer-heavy index stays high-signal at ~80–120 lines; report count against that band.
     - **Keep-test, per entry.** Keep iff **non-obvious AND not reconstructable from repo/git**. Cut version-bump history, completed-migration logs, shipped-work tombstones, and detail that now lives in a `docs/*.md`.
     - **Stale-contradicts-code is worse than a dead link.** Spot-read entries naming a symbol/file/flag against current code.
     - **Integrity checks (run from the memory dir, Python — the zsh assoc-array form false-positives):** (1) *Orphan* = memory file with no `MEMORY.md` pointer. (2) *Dangling pointer* = `MEMORY.md` link to a missing file. (3) *Wikilink graph* = every `[[X]]` matches some file's `name:` slug. Convention: `name:` == `kebab(filename-stem)`. One-shot dangling-link check:
       `python3 -c "import glob,re,os; F=[f for f in glob.glob('*.md') if os.path.basename(f)!='MEMORY.md']; N={re.search(r'(?m)^\s*name:\s*(.+)',open(f).read()).group(1).strip().strip(chr(34)) for f in F}; [print('DANGLING',os.path.basename(f),'->',l) for f in F for l in re.findall(r'\[\[([^\]]+)\]\]',open(f).read()) if l not in N]"`
     - **Consolidate near-duplicates by trigger, not topic.** Read the actual files + map the reference graph BEFORE merging (the index oversells redundancy; an externally-cited entry is load-bearing). Merge only when the merged trigger stays as sharp. After folding, delete the absorbed file AND its index pointer, and de-dangle any `[[link]]`.
   - **Skill frontmatter `description`s** — every one is always-loaded. Flag paragraph-length descriptions where a sentence would do.

## Step 3 — Severity

- 🔴 **Critical (active error now):** hard dead ref, `docs/plans/` ephemeral ref, contradiction, glob matching nothing, "must happen every time" rule in prose instead of a hook.
- 🟡 **Moderate (degradation risk):** root↔rules redundancy, bare prohibition, stale-but-harmless note, vague directive, **bloat** (default moderate; escalate to 🔴 only with evidence real rules are being dropped).
- 🟢 **Minor (polish):** density trims, an `@import` that could be a rule, overlong skill description.

Placement scales it: a stale ref in the always-loaded root is worse than in a rarely-read rule.

## Step 4 — Instruction budget read

One paragraph on the whole set: total always-loaded weight (root + no-`paths` rules + MEMORY.md head), how it tracks against the ~150–200-instruction adherence heuristic, and the single highest-leverage move (almost always "trim the always-loaded root").

## Step 5 — Output

```
# CLAUDE.md Audit
**Overall read:** [1-2 sentences]
## Mechanical floor
- Sizes / density / dead refs / ephemeral refs / glob coverage / gaps
- Contradiction pass: [ran via subagent — findings or "none found"]
- MEMORY.md + skill descriptions: [findings or "clean"]
## 🔴 Critical / 🟡 Moderate / 🟢 Minor   [table: Dimension | File:line | Quote | Problem | Fix]
## Instruction budget   [one paragraph]
```

## Step 6 — Apply (opt-in only)

Default diagnostic. If asked to apply: mechanical + framing fixes first (low-risk); treat bloat trims as higher-judgment (show the diff, content moved out of root must land somewhere it still loads when relevant). Re-run the mechanical checks after.
