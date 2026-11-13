import { createCvLocked, findCv, updateCvLocked } from "@/lib/store/cvs";
import type { ClosedReason, JobStage, StageSetBy } from "./types";
import { getSettings } from "@/lib/store/profiles";
import { withProfileLock } from "@/lib/store/lock";
import { createJob, findJob, newJobId, readAllJobs, toJob, writeJob, type JobFile } from "@/lib/store/jobs";
import type { JobRecord } from "@/lib/store/schemas";
import { commitProfile } from "@/lib/store/history";
import { classify } from "./classify";
import { bestMatchOrder, mergePosted } from "./freshness";
import { CLOSED_REASON_LABEL, STAGE_LABEL } from "./format";
import { defaultTemplateId } from "@/lib/templates/registry";
import type { Overrides } from "@/lib/resume/schema";
import type { JobInput } from "./schema";

// Once a job reaches CV_READY or later, re-runs never move it back.
const AGENT_STAGES: JobStage[] = ["FOUND", "SHORTLISTED", "FILTERED_OUT"];

function moveStage(d: JobRecord, stage: JobStage, by: StageSetBy, at: string): void {
  if (d.stage === stage) return;
  d.stage = stage;
  d.stageSetBy = by;
  if (stage !== "CLOSED") d.closedReason = null;
  d.stageHistory = [...d.stageHistory, { stage, at, by }];
}

// Lookup and write happen under the profile lock, so two callers posting the same job make one file.
export async function upsertJob(profile: string, input: JobInput) {
  const settings = await getSettings(profile);
  const { jdText, ...facts } = input;
  return withProfileLock(profile, async () => {
    const now = new Date().toISOString();
    const existing = (await readAllJobs(profile)).find(
      (j) => j.data.source === input.source && j.data.sourceJobId === input.sourceJobId,
    );
    // Classified on the merged date, so a listing's "reposted yesterday" can't un-stale a job the board dates to last month.
    const posted = mergePosted(existing?.data ?? {}, input);
    // A re-save that sends no fit keeps the stored one, so a strong match isn't held as stale for the omission.
    const fitScore = "fitScore" in input ? input.fitScore : existing?.data.fitScore;
    const c = classify({ ...input, fitScore, postedAt: posted.postedAt }, settings);

    if (!existing) {
      const data = {
        ...facts,
        ...posted,
        id: newJobId(),
        baseMaxUsd: c.baseMaxUsd,
        compSource: c.compSource,
        stage: c.stage,
        stageSetBy: "agent",
        filterReason: c.filterReason,
        needsCheck: c.needsCheck,
        answers: [],
        stageHistory: [{ stage: c.stage, at: now, by: "agent" }],
        firstSeenAt: now,
        lastSeenAt: now,
        updatedAt: now,
      } satisfies JobRecord;
      const job = await createJob(profile, data, jdText ?? "");
      await commitProfile(profile, `job ${data.company} - ${data.title} added`, [job.file]);
      return { id: job.data.id, created: true, stage: job.data.stage };
    }

    const d = existing.data;
    // The first place a role was found stays; a later save from another source does not replace or clear it.
    if (d.foundVia) delete facts.foundVia;
    const reclassify = d.stageSetBy === "agent" && AGENT_STAGES.includes(d.stage);
    Object.assign(d, facts, posted, { baseMaxUsd: c.baseMaxUsd, compSource: c.compSource, needsCheck: c.needsCheck, lastSeenAt: now, updatedAt: now });
    if (reclassify) {
      moveStage(d, c.stage, "agent", now);
      d.filterReason = c.filterReason;
    }
    await writeJob({ ...existing, body: jdText ?? existing.body });
    await commitProfile(profile, `job ${d.company} - ${d.title} updated`, [existing.file]);
    return { id: d.id, created: false, stage: d.stage };
  });
}

export async function knownSourceIds(profile: string, source: string, ids: string[]) {
  const want = new Set(ids);
  return (await readAllJobs(profile))
    .filter((j) => j.data.source === source && want.has(j.data.sourceJobId))
    .map((j) => j.data.sourceJobId);
}

export async function jobsAtCompany(profile: string, company: string) {
  const needle = company.toLowerCase();
  return (await readAllJobs(profile))
    .map(toJob)
    .filter((j) => j.company.toLowerCase().includes(needle))
    .sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime())
    .slice(0, 50)
    .map(({ id, source, sourceJobId, company, title, stage }) => ({ id, source, sourceJobId, company, title, stage }));
}

