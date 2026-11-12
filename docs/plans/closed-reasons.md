# Closed reasons

## Spec

*Status: approved 2026-11-09*

**Problem / motivation.** The Closed column mixes different endings: a company rejected him (Censys, AIOS), he chose not to pursue, or the process went quiet. Without the reason the board can't tell them apart, and he can't later count rejections against silence.

**Scope.**
- In: every closed job carries one reason:
  - **Rejected:** they said no.
  - **Passed:** he chose to stop, before or after applying, including withdrawing.
  - **Fell off:** the process stalled or they stopped replying.
  - **Posting closed:** the posting came down before he got anywhere.
- In: the stage menu on cards, the job page and the filtered list offers "Closed: Rejected", "Closed: Passed", "Closed: Fell off" and "Closed: Posting closed" in place of a bare "Closed". One pick moves the job and records the reason.
- In: each closed card shows its reason as a tag, and the Closed column header counts each reason.
- In: leaving Closed clears the reason. The jobs API refuses to close a job without a reason.
- In: jobs closed earlier show "no reason" until one is set. As part of the build, AIOS and Censys are set to Rejected (their notes say so) and the person is asked about the rest.
- Out: extra board columns; any change to "Filtered out"; `check:closed` moving stages (it still only flags); a stats page.

**Success criteria.**
1. The stage menu lists the four Closed choices. Picking one moves the job and its card shows the reason tag.
2. The job file has `closedReason: rejected | passed | fell_off | posting_closed`, and `stageHistory` records the move.
3. `PATCH /api/p/<p>/jobs/<id>` with `{"stage":"CLOSED"}` and no reason returns 400. Moving a closed job to any other stage clears `closedReason`.
4. The Closed column header shows counts per reason.
5. `pnpm check:jobs` covers the patch rules. `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm check:data` pass.

**Approach.** Add an optional `closedReason` field to the existing CLOSED stage, set through the same PATCH that moves the stage. Rejected alternatives:
- Separate CLOSED_* stages: three more board columns, and every stage list changes.
- Reasons kept in notes: nothing could count them or show them as tags.

**Calls made for the person.**
- Withdrawing counts as Passed.
- The reason is part of the stage pick, not a second step.
- Legacy closed jobs may have no reason.

**Open questions.** None. `pnpm fenix` has no stage command, so only the API needs the rule.

## Plan

1. `lib/store/schemas.ts`: add `CLOSED_REASONS`, and `closedReason: z.enum(CLOSED_REASONS).nullish()` on the job schema. `lib/jobs/types.ts`: add the `ClosedReason` type.
2. `lib/jobs/schema.ts`: `jobPatchSchema` accepts `closedReason`. `stage: "CLOSED"` requires it, and it is only accepted together with `stage: "CLOSED"`.
3. `lib/jobs/repo.ts`: `moveStage` clears `closedReason` when the stage is not CLOSED. `patchJob` sets the reason, re-reasons an already-closed job, and names the reason in the commit message.
4. `lib/store/jobs.ts` `toJob`: expose `closedReason`.
5. `lib/jobs/format.ts`: `CLOSED_REASON_LABEL`, plus the stage-menu options (four Closed entries, and "Closed: no reason" only for a legacy closed job).
6. `components/job-stage-select.tsx`: takes `closedReason`, encodes the options as `CLOSED:<reason>`, and sends `{ stage, closedReason }`. Callers pass it: the card, the job page and the filtered list.
7. `components/job-card.tsx`: reason tag on closed cards. `app/p/[profile]/jobs/page.tsx`: per-reason counts under the Closed header. `app/globals.css`: tag and count styles.
8. `scripts/check-jobs.ts`: patch-schema cases (close without a reason → invalid; reason without CLOSED → invalid; close with a reason → valid).
9. Data: set AIOS and Censys to Rejected through the API; ask the person about the other five.

Verification: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm check:jobs`, `pnpm check:data`, PATCH calls against the dev server on 3007, and the board read in the browser.

## Status

Built 2026-11-09, steps 1–9.
- `pnpm check:jobs`, `tsc`, `lint` and `check:data` pass.
- On the dev server: closing without a reason returns 400.
- AIOS and Censys are set to Rejected, and the board shows "2 rejected" under Closed.
- Open: reasons for Docker (Sandbox platform), GitLab (SaaS Platforms), the two Ladders roles and Prime Intellect, which wait on the owner.
- Added 2026-11-09 at the owner's request: a fifth reason, **Low fit** (`low_fit`), for roles he drops because they don't match. Passed stays for any other choice to stop.
