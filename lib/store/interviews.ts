import path from "node:path";
import { listRecordFiles, parseFrontMatter, readText } from "./files";
import { isSlug, isUnreadable, profilePath, StoreError } from "./paths";
import { describeIssues, interviewAnswersSchema, interviewSchema, type InterviewRecord } from "./schemas";

export const INTERVIEW_ANSWERS_FILE = "interview-answers.md";
/** Round files are named <date>-<company>-r<round>; the date prefix keeps any other page name from colliding with a round. */
export const ROUND_SLUG = /^(\d{4}-\d{2}-\d{2})-[a-z0-9-]+-r(\d+)$/;

export type Interview = { slug: string; data: InterviewRecord; body: string };

export const interviewsDir = (profile: string) => profilePath(profile, "interviews");
export const transcriptFile = (profile: string, slug: string) => path.join(interviewsDir(profile), `${slug}.transcript.txt`);

async function readInterview(file: string): Promise<Interview | null> {
  const text = await readText(file);
  if (text === null) return null;
  const doc = parseFrontMatter(text);
  const res = interviewSchema.safeParse(doc.data);
  if (!res.success) throw new StoreError("invalid", `${path.basename(file)}: ${describeIssues(res.error).join("; ")}`);
  return { slug: path.basename(file, ".md"), data: res.data, body: doc.body.trim() };
}

/** Newest first; a later round on the same day comes first. */
export async function readAllInterviews(profile: string): Promise<Interview[]> {
  const files = (await listRecordFiles(interviewsDir(profile), ".md")).filter((f) => ROUND_SLUG.test(path.basename(f, ".md")));
  // A broken round is left out of lists (check:data names it) so it can't take down the job pages.
  const read = (f: string) =>
    readInterview(f).catch((e) => {
      if (!isUnreadable(e)) throw e;
      console.error(`interview round skipped: ${e instanceof Error ? e.message : e}`);
      return null;
    });
  const all = (await Promise.all(files.map(read))).filter((i): i is Interview => i !== null);
  return all.sort((a, b) => b.data.date.localeCompare(a.data.date) || b.data.round - a.data.round);
}

export async function findInterview(profile: string, slug: string): Promise<Interview | null> {
  if (!isSlug(slug) || !ROUND_SLUG.test(slug)) return null;
  return readInterview(path.join(interviewsDir(profile), `${slug}.md`));
}

export async function interviewsForJob(profile: string, jobId: string): Promise<Interview[]> {
  return (await readAllInterviews(profile)).filter((i) => i.data.job === jobId);
}

export async function readTranscript(profile: string, slug: string): Promise<string | null> {
  if (!isSlug(slug) || !ROUND_SLUG.test(slug)) return null;
  return readText(transcriptFile(profile, slug));
}

export type InterviewAnswers = { landed: string[]; body: string };

/** The answer bank, or null when the person has none yet. */
export async function readInterviewAnswers(profile: string): Promise<InterviewAnswers | null> {
  const text = await readText(profilePath(profile, INTERVIEW_ANSWERS_FILE));
  if (text === null) return null;
  const doc = parseFrontMatter(text);
  const res = interviewAnswersSchema.safeParse(doc.data);
  if (!res.success) throw new StoreError("invalid", `${INTERVIEW_ANSWERS_FILE}: ${describeIssues(res.error).join("; ")}`);
  return { landed: res.data.landed, body: doc.body.trim() };
}
