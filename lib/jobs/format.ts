import type { Settings } from "@/lib/store/schemas";
import type { ClosedReason, CompSource, JobStage, RemoteVerdict } from "./types";
import { FX_TO_USD } from "./config";

export const BOARD_STAGES: JobStage[] = [
  "FOUND",
  "SHORTLISTED",
  "CV_READY",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "CLOSED",
];

/** Cards shown per board column; the rest are on the column's "See all" page. */
export const LANE_CAP = 8;

export const STAGE_LABEL: Record<JobStage, string> = {
  FOUND: "Needs a check",
  SHORTLISTED: "Shortlisted",
  CV_READY: "CV ready",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  CLOSED: "Closed",
  FILTERED_OUT: "Filtered out",
};

export const CLOSED_REASON_LABEL: Record<ClosedReason, string> = {
  rejected: "Rejected",
  passed: "Passed",
  low_fit: "Low fit",
  fell_off: "Fell off",
  posting_closed: "Posting closed",
  no_response: "No response",
};

/** Stage-menu entries: Closed is offered once per reason, value `CLOSED:<reason>`. A job closed before reasons existed keeps a "no reason" entry. */
export function stageOptions(stages: readonly JobStage[], current: { stage: JobStage; closedReason: ClosedReason | null }) {
  return stages.flatMap((s) => {
    if (s !== "CLOSED") return [{ value: s as string, label: STAGE_LABEL[s] }];
    const legacy = current.stage === "CLOSED" && !current.closedReason ? [{ value: "CLOSED", label: "Closed: no reason" }] : [];
    return [...legacy, ...(Object.keys(CLOSED_REASON_LABEL) as ClosedReason[]).map((r) => ({ value: `CLOSED:${r}`, label: `Closed: ${CLOSED_REASON_LABEL[r]}` }))];
  });
}

export function stageValue(stage: JobStage, closedReason: ClosedReason | null): string {
  return stage === "CLOSED" && closedReason ? `CLOSED:${closedReason}` : stage;
}

export function stageHint(stage: JobStage, s: Pick<Settings, "floorUsd" | "homeCountryName">): string | undefined {
  if (stage === "FOUND") return "Salary or remote policy unconfirmed";
  if (stage === "SHORTLISTED") return `Clears ${usdK(s.floorUsd)}, remote from ${s.homeCountryName}`;
  if (stage === "CV_READY") return "Tailored CV drafted, ready to apply";
}

export function remoteLabel(v: RemoteVerdict, countryName: string): string {
  switch (v) {
    case "country_ok":
      return `Remote, ${countryName} OK`;
    case "sponsorship_offered":
      return "Sponsors visas";
    case "us_only":
      return "US residents only";
    case "onsite":
      return "On-site or hybrid";
    case "unclear":
      return "Remote, region unclear";
  }
}

export function stageDateLabel(stage: JobStage, at: Date, known: boolean, now: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (at.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return `${known ? STAGE_LABEL[stage] : "Seen"} ${at.toLocaleDateString("en-CA", opts)}`;
}

/** An application with no reply after this many days gets a tag, so it can be closed as No response. */
export const NO_REPLY_DAYS = 30;

/**
 * Whole days since an APPLIED job entered the stage, when that's more than NO_REPLY_DAYS; otherwise null. Null too when
 * the date isn't recorded (first-seen stands in then, and could be long before the application).
 */
export function noReplyDays(job: { stage: JobStage; stageEnteredAt: Date; stageDateKnown: boolean }, now: Date): number | null {
  if (job.stage !== "APPLIED" || !job.stageDateKnown) return null;
  const days = Math.floor((now.getTime() - job.stageEnteredAt.getTime()) / 86_400_000);
  return days > NO_REPLY_DAYS ? days : null;
}

export const usdK = (usd: number) => `$${Math.round(usd / 1000)}k`;

export const REMOTE_TONE: Record<RemoteVerdict, "pass" | "fail" | "check"> = {
  country_ok: "pass",
  sponsorship_offered: "pass",
  us_only: "fail",
  onsite: "fail",
  unclear: "check",
};

const SOURCE_PHRASE: Record<CompSource, string> = {
  posting: "posted",
  company_site: "from company site",
  estimate: "estimated",
  unknown: "",
};

const CHECK_LABEL: Record<string, string> = {
  comp_unknown: "Check salary",
  comp_estimate: "Salary is an estimate",
  remote_unclear: "Check remote policy",
};

export const checkLabel = (c: string) => CHECK_LABEL[c] ?? c;

const k = (n: number) => `$${Math.round(n / 1000)}k`;

export function formatComp(j: {
  compMin: number | null;
  compMax: number | null;
  currency: string | null;
  compSource: CompSource;
}) {
  if (j.compMax == null && j.compMin == null) return "Salary not posted";
  const range =
    j.compMin != null && j.compMax != null && j.compMin !== j.compMax
      ? `${k(j.compMin)}–${k(j.compMax)}`
      : k((j.compMax ?? j.compMin)!);
  const currency = (j.currency ?? "USD").toUpperCase();
  const { minUsd, maxUsd } = usdRange(j);
  const inUsd =
    currency === "USD" || (minUsd == null && maxUsd == null)
      ? ""
      : ` (≈ ${minUsd != null && maxUsd != null && minUsd !== maxUsd ? `${k(minUsd)}–${k(maxUsd)}` : k((maxUsd ?? minUsd)!)} USD)`;
  const src = SOURCE_PHRASE[j.compSource];
  return `${j.compSource === "estimate" ? "~" : ""}${range} ${currency}${inUsd}${src ? `, ${src}` : ""}`;
}

export function usdRange(j: { compMin: number | null; compMax: number | null; currency: string | null }) {
  const rate = FX_TO_USD[(j.currency ?? "USD").toUpperCase()] ?? null;
  const conv = (n: number | null) => (n == null || rate == null ? null : Math.round(n * rate));
  return { minUsd: conv(j.compMin), maxUsd: conv(j.compMax) };
}

export function compConfirmed(source: CompSource) {
  return source === "posting" || source === "company_site";
}

export function filterReasonText(reason: string | null) {
  if (!reason) return "";
  if (reason === "manual") return "Moved here by you";
  if (reason === "remote:us_only") return "US residents only";
  if (reason === "remote:onsite") return "On-site or hybrid";
  const comp = reason.match(/^comp:(\d+)$/);
  if (comp) return `Base tops out at ${k(Number(comp[1]))}`;
  return reason;
}

export const GAUGE_MIN = 150_000;
export const GAUGE_MAX = 400_000;
export const gaugePct = (usd: number) =>
  Math.min(100, Math.max(0, ((usd - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100));
