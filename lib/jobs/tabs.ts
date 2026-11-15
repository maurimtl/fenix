export const JOB_TABS = ["overview", "application", "posting"] as const;
export type JobTab = (typeof JOB_TABS)[number];

export const JOB_TAB_LABEL: Record<JobTab, string> = { overview: "Overview", application: "Application", posting: "Posting" };

/** The tabs a job page offers: Application only when there are answers, Posting only when one is saved. */
export function jobTabs(has: { answers: boolean; posting: boolean }): JobTab[] {
  return JOB_TABS.filter((t) => t === "overview" || (t === "application" ? has.answers : has.posting));
}

/** The tab named in the address, or Overview when it is missing, unknown or not offered for this job. */
export function pickTab(raw: string | string[] | undefined, offered: JobTab[]): JobTab {
  const name = Array.isArray(raw) ? raw[0] : raw;
  return offered.find((t) => t === name) ?? "overview";
}