export async function patchJob(
  profile: string,
  id: string,
  patch: { stage?: JobStage; closedReason?: ClosedReason; notes?: string | null; postingClosedAt?: string | null; postingClosedEvidence?: string | null },
) {
  return withProfileLock(profile, async () => {
    const job = await findJob(profile, id);
    if (!job) return false;
    const d = job.data;
    const now = new Date().toISOString();
    const moved = patch.stage !== undefined && patch.stage !== d.stage;
    if (moved) {
      moveStage(d, patch.stage!, "user", now);
      d.filterReason = patch.stage === "FILTERED_OUT" ? "manual" : null;
    }
    const reasonChanged = patch.closedReason !== undefined && patch.closedReason !== (d.closedReason ?? null);
    if (reasonChanged) d.closedReason = patch.closedReason;
    const notesChanged = patch.notes !== undefined && patch.notes !== (d.notes ?? null);
    if (patch.notes !== undefined) d.notes = patch.notes;
    const closedChanged = patch.postingClosedAt !== undefined && patch.postingClosedAt !== (d.postingClosedAt ?? null);
    if (closedChanged) {
      d.postingClosedAt = patch.postingClosedAt;
      d.postingClosedEvidence = patch.postingClosedEvidence ?? null;
    }
    if (!moved && !reasonChanged && !notesChanged && !closedChanged) return true;
    d.updatedAt = now;
    await writeJob(job);
    const reason = d.stage === "CLOSED" && d.closedReason ? `: ${CLOSED_REASON_LABEL[d.closedReason]}` : "";
    const what = moved || reasonChanged ? `moved to ${STAGE_LABEL[d.stage]}${reason}` : closedChanged ? (d.postingClosedAt ? "posting closed" : "posting reopened") : "notes edited";
    await commitProfile(profile, `job ${d.company} - ${d.title} ${what}`, [job.file]);
    return true;
  });
}

// Creates (or, on retry, updates) the job's one CV version and marks the job CV_READY.
// The profile lock makes a concurrent draft for the same job wait instead of creating a second version.
export async function draftVariant(profile: string, jobId: string, name: string, overrides: Overrides) {
  return withProfileLock(profile, async () => {
    const job = await findJob(profile, jobId);
    if (!job) return null;
    const d = job.data;
    const linked = d.cv ? await findCv(profile, d.cv) : null;
    const cvFile = linked
      ? (await updateCvLocked(profile, linked.data.id, undefined, (cv) => Object.assign(cv, { name, overrides }))).cv
      : await createCvLocked(profile, { name, templateId: await defaultTemplateId(profile), overrides });
    const variant = cvFile.data;

    const now = new Date().toISOString();
    const created = !linked;
    d.cv = variant.id;
    if (AGENT_STAGES.includes(d.stage)) {
      moveStage(d, "CV_READY", d.stageSetBy, now);
      d.filterReason = null;
    }
    d.updatedAt = now;
    await writeJob(job);
    await commitProfile(profile, `CV ${name} drafted for job ${d.company} - ${d.title}`, [cvFile.file, job.file]);
    return { variantId: variant.id, created };
  });
}

/** Sets a posting date read from the company's board. The stage is left alone; a board date already stored wins if earlier. */
export async function setPostedFromBoard(profile: string, id: string, postedAt: string) {
  return withProfileLock(profile, async () => {
    const job = await findJob(profile, id);
    if (!job) return false;
    const d = job.data;
    const merged = mergePosted(d, { postedAt, postedAtSource: "board" });
    if (merged.postedAt === (d.postedAt ?? null) && merged.postedAtSource === (d.postedAtSource ?? null)) return true;
    Object.assign(d, merged, { updatedAt: new Date().toISOString() });
    await writeJob(job);
    await commitProfile(profile, `job ${d.company} - ${d.title} posting date set from the company board`, [job.file]);
    return true;
  });
}

// Comp-confirmed first, then fresher postings, then fit, then newest seen.
export async function listJobs(profile: string, filtered: boolean, now: Date = new Date()) {
  const jobs = (await readAllJobs(profile))
    .map(toJob)
    .filter((j) => (j.stage === "FILTERED_OUT") === filtered)
    .sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime());
  if (filtered) return jobs.slice(0, 500);
  return jobs.sort(bestMatchOrder(now));
}

export async function getJob(profile: string, id: string) {
  const file: JobFile | null = await findJob(profile, id);
  if (!file) return null;
  const job = toJob(file);
  const cv = job.variantId ? await findCv(profile, job.variantId) : null;
  return { ...job, variant: cv ? { id: cv.data.id, name: cv.data.name } : null };
}

export async function countFiltered(profile: string) {
  return (await readAllJobs(profile)).filter((j) => j.data.stage === "FILTERED_OUT").length;
}
