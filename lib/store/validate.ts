import { promises as fs } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { fromYaml, listRecordFiles, parseFrontMatter, readText } from "./files";
import { dataRoot, isSlug } from "./paths";
import {
  careerSchema,
  cvSchema,
  describeIssues,
  jobSchema,
  memorySchema,
  huntSeenSchema,
  linkedinDraftSchema,
  linkedinProfileSchema,
  type LinkedinProfile,
  bannerSchema,
  profileSchema,
  storySchema,
  interviewSchema,
  interviewAnswersSchema,
  type InterviewRecord,
  type CareerRecord,
  type CvRecord,
  type JobRecord,
  type ProfileRecord,
  type StoryRecord,
} from "./schemas";
import { claimKey, inventedNumbers, numberTokens, readClaimsBaseline, sourceNumbers } from "./claims";
import { INTERVIEW_ANSWERS_FILE, ROUND_SLUG } from "./interviews";

/** A warning is listed but doesn't fail the check. */
export type Issue = { file: string; problem: string; warning?: boolean; cvId?: string; token?: string };

export const UNBACKED = "is not in the career record or a story";

const MAX_FILES = 5_000;
const SENT_STAGES = new Set(["APPLIED", "INTERVIEWING", "OFFER"]);

function rel(file: string) {
  return path.relative(dataRoot(), file);
}

async function parseWith<T>(file: string, schema: z.ZodType<T>, kind: "yaml" | "front", issues: Issue[]) {
  const text = await readText(file);
  if (text === null) {
    issues.push({ file: rel(file), problem: "missing" });
    return null;
  }
  let raw: unknown;
  try {
    raw = kind === "yaml" ? fromYaml(text) : parseFrontMatter(text).data;
  } catch (e) {
    issues.push({ file: rel(file), problem: `unreadable: ${(e as Error).message.split("\n")[0]}` });
    return null;
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    for (const p of describeIssues(res.error)) issues.push({ file: rel(file), problem: p });
    return null;
  }
  return res.data;
}

async function listProfiles(): Promise<string[]> {
  const names = await fs.readdir(dataRoot()).catch(() => [] as string[]);
  const out: string[] = [];
  for (const n of names) {
    if (!isSlug(n)) continue;
    const st = await fs.stat(path.join(dataRoot(), n)).catch(() => null);
    if (st?.isDirectory()) out.push(n);
  }
  return out.sort();
}

async function checkMemory(dir: string, issues: Issue[], counter: { n: number }) {
  const files = await listRecordFiles(dir, ".md");
  const index = path.join(dir, "MEMORY.md");
  const memFiles = files.filter((f) => f !== index);
  if (memFiles.length === 0 && !(await readText(index))) return;
  const indexText = (await readText(index)) ?? "";
  if (!indexText) issues.push({ file: rel(index), problem: "missing index for memory files" });
  const linked = new Set([...indexText.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]));
  for (const l of linked) {
    if (!memFiles.some((f) => path.basename(f) === l)) issues.push({ file: rel(index), problem: `links missing file ${l}` });
  }
  const names = new Map<string, string>();
  for (const f of memFiles) {
    counter.n++;
    if (!linked.has(path.basename(f))) issues.push({ file: rel(f), problem: "not listed in MEMORY.md" });
    const data = await parseWith(f, memorySchema, "front", issues);
    if (data) names.set(data.name, f);
  }
  for (const f of memFiles) {
    const text = (await readText(f)) ?? "";
    for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
      if (!names.has(m[1])) issues.push({ file: rel(f), problem: `[[${m[1]}]] matches no memory name` });
    }
  }
}

