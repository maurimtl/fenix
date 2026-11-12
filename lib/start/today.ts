import { listJobs } from "@/lib/jobs/repo";
import { noReplyDays } from "@/lib/jobs/format";
import { readAllInterviews } from "@/lib/store/interviews";
import { pagePath } from "@/lib/profile-url";

export const INTERVIEW_DAYS_AHEAD = 7;
const LIST_CAP = 10;

export type TodayLine = { label: string; detail: string; href: string };
export type TodayList = { lines: TodayLine[]; more: number };
export type Today = { interviews: TodayList; cvReady: TodayList; found: TodayList; noReply: TodayList };

/** A local calendar date as YYYY-MM-DD, the form interview files use. */
function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const capped = (lines: TodayLine[]): TodayList => ({ lines: lines.slice(0, LIST_CAP), more: Math.max(0, lines.length - LIST_CAP) });

/** What needs the person now: interviews this week, CVs ready to send, jobs to check, applications with no reply. */
export async function computeToday(profile: string, now: Date): Promise<Today> {
  const [interviews, jobs] = await Promise.all([readAllInterviews(profile), listJobs(profile, false)]);
  const today = localDate(now);
  const last = new Date(now);
  last.setDate(last.getDate() + INTERVIEW_DAYS_AHEAD);
  const until = localDate(last);

  const upcoming = interviews
    .filter((i) => i.data.date >= today && i.data.date <= until)
    .sort((a, b) => a.data.date.localeCompare(b.data.date) || a.data.round - b.data.round)
    .map((i) => ({
      label: `${i.data.company}, round ${i.data.round}`,
      detail: i.data.date === today ? "today" : i.data.date,
      href: pagePath(profile, `/interviews/${i.slug}`),
    }));
  const jobLine = (j: (typeof jobs)[number], detail: string) => ({ label: `${j.title}, ${j.company}`, detail, href: pagePath(profile, `/jobs/${j.id}`) });
  const cvReady = jobs.filter((j) => j.stage === "CV_READY").map((j) => jobLine(j, "CV ready to send"));
  const found = jobs.filter((j) => j.stage === "FOUND").map((j) => jobLine(j, "needs a check"));
  const noReply = jobs.flatMap((j) => {
    const days = noReplyDays(j, now);
    return days === null ? [] : [jobLine(j, `no reply in ${days} days`)];
  });
  return { interviews: capped(upcoming), cvReady: capped(cvReady), found: capped(found), noReply: capped(noReply) };
}
