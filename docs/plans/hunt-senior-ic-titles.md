# Hunt: senior individual-contributor PM titles on company boards

## Spec

*Status: approved 2026-11-15*

### Problem / motivation

The board scanner keeps a role only when its title passes `keep_title` (`.claude/skills/fenix-hunt/hunt_core.py`): Director, Head, VP, Chief, or "Product … Lead". Senior individual-contributor titles are dropped: "Member of Product Staff", "Senior Product Manager", "Staff Product Manager". Only dream companies (`settings.dreamCompanies`) keep every product title.

Mauricio applies to these roles at top AI companies (Cohere PM, Stripe and Ashby Staff PM, Runway Member of Product Staff, Agents). They reach him only through LinkedIn. Runway's role was found by hand: `boards.py runway-ml` read 50 roles and kept 0.

Separately, the `home` flag (which tells the session to read a role) matches only the home country's name. A posting that says "open to hiring around the world" is not flagged, so the session's rule "read a role when home=True, when its location says remote without a country, or when it is dream" can skip it when the location lists US cities.

### Scope

In:
- Company boards keep Senior, Staff, Principal and Group Product Manager titles and "Member of Product Staff", in addition to today's titles.
- A role whose location or description says it hires anywhere / worldwide / around the world / globally is flagged for reading like a home-country mention.
- `targetTitles` in Mauricio's settings gains "Senior / Staff PM at AI companies", so fit scoring doesn't mark these roles off-level.
- The fenix-hunt skill text describes the new title rule and flag.

Out:
- Feeds (Himalayas, Wellfound, YC, fund and Canadian boards, LinkedIn): today's title filter stays.
- Dream-company logic, pay rules, remote verdicts.

### Success criteria

1. `OUT=.scratch/hunt/boards.json python3 .claude/skills/fenix-hunt/boards.py runway-ml` prints the "Member of Product Staff, Agents" role (while it is posted) with its open-worldwide flag set.
2. `pnpm check:hunt` passes, with new cases: the five title kinds kept on boards and still dropped from feeds; "Product Manager" (no seniority), "Associate PM" and "Product Designer" still dropped on boards; the worldwide phrases set the flag and "worldwide shipping" style false positives do not, as far as the cases cover.
3. One full board scan (`--only boards`) reports its role count before and after the change, so the added volume is visible.
4. `pnpm check:data` passes after the settings change.

### Approach

Add a board-only senior-IC pattern next to `SENIOR` and apply it where boards are filtered (`scan_boards`), leaving the feed filter unchanged. Extend the flag computed in `finish` with a fixed worldwide pattern alongside the person's home pattern, printed as its own marker so the session can tell the two apart.

Rejected:
- Make every AI company a dream company: keeps junior and associate PM roles too.
- Widen `SENIOR` everywhere: feeds would flood with senior PM roles from every industry.

### Open questions

- Exact output field for the worldwide flag (reuse `homeMention` or add `openWorld`): decided in the plan.

### Research notes

- `hunt_core.py` `SENIOR`, `WIDE`, `SKIP`, `keep_title`; `scan.py` `scan_boards`, `finish`.
- `docs/ai-companies.md`: the 68 boards added 2026-11-15 that this filter now applies to.

## Plan

Open question resolved: the worldwide flag is a new field, `openWorld`, printed as ` | world` on the role line. `homeMention` keeps meaning "names the person's country or cities", so the session can tell "says Canada" from "says anywhere".

### File map

