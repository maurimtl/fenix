import { fromYaml, readText, toYaml, writeAtomic } from "./files";
import { commitProfile } from "./history";
import { withProfileLock } from "./lock";
import { profilePath, StoreError } from "./paths";
import { describeIssues, huntSeenSchema, type HuntSeen } from "./schemas";

/** Keys older than this are dropped on the next write; a posting that old is no longer listed anywhere. */
export const SEEN_KEEP_DAYS = 180;

const seenFile = (p: string) => profilePath(p, "hunt", "seen.yaml");

/** Roles and posts the hunt has already judged for this person: key ("<source>:<id>") to the day it was marked. */
export async function readHuntSeen(profile: string): Promise<HuntSeen> {
  const text = await readText(seenFile(profile));
  if (text === null) return { seen: {} };
  const res = huntSeenSchema.safeParse(fromYaml(text));
  if (!res.success) throw new StoreError("invalid", `${profile}/hunt/seen.yaml: ${describeIssues(res.error).join("; ")}`);
  return res.data;
}

/** Adds keys with today's date. A key already there keeps its date. Returns how many were new. */
export async function addHuntSeen(profile: string, keys: string[], now = new Date()): Promise<{ added: number; total: number }> {
  return withProfileLock(profile, async () => {
    const { seen } = await readHuntSeen(profile);
    const today = now.toISOString().slice(0, 10);
    const cutoff = new Date(now.getTime() - SEEN_KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const [k, day] of Object.entries(seen)) if (day < cutoff) delete seen[k];
    let added = 0;
    for (const k of keys) {
      if (k in seen) continue;
      seen[k] = today;
      added++;
    }
    if (added > 0) {
      await writeAtomic(seenFile(profile), toYaml({ seen }));
      await commitProfile(profile, `hunt: ${added} role(s) marked seen`, [seenFile(profile)]);
    }
    return { added, total: Object.keys(seen).length };
  });
}
