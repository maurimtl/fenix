import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { fromYaml, hashText, localDate, readText, toYaml, writeAtomic } from "./files";
import { withProfileLock } from "./lock";
import { commitProfile } from "./history";
import { profilePath, StoreError } from "./paths";
import { readProfile } from "./profiles";
import { bannerSchema, describeIssues, type BannerBackground, type BannerRecord } from "./schemas";

export type BannerFile = { data: BannerRecord; version: string };

/** Fields the editor may change; backgrounds are only added by addBackground. */
export type BannerPatch = Partial<Pick<BannerRecord, "valueLine" | "roleLine" | "textScale" | "textCenterY" | "cropY" | "background" | "styleNote">>;

const NEW = "new";
const bannerFile = (profile: string) => profilePath(profile, "linkedin", "banner.yaml");
export const backgroundPath = (profile: string, file: string) => profilePath(profile, "linkedin", "backgrounds", file);
export const exportPath = (profile: string) => profilePath(profile, "linkedin", "banner.png");

export async function readBanner(profile: string): Promise<BannerFile> {
  const text = await readText(bannerFile(profile));
  if (text === null) {
    const person = await readProfile(profile);
    return { data: bannerSchema.parse({ roleLine: person.headline.slice(0, 120) }), version: NEW };
  }
  const res = bannerSchema.safeParse(fromYaml(text));
  if (!res.success) throw new StoreError("invalid", `${profile}/linkedin/banner.yaml: ${describeIssues(res.error).join("; ")}`);
  return { data: res.data, version: hashText(text) };
}

async function updateLocked(profile: string, expected: string | undefined, fn: (b: BannerRecord) => void): Promise<BannerFile> {
  const cur = await readBanner(profile);
  if (expected !== undefined && expected !== cur.version) throw new StoreError("stale", "banner.yaml changed since it was read");
  fn(cur.data);
  cur.data.updatedAt = localDate();
  const res = bannerSchema.safeParse(cur.data);
  if (!res.success) throw new StoreError("invalid", describeIssues(res.error).join("; "));
  const text = toYaml(res.data);
  await writeAtomic(bannerFile(profile), text);
  return { data: res.data, version: hashText(text) };
}

/** Autosave passes commit: false so slider drags don't each become a git commit; Download and Generate commit. */
export async function saveBanner(profile: string, expected: string | undefined, patch: BannerPatch, opts: { commit: boolean }) {
  return withProfileLock(profile, async () => {
    const out = await updateLocked(profile, expected, (b) => Object.assign(b, patch));
    if (opts.commit) await commitProfile(profile, "banner saved", [bannerFile(profile)]);
    return out;
  });
}

/**
 * Stores a generated background, lists it and selects it. Caller makes the (slow, paid) call before this, outside the lock.
 * The PNG is written before the lock: if listing it fails, the paid image is still on disk and check:data names it.
 */
export async function addBackground(profile: string, png: Uint8Array, meta: Pick<BannerBackground, "model" | "size" | "quality">) {
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const file = `${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(2).toString("hex")}.png`;
  await writeAtomic(backgroundPath(profile, file), png);
  return withProfileLock(profile, async () => {
    const out = await updateLocked(profile, undefined, (b) => {
      b.backgrounds.push({ file, ...meta, createdAt: localDate(now) });
      b.background = file;
    });
    await commitProfile(profile, "banner background generated", [bannerFile(profile), backgroundPath(profile, file)]);
    return { ...out, file };
  });
}

export async function readBackground(profile: string, file: string): Promise<Buffer | null> {
  if (!/^[0-9a-z-]+\.png$/.test(file)) return null;
  return fs.readFile(backgroundPath(profile, file)).catch(() => null);
}

/** The exported PNG is regenerable, so it is written but not committed (data/.gitignore lists it). */
export async function saveExport(profile: string, png: Uint8Array) {
  await withProfileLock(profile, () => writeAtomic(exportPath(profile), png));
}
