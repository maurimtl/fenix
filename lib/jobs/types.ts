import type { CLOSED_REASONS, COMP_SOURCES, REMOTE_VERDICTS, STAGE_SET_BY, STAGES } from "@/lib/store/schemas";

export type JobStage = (typeof STAGES)[number];
export type CompSource = (typeof COMP_SOURCES)[number];
export type StageSetBy = (typeof STAGE_SET_BY)[number];
export type RemoteVerdict = (typeof REMOTE_VERDICTS)[number];
export type ClosedReason = (typeof CLOSED_REASONS)[number];