| path | responsibility | new/modified |
|---|---|---|
| `.claude/skills/fenix-hunt/hunt_core.py` | `SENIOR_IC` pattern; `keep_title(title, wide=False, board=False)`; `OPEN_WORLD` pattern + `open_world(text)` | modified |
| `.claude/skills/fenix-hunt/scan.py` | boards call `keep_title(..., board=True)`; `finish` sets `openWorld`; `role_line` prints ` | world` | modified |
| `.claude/skills/fenix-hunt/test_scan.py` | title cases for board vs feed; `open_world` cases; `finish` sets the field | modified |
| `.claude/skills/fenix-hunt/SKILL.md` | "Script sources": boards keep senior IC titles; read a role when `world` is set | modified |
| `data/mauricio/profile.yaml` (via `pnpm fenix set-profile`) | `targetTitles` gains "Senior / Staff PM at AI companies" | modified (data repo) |

### Tasks

0. **Baseline count.** Before any code change: `OUT=.scratch/hunt/before.json python3 .claude/skills/fenix-hunt/scan.py --profile mauricio --only boards --all`, record the `N roles` line. Bounds: one request per watchlist board (~135) plus the detail cap the scanner already has.
1. **Title rule.** Add `SENIOR_IC = r"\b(senior|sr\.?|staff|principal|group|lead)\b.*\bproduct manager\b|\bmember of (the )?product staff\b"` and a `board` parameter: `keep_title` returns True for `SENIOR_IC` matches only when `board=True` (after the existing `SKIP` check, so "Senior Product Designer" stays out). `scan_boards` passes `board=True`; `scan_feeds` is unchanged. Reuse: extends `keep_title`, no new helper (grepped `keep_title`: callers are `scan_boards`, `scan_feeds`, tests). Edges: empty title stays False.
   Verification: `pnpm check:hunt` with literal cases — board=True keeps "Member of Product Staff, Agents", "Senior Product Manager, Agents", "Staff Product Manager", "Principal Product Manager, Platform", "Group Product Manager"; board=False drops the same five; board=True still drops "Product Manager, Billing", "Associate Product Manager", "Senior Product Designer", "Senior Product Marketing Manager". Existing cases unchanged. Commit.
2. **Worldwide flag.** Add `OPEN_WORLD`: a hiring/hire/hires/remote/work/based/located/candidate/distributed/team/employees word followed within four words by anywhere / around the world / worldwide / globally / any country, case-insensitive; `open_world(text)` returns a bool. `finish` sets `r["openWorld"] = open_world(f"{r['loc']} {r['text']}")` next to `homeMention`; `role_line` appends ` | world` when set. Edges: empty or missing text → False; non-ASCII passes through `re` unchanged.
   Verification: `pnpm check:hunt` with literal cases — True: "open to hiring around the world for the right candidate", "Remote: work from anywhere", "candidates based anywhere in North America or Europe"; also True: "We hire globally", "our team is distributed worldwide"; False: "Trusted by teams worldwide" (accepted miss: "teams" plural is not a trigger), "", "shipping globally since 2010", "Remote (US only)". Plus one `finish` case asserting `openWorld` on a role whose text has the Runway sentence. Commit.
