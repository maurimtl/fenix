import type { Settings } from "@/lib/store/schemas";
import { FX_TO_USD } from "./config";
import { postingAgeDays, STALE_DAYS } from "./freshness";
import type { CompSource, JobStage, RemoteVerdict } from "./types";

export type JobFacts = {
  compMin?: number | null;
  compMax?: number | null;
  currency?: string | null;
  compSource: CompSource;
  remoteVerdict: RemoteVerdict;
  postedAt?: string | null;
  fitScore?: number | null;
};

export type Classification = {
  stage: JobStage;
  filterReason: string | null;
  needsCheck: string[];
  baseMaxUsd: number | null;
  compSource: CompSource;
};

export function toUsd(amount: number, currency: string | null | undefined): number | null {
  const rate = FX_TO_USD[(currency ?? "USD").toUpperCase()];
  return rate === undefined ? null : Math.round(amount * rate);
}

const DEFAULT_STRONG_FIT = 75;

export function classify(
  f: JobFacts,
  settings: Pick<Settings, "floorUsd"> & { strongMatchFit?: number },
  now: Date = new Date(),
): Classification {
  const top = f.compMax ?? f.compMin;
  const baseMaxUsd = top == null ? null : toUsd(top, f.currency);
  const compSource: CompSource =
    baseMaxUsd == null && f.compSource !== "unknown" ? "unknown" : f.compSource;
  const compConfirmed = compSource === "posting" || compSource === "company_site";

  if (f.remoteVerdict === "us_only" || f.remoteVerdict === "onsite") {
    return { stage: "FILTERED_OUT", filterReason: `remote:${f.remoteVerdict}`, needsCheck: [], baseMaxUsd, compSource };
  }
  if (compConfirmed && baseMaxUsd! < settings.floorUsd) {
    return { stage: "FILTERED_OUT", filterReason: `comp:${baseMaxUsd}`, needsCheck: [], baseMaxUsd, compSource };
  }

  const needsCheck: string[] = [];
  if (compSource === "unknown") needsCheck.push("comp_unknown");
  if (compSource === "estimate") needsCheck.push("comp_estimate");
  if (f.remoteVerdict === "unclear") needsCheck.push("remote_unclear");

  // An old posting is held for a look instead of shortlisted, unless the fit is strong. No date means no penalty.
  const age = postingAgeDays(f.postedAt, now);
  const strong = (f.fitScore ?? -1) >= (settings.strongMatchFit ?? DEFAULT_STRONG_FIT);
  if (needsCheck.length === 0 && age !== null && age >= STALE_DAYS && !strong) needsCheck.push("stale");

  return {
    stage: needsCheck.length === 0 ? "SHORTLISTED" : "FOUND",
    filterReason: null,
    needsCheck,
    baseMaxUsd,
    compSource,
  };
}
