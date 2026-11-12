import { randomBytes } from "node:crypto";
import { fromYaml, hashText, readText, toYaml, writeAtomic } from "./files";
import { withProfileLock } from "./lock";
import { commitProfile } from "./history";
import { isUnreadable, profilePath, StoreError } from "./paths";
import { careerSchema, describeIssues, profileSchema, type CareerRecord, type ProfileRecord } from "./schemas";
import type { z } from "zod";

type Versioned<T> = { data: T; version: string };

async function readVersioned<S extends z.ZodType>(profile: string, name: string, schema: S): Promise<Versioned<z.infer<S>>> {
  const text = await readText(profilePath(profile, name));
  if (text === null) throw new StoreError("not_found", `${profile}/${name} is missing`);
  const res = schema.safeParse(fromYaml(text));
  if (!res.success) throw new StoreError("invalid", `${profile}/${name}: ${describeIssues(res.error).join("; ")}`);
  return { data: res.data, version: hashText(text) };
}

export const readCareer = (profile: string) => readVersioned(profile, "career.yaml", careerSchema);
export const readProfileVersioned = (profile: string) => readVersioned(profile, "profile.yaml", profileSchema);

/** True when the career record has at least one position; false when it's empty, missing or unreadable. */
export async function hasCareer(profile: string): Promise<boolean> {
  try {
    return (await readCareer(profile)).data.companies.some((c) => c.positions.length > 0);
  } catch (e) {
    if (isUnreadable(e)) return false;
    throw e;
  }
}

/**
 * Read-modify-write under the profile lock. When the caller passes the version it last read,
 * a file changed since (another tab, Claude, a text editor) makes this throw "stale" instead of overwriting.
 * Returns the callback's result and the file's new version.
 */
async function update<T, R>(
  profile: string,
  name: string,
  read: (p: string) => Promise<Versioned<T>>,
  expected: string | undefined,
  fn: (data: T) => R,
  message: string,
): Promise<{ result: R; version: string }> {
  return withProfileLock(profile, async () => {
    const cur = await read(profile);
    if (expected !== undefined && expected !== cur.version) {
      throw new StoreError("stale", `${name} changed since it was read`);
    }
    const result = fn(cur.data);
    const text = toYaml(cur.data);
    await writeAtomic(profilePath(profile, name), text);
    await commitProfile(profile, message, [profilePath(profile, name)]);
    return { result, version: hashText(text) };
  });
}

export const updateCareer = <R>(profile: string, expected: string | undefined, fn: (c: CareerRecord) => R, message: string) =>
  update(profile, "career.yaml", readCareer, expected, fn, `career record: ${message}`);

export const updateProfileRecord = <R>(profile: string, expected: string | undefined, fn: (p: ProfileRecord) => R) =>
  update(profile, "profile.yaml", readProfileVersioned, expected, fn, "profile edited");

export function newBulletId(): string {
  return `b${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
}

export function findPosition(c: CareerRecord, id: string) {
  for (const co of c.companies) for (const p of co.positions) if (p.id === id) return p;
  return null;
}

export function findBullet(c: CareerRecord, id: string) {
  for (const co of c.companies)
    for (const p of co.positions) {
      const i = p.bullets.findIndex((b) => b.id === id);
      if (i !== -1) return { position: p, index: i, bullet: p.bullets[i] };
    }
  return null;
}
