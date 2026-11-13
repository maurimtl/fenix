import { z } from "zod";
import { overridesSchema } from "@/lib/resume/schema";

// Loose objects: unknown keys a person or Claude adds by hand are kept, never dropped.
const str = z.string();
const optStr = z.string().nullish();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "expected an ISO date (YYYY-MM-DD)");
const optIsoDate = isoDate.nullish();

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
export const REMOTE_VERDICTS = ["country_ok", "sponsorship_offered", "us_only", "onsite", "unclear"] as const;
export const COMP_SOURCES = ["posting", "company_site", "estimate", "unknown"] as const;
export const POSTED_SOURCES = ["board", "listing"] as const;
export const STAGE_SET_BY = ["agent", "user"] as const;
export const CLOSED_REASONS = ["rejected", "passed", "low_fit", "fell_off", "posting_closed", "no_response"] as const;

export const settingsSchema = z.looseObject({
  floorUsd: z.number().int().nonnegative(),
  strongMatchFit: z.number().int().min(0).max(100).default(75),
  /** ISO 3166 alpha-2 country the person lives and works in, e.g. "CA". */
  homeCountry: z.string().length(2),
  homeCountryName: str,
  /** Plain-language rule the hunt skill applies, e.g. "remote, hiring in Canada, or visa sponsorship". */
  remoteRule: str,
  exceptions: z.array(str).default([]),
  targetTitles: z.array(str).default([]),
  queries: z.array(str).default([]),
  watchlistExtra: z.array(str).default([]),
  /** Companies whose whole board the hunt reads (any product or growth title), as watchlist entries: "slug[:board[:extra]]". */
  dreamCompanies: z.array(str).default([]),
  /** CV PDF file name pattern; {name}, {company}, {role} are filled in. */
  cvFileName: str.default("{name} - {company} - {role}"),
  defaultTemplate: str.default("sidebar"),
  /** Absolute path of a folder that gets a copy of every CV PDF the app saves; unset means no copies. */
  cvFolder: optStr,
});

export const profileSchema = z.looseObject({
  fullName: str.min(1),
  headline: str,
  email: str,
  phone: optStr,
  location: optStr,
  summary: str,
  about: optStr,
  linkedin: optStr,
  settings: settingsSchema,
});

export const bulletSchema = z.looseObject({
  id: str.min(1),
  text: str,
  altText: optStr,
  altCurrency: optStr,
  story: optStr,
});

export const positionSchema = z.looseObject({
  id: str.min(1),
  title: str.min(1),
  location: optStr,
  startDate: isoDate,
  endDate: optIsoDate,
  bullets: z.array(bulletSchema).default([]),
});

export const companySchema = z.looseObject({
  id: str.min(1),
  name: str.min(1),
  positions: z.array(positionSchema).default([]),
});

export const careerSchema = z.looseObject({
  companies: z.array(companySchema).default([]),
  education: z
    .array(
      z.looseObject({
        id: str.min(1),
        degree: str,
        institution: str,
        location: optStr,
        startYear: z.number().int().nullish(),
        endYear: z.number().int().nullish(),
      }),
    )
    .default([]),
  skills: z.array(z.looseObject({ id: str.min(1), name: str.min(1) })).default([]),
  courses: z
    .array(z.looseObject({ id: str.min(1), name: str.min(1), term: optStr, provider: optStr }))
    .default([]),
});

export const answerSchema = z.looseObject({
  question: str.min(1),
  answer: str,
  story: optStr,
  createdAt: optIsoDate,
  updatedAt: optIsoDate,
});

export const jobSchema = z.looseObject({
  id: str.min(1),
  source: str.min(1),
  sourceJobId: str.min(1),
  url: str.min(1),
  companyUrl: optStr,
  company: str.min(1),
  title: str.min(1),
  locationText: optStr,
  compMin: z.number().int().nullish(),
  compMax: z.number().int().nullish(),
  currency: optStr,
  baseMaxUsd: z.number().int().nullish(),
  compSource: z.enum(COMP_SOURCES).default("unknown"),
  compEvidence: optStr,
  remoteVerdict: z.enum(REMOTE_VERDICTS).default("unclear"),
  remoteEvidence: optStr,
  remoteEvidenceUrl: optStr,
  fitScore: z.number().int().nullish(),
  whyGood: optStr,
  redFlags: optStr,
  easyApply: z.boolean().nullish(),
  applicants: z.number().int().nullish(),
  stage: z.enum(STAGES).default("FOUND"),
  stageSetBy: z.enum(STAGE_SET_BY).default("agent"),
  filterReason: optStr,
  /** Why a CLOSED job ended; cleared when it leaves CLOSED. Jobs closed before reasons existed have none. */
  closedReason: z.enum(CLOSED_REASONS).nullish(),
  needsCheck: z.array(str).default([]),
  notes: optStr,
  /** Set when the company's board or LinkedIn says the posting is gone; the stage is left to the person. */
  postingClosedAt: optIsoDate,
  postingClosedEvidence: optStr,
  /** When the posting went up. "board" is the company's own record; "listing" is an age read off LinkedIn or an aggregator. */
  postedAt: optIsoDate,
  postedAtSource: z.enum(POSTED_SOURCES).nullish(),
  reposted: z.boolean().nullish(),
  /** Where the hunt first saw the role when that was not the posting itself, e.g. a "we're hiring" post. */
  foundVia: optStr,
  /** Linked CV version id. */
  cv: optStr,
  answers: z.array(answerSchema).default([]),
  stageHistory: z
    .array(z.looseObject({ stage: z.enum(STAGES), at: isoDate, by: z.enum(STAGE_SET_BY) }))
    .default([]),
  firstSeenAt: isoDate,
  lastSeenAt: isoDate,
  updatedAt: isoDate,
});

