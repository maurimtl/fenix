import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createExclusive, listRecordFiles, parseFrontMatter, stringifyFrontMatter, writeAtomic } from "./files";
import { profilePath, slugify, StoreError } from "./paths";
import { describeIssues, jobSchema, type AnswerRecord, type JobRecord } from "./schemas";

/** One stored job file: its parsed front matter, the posting text (body) and where it lives. */
export type JobFile = { file: string; data: JobRecord; body: string };

export function jobFileName(j: { company: string; title: string; source: string; sourceJobId: string }): string {
  return `${slugify(j.company, 30)}-${slugify(j.title, 50)}--${slugify(j.source, 20)}-${slugify(j.sourceJobId, 40)}.md`;
}

export function newJobId(): string {
  return `j${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
}

function jobsDir(profile: string): string {
  return profilePath(profile, "jobs");
}

async function readJobFile(file: string): Promise<JobFile> {
  const doc = parseFrontMatter(await fs.readFile(file, "utf8"));
  const parsed = jobSchema.safeParse(doc.data);
  if (!parsed.success) {
    throw new StoreError("invalid", `${path.basename(file)}: ${describeIssues(parsed.error).join("; ")}`);
  }
  return { file, data: parsed.data, body: doc.body };
}

export async function readAllJobs(profile: string): Promise<JobFile[]> {
  const files = await listRecordFiles(jobsDir(profile), ".md");
  return Promise.all(files.map(readJobFile));
}

export async function findJob(profile: string, id: string): Promise<JobFile | null> {
  return (await readAllJobs(profile)).find((j) => j.data.id === id) ?? null;
}

// Fields are written back from the parsed record, so unknown keys someone added by hand survive.
export async function writeJob(job: JobFile): Promise<void> {
  await writeAtomic(job.file, stringifyFrontMatter({ data: dropUndefined(job.data), body: job.body }));
}

export async function createJob(profile: string, data: JobRecord, body: string): Promise<JobFile> {
  const text = stringifyFrontMatter({ data: dropUndefined(data), body });
  const base = jobFileName(data).replace(/\.md$/, "");
  // Slugs are truncated and lowercased, so two different postings can share a name: number the later one.
  for (let i = 1; i < 100; i++) {
    const file = path.join(jobsDir(profile), `${i === 1 ? base : `${base}-${i}`}.md`);
    try {
      await createExclusive(file, text);
      return { file, data, body };
    } catch (e) {
      if (!(e instanceof StoreError && e.code === "exists")) throw e;
    }
  }
  throw new StoreError("exists", `too many jobs named ${base}`);
}

function dropUndefined(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/** The shape pages and API routes read: dates as Date, optional fields as null. */
export type Job = ReturnType<typeof toJob>;
export type Answer = ReturnType<typeof toAnswers>[number];

const n = <T>(v: T | null | undefined): T | null => (v === undefined ? null : v);

// With no history entry for the current stage (legacy files), first-seen stands in and is flagged as such.
export function stageEnteredAt(d: Pick<JobRecord, "stage" | "stageHistory" | "firstSeenAt">): { at: Date; known: boolean } {
  let latest: Date | null = null;
  for (const h of d.stageHistory) {
    if (h.stage !== d.stage) continue;
    const at = new Date(h.at);
    if (!Number.isNaN(at.getTime()) && (latest === null || at > latest)) latest = at;
  }
  return latest ? { at: latest, known: true } : { at: new Date(d.firstSeenAt), known: false };
}

export function toJob({ data: d, body }: JobFile) {
  const entered = stageEnteredAt(d);
  return {
    id: d.id,
    source: d.source,
    sourceJobId: d.sourceJobId,
    url: d.url,
    companyUrl: n(d.companyUrl),
    company: d.company,
    title: d.title,
    locationText: n(d.locationText),
    compMin: n(d.compMin),
    compMax: n(d.compMax),
    currency: n(d.currency),
    baseMaxUsd: n(d.baseMaxUsd),
    compSource: d.compSource,
    compEvidence: n(d.compEvidence),
    remoteVerdict: d.remoteVerdict,
    remoteEvidence: n(d.remoteEvidence),
    remoteEvidenceUrl: n(d.remoteEvidenceUrl),
    jdText: body === "" ? null : body,
    fitScore: n(d.fitScore),
    whyGood: n(d.whyGood),
    redFlags: n(d.redFlags),
    easyApply: n(d.easyApply),
    applicants: n(d.applicants),
    stage: d.stage,
    stageSetBy: d.stageSetBy,
    filterReason: n(d.filterReason),
    closedReason: n(d.closedReason),
    needsCheck: d.needsCheck,
    notes: n(d.notes),
    postingClosedAt: d.postingClosedAt ? new Date(d.postingClosedAt) : null,
    postingClosedEvidence: n(d.postingClosedEvidence),
    postedAt: d.postedAt ? new Date(d.postedAt) : null,
    postedAtSource: n(d.postedAtSource),
    reposted: d.reposted === true,
    foundVia: n(d.foundVia),
    variantId: n(d.cv),
    firstSeenAt: new Date(d.firstSeenAt),
    stageEnteredAt: entered.at,
    stageDateKnown: entered.known,
    lastSeenAt: new Date(d.lastSeenAt),
    updatedAt: new Date(d.updatedAt),
  };
}

// Answers carry no id of their own in the file; job id plus position is stable while the list only grows.
export function toAnswers(job: JobFile) {
  return job.data.answers.map((a: AnswerRecord, i) => ({
    id: `${job.data.id}.${i}`,
    jobId: job.data.id,
    question: a.question,
    answer: a.answer,
    createdAt: new Date(a.createdAt ?? job.data.firstSeenAt),
    updatedAt: new Date(a.updatedAt ?? a.createdAt ?? job.data.firstSeenAt),
  }));
}