3. **Live check and count.** `OUT=.scratch/hunt/boards.json python3 .claude/skills/fenix-hunt/boards.py runway-ml` prints "Member of Product Staff, Agents" with ` | world`. Then rerun task 0's command to `.scratch/hunt/after.json` and report before vs after counts (baseline: 143 roles). Decision rule: if the after count is more than 60 roles above the baseline, restrict senior IC titles to the AI section of `watchlist.txt` (entries after the "Fast-growing AI companies" header, plus dream companies) before committing; otherwise keep them for all boards. No commit.
4. **Skill text and settings.** In SKILL.md "Script sources", say boards also keep Senior/Staff/Principal/Group PM and Member of Product Staff titles, and add "or `world` is set" to the read rule (SKILL.md ~118), and add `world` to the role-line column list (~113). Write `.scratch/runway/settings.yaml` as `settings:\n  targetTitles: [...]` (nested under `settings`, the full list (existing three + "Senior / Staff PM at AI companies"; `set-profile` replaces the array) and run `pnpm fenix set-profile mauricio .scratch/runway/settings.yaml`.
   Verification: `pnpm check:data` passes and `grep -A5 targetTitles data/mauricio/profile.yaml` shows four entries. Commit (this repo: SKILL.md, plan; data repo commits itself through the store).

### Premises

- `hunt_core.keep_title(title, wide=False)` — the only title filter for boards and feeds.
- `scan.py scan_boards` — passes `lambda t: keep_title(t, slug in wide)` to `scan_company`.
- `scan.py scan_feeds` — filters with `keep_title(r["title"])`, no `wide`.
- `scan.py finish` — computes `homeMention` from `r['loc']` and `r['text']`; nothing in `lib/`, `app/` or `scripts/` reads `homeMention`.
- `scripts/fenix` `set-profile` — merges `settings` shallowly, so an array is replaced whole.
- `package.json` `check:hunt` — runs `test_scan.py`.

### Risks / unknowns

- Volume: senior PM titles across ~135 boards may add many roles per scan. Task 3 measures it; if it's large, the fix is a per-run cap or limiting IC titles to the AI section, as a follow-up.
- `OPEN_WORLD` false positives ("work with customers around the world"): acceptable, the flag only asks the session to read the role.
- Board-wide reach: senior IC titles also come in from non-AI boards (Amazon and Workday boards go through `scan_company` too). Task 3's decision rule bounds it.
- `SKIP` substrings drop "Senior PM, Accounts" and "Senior PM, Design Systems"; accepted, unchanged from today.
- Runway's posting may close before task 3; then the check uses the `finish` test from task 2 and says so.

### Robustness review (2026-11-15)

- Premises: all HOLD; missed ones (getro feed caller, Amazon/Workday through `scan_company`, `settings` nesting, SKILL column list) folded in above.
- Title rule: ROBUST (two booleans `wide`/`board` accepted over a `level` refactor for a smaller diff).
- `openWorld` field: ROBUST.
- Volume: was PATCHWORK (measured, unguarded); now a decision rule in task 3.

### Not yet specified

None.

### Out of scope

- Feeds' title filter (spec: would flood).
- Remote verdicts and pay rules (the session still judges each role).

### Research notes

- No outside libraries; Python `re` only.

## Status

- in-progress: task 0
- done: task 0: baseline board scan, 143 roles (11x NOT FOUND)
- in-progress: task 1
- done: task 1: check:hunt 137/137 (14 new title cases), c97fee1
- in-progress: task 2
- done: task 2: check:hunt 148/148 (11 new cases), 2cdf59d
- in-progress: task 3
- done: task 3: runway-ml keeps 3 roles incl. "Member of Product Staff, Agents | world"; all boards with IC titles: 143 → 415 (+272), over the 60 rule
- amendment (task 3 decision rule): AI boards moved to new `watchlist-ai.txt` (the 68 added today + Cohere, Writer, Gamma, Lovable, Replit, xAI, Cursor); `scan_boards(..., ic=)` keeps IC titles only for those, dream companies, and slugs looked up by name. Recount: 143 → 220 (+77, Databricks 23); Databricks moved to watchlist.txt (director-only) → about +55. One-time catch-up: later runs hide judged roles. 149/149 checks. 7e418b2
- in-progress: task 4
- done: task 4: SKILL.md updated; targetTitles has 4 entries (set-profile), check:data ok; hunt-profile memory updated, 2dcbbd4
- review: 7 findings, 4 fixed (US-only "anywhere" no longer flags world; no slug in both watchlists, checked; test stub restored in finally; dated move notes removed), 3 left by decision (loose "lead … product manager" titles are rare and judged by the session; name lookups keep IC titles as the spec says; merged roles keep the board's text in practice). check:hunt 152/152, runway-ml still flagged world. 99bdf5f
- final: 99bdf5f, 5/5 tasks done (0–4)
- follow-up (not started): hiring-post searches on LinkedIn and X pair "hiring" with director-level titles only, so senior IC roles at AI companies never surface there either.
