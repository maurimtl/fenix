import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { assertSlug, dataRoot } from "./paths";

const run = promisify(execFile);
const TRIES = 3;

/** A profile folder holding this file is a throwaway (checks, tests, pnpm fenix --scratch): its saves are never committed. */
export const SCRATCH_MARKER = ".scratch-profile";

/**
 * Commits one save as one commit: only `files` (absolute paths inside data/<person>/, including deleted ones), so a
 * file edited by hand or by a skill and not yet committed never rides along in an unrelated save. "all" commits the
 * whole folder: for a new profile, and for `pnpm data:commit` after a skill writes files directly.
 * Call it while still holding that person's lock. Never pushes (the nightly backup does). Skips when data/ isn't a git
 * repo, the profile is a scratch one, or nothing changed. A failed commit only warns: the save itself already succeeded.
 * The message names the record, never field contents.
 */
export async function commitProfile(profile: string, message: string, files: string[] | "all"): Promise<boolean> {
  const root = dataRoot();
  const person = assertSlug(profile);
  if (!(await fs.stat(path.join(root, ".git")).catch(() => null))) return false;
  if (await fs.stat(path.join(root, person, SCRATCH_MARKER)).catch(() => null)) return false;
  const specs = files === "all" ? [`${person}/`] : files.map((f) => inFolder(root, person, f));
  if (specs.length === 0) return false;
  const git = (...args: string[]) => run("git", ["-C", root, ...args], { timeout: 10_000 });
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      for (const spec of specs) {
        // A path that no longer exists is a deletion: unstage it from the index (no-op if it was never tracked).
        if (await fs.stat(path.join(root, spec)).catch(() => null)) await git("add", "-A", "--", spec);
        else await git("rm", "-r", "-q", "--cached", "--ignore-unmatch", "--", spec);
      }
      const { stdout } = await git("diff", "--cached", "--name-only", "-z", "--", ...specs);
      const staged = stdout.split("\0").filter(Boolean);
      if (staged.length === 0) return false;
      await git("commit", "-q", "-m", `${person}: ${message}`, "--", ...staged);
      return true;
    } catch (e) {
      // Another person's save or the backup can hold git's index lock for a moment.
      const busy = /index\.lock/.test(String((e as { stderr?: string }).stderr ?? e));
      if (busy && attempt < TRIES) {
        await new Promise((r) => setTimeout(r, 150 * attempt));
        continue;
      }
      console.warn(`data commit skipped for ${person}: ${String((e as Error).message).split("\n")[0]}`);
      return false;
    }
  }
  return false;
}

/** The path relative to data/, refusing anything outside the person's own folder. */
function inFolder(root: string, person: string, file: string): string {
  const rel = path.relative(root, path.resolve(file));
  if (rel !== person && !rel.startsWith(`${person}${path.sep}`)) throw new Error(`commitProfile: ${file} is outside ${person}/`);
  return rel;
}