async function checkInterviews(dir: string, jobIds: Set<string>, sources: Set<string> | null, issues: Issue[], counter: { n: number }) {
  const idir = path.join(dir, "interviews");
  for (const f of await listRecordFiles(idir, ".md")) {
    counter.n++;
    const slug = path.basename(f, ".md");
    const named = ROUND_SLUG.exec(slug);
    if (!named) {
      issues.push({ file: rel(f), problem: "a round file is named <YYYY-MM-DD>-<company>-r<round>.md" });
      continue;
    }
    const rec = (await parseWith(f, interviewSchema, "front", issues)) as InterviewRecord | null;
    if (!rec) continue;
    if (named[1] !== rec.date || Number(named[2]) !== rec.round)
      issues.push({ file: rel(f), problem: `the name says ${named[1]} round ${named[2]}, the front matter says ${rec.date} round ${rec.round}` });
    if (!jobIds.has(rec.job)) issues.push({ file: rel(f), problem: `job ${rec.job} matches no job file` });
    if (rec.transcript && (await readText(path.join(idir, `${slug}.transcript.txt`))) === null)
      issues.push({ file: rel(f), problem: `transcript named but ${slug}.transcript.txt is missing` });
    if (sources)
      for (const n of rec.numbers)
        for (const { token, key } of numberTokens(n)) if (!sources.has(key)) issues.push({ file: rel(f), problem: `numbers: "${token}" ${UNBACKED}` });
  }
  const bank = path.join(dir, INTERVIEW_ANSWERS_FILE);
  if ((await readText(bank)) === null) return;
  counter.n++;
  const rec = (await parseWith(bank, interviewAnswersSchema, "front", issues)) as { landed: string[] } | null;
  // Lines that landed feed the tailoring prompt, so an unbacked number there is listed (it was said aloud, not sent).
  if (rec && sources)
    for (const line of rec.landed)
      for (const { token, key } of numberTokens(line))
        if (!sources.has(key)) issues.push({ file: rel(bank), problem: `landed: "${token}" ${UNBACKED}`, warning: true });
}

// The banner is public, so a number not backed by the career record or a story is an error, never a warning.
async function checkBanner(dir: string, sources: Set<string> | null, issues: Issue[], counter: { n: number }) {
  const file = path.join(dir, "banner.yaml");
  if ((await readText(file)) === null) return;
  counter.n++;
  const banner = await parseWith(file, bannerSchema, "yaml", issues);
  if (!banner) return;
  const onDisk = new Set((await fs.readdir(path.join(dir, "backgrounds")).catch(() => [] as string[])).filter((f) => f.endsWith(".png")));
  const listed = new Set(banner.backgrounds.map((b) => b.file));
  for (const f of listed) if (!onDisk.has(f)) issues.push({ file: rel(file), problem: `background ${f} not found` });
  if (banner.background && !onDisk.has(banner.background)) issues.push({ file: rel(file), problem: `background ${banner.background} not found` });
  for (const f of onDisk) {
    if (!listed.has(f)) issues.push({ file: rel(path.join(dir, "backgrounds", f)), problem: "not listed in banner.yaml: add it to backgrounds there or delete it" });
  }
  if (!sources) return;
  for (const field of ["valueLine", "roleLine"] as const) {
    for (const n of numberTokens(banner[field])) {
      if (!sources.has(n.key)) issues.push({ file: rel(file), problem: `${field}: "${n.token}" ${UNBACKED}` });
    }
  }
}