export const cvSchema = z.looseObject({
  id: str.min(1),
  name: str.min(1),
  templateId: str.min(1),
  overrides: overridesSchema,
  /** File name of the PDF last saved for this version, in the same folder. */
  pdf: optStr,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const storySchema = z.looseObject({
  title: str.min(1),
  company: optStr,
  role: optStr,
  period: optStr,
  themes: z.array(str).default([]),
  numbers: z.array(z.looseObject({ claim: str.min(1), proof: str.min(1) })).default([]),
  usedIn: z.array(str).default([]),
});

/** data/<person>/linkedin/draft.yaml: the fenix-linkedin skill's proposed profile text, pasted in by the person. */
export const linkedinDraftSchema = z.looseObject({
  generatedAt: isoDate,
  headline: str.min(1).max(220),
  about: str.min(1).max(2600),
  roles: z.array(z.looseObject({ positionId: str.min(1), text: str.min(1).max(2000) })).default([]),
});

/**
 * data/<person>/linkedin/profile.yaml: what is on the person's LinkedIn profile now. Drafts compare against it.
 * readAt is when it was last read from LinkedIn in Chrome; edits made on LinkedIn itself appear only after the next read.
 */
export const linkedinProfileSchema = z.looseObject({
  headline: str.max(220).default(""),
  about: str.max(2600).default(""),
  roles: z.array(z.looseObject({ positionId: str.min(1), text: str.max(2000) })).max(50).default([]),
  readAt: optIsoDate,
  updatedAt: optIsoDate,
});
export type LinkedinDraft = z.infer<typeof linkedinDraftSchema>;
export type LinkedinProfile = z.infer<typeof linkedinProfileSchema>;

export const memorySchema = z.looseObject({
  name: str.min(1),
  description: str.min(1),
});

export const TRANSCRIPT_SOURCES = ["fellow", "wispr", "file", "pasted"] as const;

/** data/<person>/interviews/<date>-<company>-r<round>.md: one interview round, its brief and (after it) its review. */
export const interviewSchema = z.looseObject({
  job: str.min(1),
  company: str.min(1),
  round: z.number().int().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .refine((d) => {
      const t = new Date(`${d}T00:00:00Z`);
      return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d);
    }, "not a real date"),
  status: z.enum(["brief", "reviewed"]),
  with: z.array(z.looseObject({ name: str.min(1), role: optStr })).default([]),
  transcript: z.looseObject({ source: z.enum(TRANSCRIPT_SOURCES), ref: optStr }).nullish(),
  /** The brief's numbers to use; each must be in the career record or a story. */
  numbers: z.array(str.min(1)).default([]),
});
export type InterviewRecord = z.infer<typeof interviewSchema>;

/** data/<person>/interview-answers.md: the best current answer per common question, and lines that landed. */
export const interviewAnswersSchema = memorySchema.extend({
  landed: z.array(str.min(1).max(300)).default([]),
});

const backgroundFile = str.regex(/^[0-9a-z-]+\.png$/, "expected a file name like 20261109-ab12.png");

export const bannerBackgroundSchema = z.looseObject({
  file: backgroundFile,
  model: str.min(1),
  size: str.min(1),
  quality: str.min(1),
  createdAt: isoDate,
});

/** data/<person>/linkedin/banner.yaml. Sizes are multiples of the approved layout (textScale 1 = as approved). */
export const bannerSchema = z.looseObject({
  valueLine: str.max(200).default(""),
  roleLine: str.max(120).default(""),
  textScale: z.number().min(0.6).max(1.6).default(1),
  textCenterY: z.number().min(0.15).max(0.85).default(0.42),
  cropY: z.number().min(0).max(1).default(0.5),
  /** Selected file in backgrounds/; absent = the built-in navy gradient. */
  background: backgroundFile.nullish(),
  styleNote: z.string().max(300).nullish(),
  backgrounds: z.array(bannerBackgroundSchema).default([]),
  updatedAt: optIsoDate,
});

/** Roles and posts the hunt has judged: key ("<source>:<id>") to the day it was marked (YYYY-MM-DD). */
export const huntSeenSchema = z.looseObject({ seen: z.record(z.string(), isoDate).default({}) });
export type HuntSeen = z.infer<typeof huntSeenSchema>;

export type Settings = z.infer<typeof settingsSchema>;
export type ProfileRecord = z.infer<typeof profileSchema>;
export type CareerRecord = z.infer<typeof careerSchema>;
export type JobRecord = z.infer<typeof jobSchema>;
export type AnswerRecord = z.infer<typeof answerSchema>;
export type CvRecord = z.infer<typeof cvSchema>;
export type StoryRecord = z.infer<typeof storySchema>;
export type BannerRecord = z.infer<typeof bannerSchema>;
export type BannerBackground = z.infer<typeof bannerBackgroundSchema>;

/** One human-readable line per zod issue: `field.path: message`. */
export function describeIssues(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`);
}
