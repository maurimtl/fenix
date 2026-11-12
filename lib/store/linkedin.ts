import { sectionLabel, sectionText, type LinkedinSection } from "@/lib/linkedin/sections";
import { readCareer } from "./career";
import { fromYaml, hashText, localDate, readText, toYaml, writeAtomic } from "./files";
import { withProfileLock } from "./lock";
import { commitProfile } from "./history";
import { profilePath, StoreError } from "./paths";
import { describeIssues, linkedinDraftSchema, linkedinProfileSchema, type LinkedinDraft, type LinkedinProfile } from "./schemas";

export type LinkedinProfileFile = { data: LinkedinProfile; version: string };

const NEW = "new";
const profileFile = (p: string) => profilePath(p, "linkedin", "profile.yaml");
const draftFile = (p: string) => profilePath(p, "linkedin", "draft.yaml");

/** The live profile record; an empty one (version "new") when nothing has been recorded yet. */
export async function readLinkedinProfile(profile: string): Promise<LinkedinProfileFile> {
  const text = await readText(profileFile(profile));
  if (text === null) return { data: linkedinProfileSchema.parse({}), version: NEW };
  const res = linkedinProfileSchema.safeParse(fromYaml(text));
  if (!res.success) throw new StoreError("invalid", `${profile}/linkedin/profile.yaml: ${describeIssues(res.error).join("; ")}`);
  return { data: res.data, version: hashText(text) };
}

/** The current draft, or null when there is none. */
export async function readLinkedinDraft(profile: string): Promise<LinkedinDraft | null> {
  const text = await readText(draftFile(profile));
  if (text === null) return null;
  const res = linkedinDraftSchema.safeParse(fromYaml(text));
  if (!res.success) throw new StoreError("invalid", `${profile}/linkedin/draft.yaml: ${describeIssues(res.error).join("; ")}`);
  return res.data;
}

function setSection(rec: LinkedinProfile, s: LinkedinSection, text: string) {
  if (s.kind === "headline") rec.headline = text;
  else if (s.kind === "about") rec.about = text;
  else {
    const role = rec.roles.find((r) => r.positionId === s.positionId);
    if (role) role.text = text;
    else rec.roles.push({ positionId: s.positionId, text });
  }
}

/** Versioned read-modify-write of one section under the profile lock; a stale version throws "stale" (409). */
async function updateSection(profile: string, expected: string, s: LinkedinSection, text: string, message: string) {
  if (s.kind === "role") {
    const career = (await readCareer(profile)).data;
    const known = career.companies.some((c) => c.positions.some((p) => p.id === s.positionId));
    if (!known) throw new StoreError("invalid", `position ${s.positionId} is not in career.yaml`);
  }
  return withProfileLock(profile, async () => {
    const cur = await readLinkedinProfile(profile);
    if (expected !== cur.version) throw new StoreError("stale", "linkedin/profile.yaml changed since it was read");
    setSection(cur.data, s, text);
    cur.data.updatedAt = localDate();
    const res = linkedinProfileSchema.safeParse(cur.data);
    if (!res.success) throw new StoreError("invalid", describeIssues(res.error).join("; "));
    const yaml = toYaml(res.data);
    await writeAtomic(profileFile(profile), yaml);
    await commitProfile(profile, message, [profileFile(profile)]);
    return { data: res.data, version: hashText(yaml) };
  });
}

/** The person edited one section of the live record by hand (for example after changing it on LinkedIn). */
export const saveLinkedinSection = (profile: string, expected: string, s: LinkedinSection, text: string) =>
  updateSection(profile, expected, s, text, `LinkedIn profile ${sectionLabel(s)} edited`);

/**
 * The person pasted a draft section into LinkedIn: record it as live. `shown` is the draft text the page displayed;
 * if the draft was rewritten since, the new text was never pasted, so this refuses (409) instead of recording it.
 */
export async function applyDraftSection(profile: string, expected: string, s: LinkedinSection, shown: string) {
  const draft = await readLinkedinDraft(profile);
  const text = draft ? sectionText(draft, s) : "";
  if (!text) throw new StoreError("not_found", `the draft has no ${sectionLabel(s)}`);
  if (text !== shown) throw new StoreError("stale", "the draft changed since the page loaded; reload to see the new text");
  return updateSection(profile, expected, s, text, `LinkedIn profile ${sectionLabel(s)} applied from the draft`);
}