export async function validateProfile(profile: string, counter = { n: 0 }): Promise<Issue[]> {
  const issues: Issue[] = [];
  const dir = path.join(dataRoot(), profile);
  const p = (...x: string[]) => path.join(dir, ...x);

  const profileRec = (await parseWith(p("profile.yaml"), profileSchema, "yaml", issues)) as ProfileRecord | null;
  counter.n++;
  const career = (await parseWith(p("career.yaml"), careerSchema, "yaml", issues)) as CareerRecord | null;
  counter.n++;

  const bulletIds = new Set<string>();
  const positionIds = new Set<string>();
  const storyRefs: { file: string; slug: string }[] = [];
  if (career) {
    for (const c of career.companies)
      for (const pos of c.positions) {
        positionIds.add(pos.id);
        for (const b of pos.bullets) {
          bulletIds.add(b.id);
          if (b.story) storyRefs.push({ file: rel(p("career.yaml")), slug: b.story });
        }
      }
  }
  const skillIds = new Set(career?.skills.map((s) => s.id) ?? []);
  const courseIds = new Set(career?.courses.map((s) => s.id) ?? []);
  const eduIds = new Set(career?.education.map((s) => s.id) ?? []);

  const storySlugs = new Set<string>();
  const stories: StoryRecord[] = [];
  for (const f of await listRecordFiles(p("stories"), ".md")) {
    if (++counter.n > MAX_FILES) break;
    storySlugs.add(path.basename(f, ".md"));
    const s = (await parseWith(f, storySchema, "front", issues)) as StoryRecord | null;
    if (s) stories.push(s);
  }
  const sources = career && profileRec ? sourceNumbers(profileRec, career, stories) : null;
  const baseline = await readClaimsBaseline(profile);

  // Jobs first: a CV counts as sent once a job using it reached Applied.
  const jobs: { file: string; job: JobRecord }[] = [];
  const sentCvIds = new Set<string>();
  for (const f of await listRecordFiles(p("jobs"), ".md")) {
    if (++counter.n > MAX_FILES) break;
    const job = (await parseWith(f, jobSchema, "front", issues)) as JobRecord | null;
    if (!job) continue;
    jobs.push({ file: rel(f), job });
    for (const a of job.answers) if (a.story) storyRefs.push({ file: rel(f), slug: a.story });
    const applied = SENT_STAGES.has(job.stage) || job.stageHistory.some((h) => SENT_STAGES.has(h.stage));
    if (job.cv && applied) sentCvIds.add(job.cv);
  }

  const cvIds = new Set<string>();
  for (const f of await listRecordFiles(p("cvs"), ".yaml")) {
    if (++counter.n > MAX_FILES) break;
    const cv = (await parseWith(f, cvSchema, "yaml", issues)) as CvRecord | null;
    if (!cv) continue;
    cvIds.add(cv.id);
    if (!career) continue;
    const o = cv.overrides;
    const bad = (kind: string, id: string) => issues.push({ file: rel(f), problem: `${kind} ${id} is not in career.yaml` });
    for (const [pid, po] of Object.entries(o.positions)) {
      if (!positionIds.has(pid)) bad("position", pid);
      for (const bid of [...Object.keys(po.bullets), ...(po.includedBulletIds ?? [])]) if (!bulletIds.has(bid)) bad("bullet", bid);
    }
    for (const id of [...(o.hiddenPositionIds ?? []), ...(o.positionOrder ?? [])]) if (!positionIds.has(id)) bad("position", id);
    for (const id of o.skillIds ?? []) if (!skillIds.has(id)) bad("skill", id);
    for (const id of o.courseIds ?? []) if (!courseIds.has(id)) bad("course", id);
    for (const id of o.educationDateIds ?? []) if (!eduIds.has(id)) bad("education", id);
    if (sources) {
      for (const n of inventedNumbers(cv, sources)) {
        // A CV already sent is the record of what went out, and a baselined hit is waiting on the person:
        // both are listed, not blocking. Any other unbacked number blocks.
        const known = Boolean(cv.pdf) || sentCvIds.has(cv.id) || baseline.has(claimKey(cv.id, n.token));
        issues.push({ file: rel(f), problem: `${n.field}: "${n.token}" ${UNBACKED}`, warning: known, cvId: cv.id, token: n.token });
      }
    }
    if (cv.pdf && !(await fs.stat(path.join(path.dirname(f), cv.pdf)).catch(() => null))) {
      issues.push({ file: rel(f), problem: `pdf ${cv.pdf} not found` });
    }
  }

  for (const { file, job } of jobs) {
    if (job.cv && !cvIds.has(job.cv)) issues.push({ file, problem: `cv ${job.cv} does not exist` });
  }

  for (const r of storyRefs) {
    if (!storySlugs.has(r.slug)) issues.push({ file: r.file, problem: `story ${r.slug} does not exist` });
  }

  await checkInterviews(dir, new Set(jobs.map((j) => j.job.id)), sources, issues, counter);
  await checkBanner(p("linkedin"), sources, issues, counter);
  if (await readText(p("hunt", "seen.yaml"))) {
    counter.n++;
    await parseWith(p("hunt", "seen.yaml"), huntSeenSchema, "yaml", issues);
  }
  for (const [name, schema] of [["draft.yaml", linkedinDraftSchema], ["profile.yaml", linkedinProfileSchema]] as const) {
    const file = p("linkedin", name);
    if (!(await readText(file))) continue;
    counter.n++;
    const rec = await parseWith(file, schema as z.ZodType<Pick<LinkedinProfile, "headline" | "about" | "roles">>, "yaml", issues);
    if (!rec) continue;
    for (const r of rec.roles) if (career && !positionIds.has(r.positionId)) issues.push({ file: rel(file), problem: `position ${r.positionId} is not in career.yaml` });
    if (!sources) continue;
    const texts: [string, string][] = [["headline", rec.headline], ["about", rec.about], ...rec.roles.map((r): [string, string] => [`role ${r.positionId}`, r.text])];
    for (const [field, text] of texts)
      for (const { token, key } of numberTokens(text))
        // profile.yaml records what is live on LinkedIn, like a sent CV: listed, not blocking. A draft is a proposal: blocking.
        if (!sources.has(key)) issues.push({ file: rel(file), problem: `${field}: "${token}" ${UNBACKED}`, warning: name === "profile.yaml" });
  }

  await checkMemory(p("memory"), issues, counter);
  return issues;
}

export async function validateAll(): Promise<{ issues: Issue[]; files: number; profiles: string[] }> {
  const counter = { n: 0 };
  const profiles = await listProfiles();
  const issues: Issue[] = [];
  for (const prof of profiles) issues.push(...(await validateProfile(prof, counter)));
  return { issues, files: counter.n, profiles };
}
