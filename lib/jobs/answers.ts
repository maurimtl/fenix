import { withProfileLock } from "@/lib/store/lock";
import { findJob, readAllJobs, toAnswers, writeJob } from "@/lib/store/jobs";
import { commitProfile } from "@/lib/store/history";

// Upserts by question: an existing question keeps its place and createdAt, a new one is appended.
export async function saveAnswers(profile: string, jobId: string, answers: { question: string; answer: string }[]) {
  return withProfileLock(profile, async () => {
    const job = await findJob(profile, jobId);
    if (!job) return null;
    const now = new Date().toISOString();
    const list = job.data.answers;
    for (const { question, answer } of answers) {
      const hit = list.find((a) => a.question === question);
      if (hit) {
        hit.answer = answer;
        hit.updatedAt = now;
      } else {
        list.push({ question, answer, createdAt: now, updatedAt: now });
      }
    }
    job.data.updatedAt = now;
    await writeJob(job);
    await commitProfile(profile, `answers for ${job.data.company} - ${job.data.title}`, [job.file]);
    return answers;
  });
}

export async function jobAnswers(profile: string, jobId: string) {
  const job = await findJob(profile, jobId);
  if (!job) return [];
  return toAnswers(job).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function searchAnswers(profile: string, q: string) {
  const needle = q.toLowerCase();
  return (await readAllJobs(profile))
    .flatMap((job) =>
      toAnswers(job).map((a) => ({ ...a, job: { id: job.data.id, company: job.data.company, title: job.data.title } })),
    )
    .filter((a) => !needle || a.question.toLowerCase().includes(needle) || a.answer.toLowerCase().includes(needle))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 50);
}
