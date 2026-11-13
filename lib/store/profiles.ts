import { promises as fs } from "node:fs";
import path from "node:path";
import { createExclusive, fromYaml, listRecordFiles, readText, toYaml, writeAtomic } from "./files";
import { assertSlug, dataRoot, isSlug, profileDir, slugify, StoreError } from "./paths";
import { commitProfile, SCRATCH_MARKER } from "./history";
import { profileSchema, describeIssues, type ProfileRecord, type Settings } from "./schemas";

export async function readProfile(profile: string): Promise<ProfileRecord> {
  const file = path.join(profileDir(profile), "profile.yaml");
  const text = await readText(file);
  if (text === null) throw new StoreError("not_found", `no profile ${profile}`);
  const res = profileSchema.safeParse(fromYaml(text));
  if (!res.success) throw new StoreError("invalid", `${profile}/profile.yaml: ${describeIssues(res.error).join("; ")}`);
  return res.data;
}

export async function getSettings(profile: string): Promise<Settings> {
  return (await readProfile(profile)).settings;
}

export async function profileExists(profile: string): Promise<boolean> {
  if (!isSlug(profile)) return false;
  const st = await fs.stat(path.join(profileDir(profile), "profile.yaml")).catch(() => null);
  return !!st?.isFile();
}

export type ProfileSummary = { slug: string; fullName: string; jobs: number };

export async function listProfileSlugs(): Promise<string[]> {
  const names = await fs.readdir(dataRoot()).catch(() => [] as string[]);
  const out: string[] = [];
  for (const slug of names.sort()) if (await profileExists(slug)) out.push(slug);
  return out;
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  const out: ProfileSummary[] = [];
  for (const slug of await listProfileSlugs()) {
    const prof = await readProfile(slug).catch(() => null);
    const jobs = (await listRecordFiles(path.join(profileDir(slug), "jobs"), ".md")).length;
    out.push({ slug, fullName: prof?.fullName ?? slug, jobs });
  }
  return out;
}

/** A new profile's remote rule until the person answers the settings questions. */
export const NEW_REMOTE_RULE = "Not set yet. Ask Claude to set you up in Fenix.";
/** True for any new-profile placeholder, including older wordings of it. */
export const isPlaceholderRule = (rule: string) => rule.startsWith("Not set yet");

export const NEW_SETTINGS: Settings = {
  floorUsd: 0,
  strongMatchFit: 75,
  homeCountry: "US",
  homeCountryName: "United States",
  remoteRule: NEW_REMOTE_RULE,
  exceptions: [],
  targetTitles: [],
  queries: [],
  watchlistExtra: [],
  dreamCompanies: [],
  cvFileName: "{name} - {company} - {role}",
  defaultTemplate: "plain",
};

/** Creates data/<slug>/ with empty records. Throws StoreError("exists") if the slug is taken. */
export async function createProfile(fullName: string, opts: { scratch?: boolean } = {}): Promise<string> {
  const name = fullName.trim();
  if (!name || name.length > 120) throw new StoreError("invalid", "name must be 1-120 characters");
  if (/[/\\\u0000-\u001f]|\.\./.test(name)) throw new StoreError("bad_slug", "a name can't contain slashes, '..' or control characters");
  if (!/[a-z0-9]/i.test(name.normalize("NFKD"))) throw new StoreError("bad_slug", "a name needs at least one Latin letter or digit for its folder name");
  const slug = assertSlug(slugify(name, 40));
  await fs.mkdir(dataRoot(), { recursive: true });
  try {
    await fs.mkdir(profileDir(slug));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new StoreError("exists", `profile ${slug} already exists`);
    throw e;
  }
  if (opts.scratch) await fs.writeFile(path.join(profileDir(slug), SCRATCH_MARKER), "");
  for (const d of ["jobs", "cvs", "stories", "memory", "templates"]) await fs.mkdir(path.join(profileDir(slug), d));
  await writeAtomic(path.join(profileDir(slug), "career.yaml"), toYaml({ companies: [], education: [], skills: [], courses: [] }));
  await createExclusive(
    path.join(profileDir(slug), "profile.yaml"),
    toYaml({ fullName: name, headline: "", email: "", summary: "", settings: NEW_SETTINGS }),
  );
  await commitProfile(slug, "profile created", "all");
  return slug;
}
