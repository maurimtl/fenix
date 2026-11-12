import { z } from "zod";
import { FX_TO_USD } from "./config";
import { CLOSED_REASONS } from "@/lib/store/schemas";

const text = (max: number) => z.string().trim().min(1).max(max);
const amount = z.number().int().positive().max(10_000_000);

export const jobInputSchema = z
  .object({
    source: text(40),
    sourceJobId: text(200),
    url: z.url().max(2000),
    companyUrl: z.url().max(2000).nullish(),
    company: text(200),
    title: text(300),
    locationText: text(300).nullish(),

    compMin: amount.nullish(),
    compMax: amount.nullish(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((c) => c in FX_TO_USD, { message: `currency must be one of ${Object.keys(FX_TO_USD).join(", ")}` })
      .nullish(),
    compSource: z.enum(["posting", "company_site", "estimate", "unknown"]),
    compEvidence: text(2000).nullish(),

    // "canada_ok" is the old spelling, still accepted from callers and stored as "country_ok".
    remoteVerdict: z
      .enum(["country_ok", "canada_ok", "sponsorship_offered", "us_only", "onsite", "unclear"])
      .transform((v) => (v === "canada_ok" ? "country_ok" : v)),
    remoteEvidence: text(2000).nullish(),
    remoteEvidenceUrl: z.url().max(2000).nullish(),

    jdText: text(60_000).nullish(),
    fitScore: z.number().int().min(0).max(100).nullish(),
    whyGood: text(4000).nullish(),
    redFlags: text(4000).nullish(),
    easyApply: z.boolean().nullish(),
    applicants: z.number().int().min(0).nullish(),
  })
  .refine((j) => j.compMin == null || j.compMax == null || j.compMin <= j.compMax, {
    message: "compMin must be <= compMax",
    path: ["compMin"],
  })
  // Ids are matched exactly when deduping, so they must be the board's own id (no company prefix).
  .refine((j) => !(j.source in BOARD_ID) || BOARD_ID[j.source].test(j.sourceJobId), {
    message: "sourceJobId must be the board's own id: digits for linkedin and greenhouse, a UUID for ashby and lever",
    path: ["sourceJobId"],
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARD_ID: Record<string, RegExp> = { linkedin: /^\d+$/, greenhouse: /^\d+$/, ashby: UUID, lever: UUID };

export type JobInput = z.infer<typeof jobInputSchema>;

export const STAGES = [
  "FOUND",
  "SHORTLISTED",
  "CV_READY",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "CLOSED",
  "FILTERED_OUT",
] as const;

export const jobPatchSchema = z
  .object({
    stage: z.enum(STAGES).optional(),
    closedReason: z.enum(CLOSED_REASONS).optional(),
    notes: z.string().max(10_000).nullable().optional(),
    /** Both together; null clears the flag (the posting came back). */
    postingClosedAt: z.iso.datetime().nullable().optional(),
    postingClosedEvidence: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .refine((p) => p.stage !== undefined || p.notes !== undefined || p.postingClosedAt !== undefined, { message: "nothing to update" })
  .refine((p) => p.stage !== "CLOSED" || p.closedReason !== undefined, {
    message: "closing a job needs a closedReason (rejected, passed, low_fit, fell_off, posting_closed or no_response)",
    path: ["closedReason"],
  })
  .refine((p) => p.closedReason === undefined || p.stage === "CLOSED", {
    message: "closedReason goes with stage CLOSED",
    path: ["closedReason"],
  })
  .refine((p) => (p.postingClosedAt == null) === (p.postingClosedEvidence == null), {
    message: "postingClosedAt and postingClosedEvidence go together",
  });

export const answersPutSchema = z.object({
  answers: z
    .array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().max(5_000) }))
    .min(1)
    .max(100),
});
