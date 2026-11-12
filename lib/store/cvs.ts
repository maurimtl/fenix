import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fromYaml, hashText, listRecordFiles, readText, toYaml, writeAtomic, createExclusive } from "./files";
import { withProfileLock } from "./lock";
import { commitProfile } from "./history";
import { profilePath, slugify, StoreError } from "./paths";
import { cvSchema, describeIssues, type CvRecord } from "./schemas";
import { readAllJobs, writeJob } from "./jobs";
import type { Overrides } from "@/lib/resume/schema";

/** One CV version file: parsed record, where it lives, and a version for stale-write checks. */
export type CvFile = { file: string; data: CvRecord; version: string };

function cvsDir(profile: string): string {
  return profilePath(profile, "cvs");
}

async function readCvFile(file: string): Promise<CvFile | null> {
  const text = await readText(file);
  if (text === null) return null;
  const res = cvSchema.safeParse(fromYaml(text));
  if (!res.success) throw new StoreError("invalid", `${path.basename(file)}: ${describeIssues(res.error).join("; ")}`);
  return { file, data: res.data, version: hashText(text) };
}

export async function readAllCvs(profile: string): Promise<CvFile[]> {
  const files = await listRecordFiles(cvsDir(profile), ".yaml");
  return (await Promise.all(files.map(readCvFile))).filter((c): c is CvFile => c !== null);
}

export async function findCv(profile: string, id: string): Promise<CvFile | null> {
  return (await readAllCvs(profile)).find((c) => c.data.id === id) ?? null;
}

/** Refuses a record that would make the file unreadable (and so break every lookup of this person's CVs). */
function checked(data: unknown): CvRecord {
  const res = cvSchema.safeParse(data);
  if (!res.success) throw new StoreError("invalid", `CV not saved: ${describeIssues(res.error).join("; ")}`);
  return res.data;
}

async function write(cv: CvFile): Promise<string> {
  checked(cv.data);
  const text = toYaml(cv.data);
  await writeAtomic(cv.file, text);
  return hashText(text);
}

export function newCvId(): string {
  return `cv${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
}

/** Creates a CV version file named after the CV. Caller must hold the profile lock. */
export async function createCvLocked(
  profile: string,
  v: { name: string; templateId: string; overrides: Overrides | Record<string, unknown> },
): Promise<CvFile> {
  const now = new Date().toISOString();
  const data = checked({ id: newCvId(), name: v.name, templateId: v.templateId, overrides: v.overrides, createdAt: now, updatedAt: now });
  const text = toYaml(data);
  const base = slugify(v.name, 80);
  for (let i = 1; i < 100; i++) {
    const file = path.join(cvsDir(profile), `${i === 1 ? base : `${base}-${i}`}.yaml`);
    try {
      await createExclusive(file, text);
      return { file, data, version: hashText(text) };
    } catch (e) {
      if (!(e instanceof StoreError && e.code === "exists")) throw e;
    }
  }
  throw new StoreError("exists", `too many CVs named ${v.name}`);
}

export function createCv(profile: string, v: Parameters<typeof createCvLocked>[1]) {
  return withProfileLock(profile, async () => {
    const cv = await createCvLocked(profile, v);
    await commitProfile(profile, `CV ${v.name} created`, [cv.file]);
    return cv;
  });
}

/** Read-modify-write one CV. `expected` is the version the caller read; a newer file throws "stale". Caller must hold the lock. */
export async function updateCvLocked(profile: string, id: string, expected: string | undefined, fn: (d: CvRecord) => void) {
  const cv = await findCv(profile, id);
  if (!cv) throw new StoreError("not_found", "no such CV");
  if (expected !== undefined && expected !== cv.version) throw new StoreError("stale", `${path.basename(cv.file)} changed since it was read`);
  fn(cv.data);
  cv.data.updatedAt = new Date().toISOString();
  return { cv, version: await write(cv) };
}

export function updateCv(profile: string, id: string, expected: string | undefined, fn: (d: CvRecord) => void) {
  return withProfileLock(profile, async () => {
    const r = await updateCvLocked(profile, id, expected, fn);
    await commitProfile(profile, `CV ${r.cv.data.name} saved`, [r.cv.file]);
    return r;
  });
}

// The PDF stays: it is the record of what was sent. Jobs pointing at the deleted version lose the link.
// Returns the PDF's file name, if it had one, so the caller can remove the copy in the person's CV folder.
export function deleteCv(profile: string, id: string) {
  return withProfileLock(profile, async () => {
    const cv = await findCv(profile, id);
    if (!cv) throw new StoreError("not_found", "no such CV");
    // Read the jobs before removing anything, so an unreadable job file fails the delete instead of half-doing it.
    const linked = (await readAllJobs(profile)).filter((j) => j.data.cv === id);
    await fs.rm(cv.file);
    for (const job of linked) {
      job.data.cv = null;
      await writeJob(job);
    }
    await commitProfile(profile, `CV ${cv.data.name} deleted`, [cv.file, ...linked.map((j) => j.file)]);
    return cv.data.pdf ?? null;
  });
}

/** "Company - Role" names fill {company} and {role}; anything else is all company. */
export function pdfFileName(pattern: string, fullName: string, cvName: string): string {
  const [company, ...rest] = cvName.split(" - ");
  const name = pattern
    .replaceAll("{name}", fullName)
    .replaceAll("{company}", company.trim())
    .replaceAll("{role}", rest.join(" - ").trim())
    .replace(/[/\\:\u0000-\u001f]/g, "-")
    // Older applicant systems split uploaded file names on commas.
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+-\s*$/, "")
    .trim();
  return `${name || "CV"}.pdf`;
}

export function toVariant(cv: CvFile) {
  return {
    id: cv.data.id,
    name: cv.data.name,
    templateId: cv.data.templateId,
    overrides: cv.data.overrides,
    pdf: cv.data.pdf ?? null,
    createdAt: new Date(cv.data.createdAt),
    updatedAt: new Date(cv.data.updatedAt),
    version: cv.version,
  };
}
