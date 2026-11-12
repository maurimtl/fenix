import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { profileDir, StoreError } from "./paths";

const RETRY_MS = 50;
const WAIT_MS = 5_000;
const STALE_MS = 10_000;
const HEARTBEAT_MS = 2_000;

const ownerFile = (lock: string) => path.join(lock, "owner");

// mkdir is atomic across processes, so the web app, scripts and Claude's CLI calls share one lock per profile.
// A live holder refreshes the lock's mtime, so only a crashed holder's lock goes stale. A stale lock is renamed
// away before removal: rename is atomic, so exactly one waiter takes it.
export async function withProfileLock<T>(profile: string, fn: () => Promise<T>): Promise<T> {
  const dir = profileDir(profile);
  await fs.mkdir(dir, { recursive: true });
  const lock = path.join(dir, ".lock");
  const token = `${process.pid}-${randomBytes(6).toString("hex")}`;
  const started = Date.now();
  for (;;) {
    try {
      await fs.mkdir(lock);
      await fs.writeFile(ownerFile(lock), token);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const st = await fs.stat(lock).catch(() => null);
      if (st && Date.now() - st.mtimeMs > STALE_MS) {
        const grave = `${lock}.stale-${token}`;
        if (await fs.rename(lock, grave).then(() => true, () => false)) await fs.rm(grave, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - started > WAIT_MS) {
        throw new StoreError("locked", `profile ${profile} is busy`);
      }
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
  const beat = setInterval(() => {
    const now = new Date();
    void fs.utimes(lock, now, now).catch(() => {});
  }, HEARTBEAT_MS);
  beat.unref();
  try {
    return await fn();
  } finally {
    clearInterval(beat);
    const owner = await fs.readFile(ownerFile(lock), "utf8").catch(() => null);
    if (owner === token) await fs.rm(lock, { recursive: true, force: true });
  }
}
