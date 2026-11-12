// pnpm fenix <command> — writes a person's records through lib/store (validation, lock, data commit).
// For skills and scripts; the app's API does the same for the browser.
//
//   create-profile "<Full Name>" [--scratch]   new data/<slug>/; --scratch marks a throwaway that is never committed
//   import-career <person> <file.yaml>          replace career.yaml with the file's companies, education, skills, courses
//   set-profile <person> <file.yaml>            merge fields into profile.yaml (fullName, headline, summary, contact, settings)
//   remove-scratch <person>                     delete a throwaway profile (only one marked --scratch)
//   sync-cvs <person>                           copy every live CV version's PDF into the person's CV folder (settings.cvFolder)
import { promises as fs } from "node:fs";
import path from "node:path";
import { updateCareer, updateProfileRecord } from "../lib/store/career";
import { fromYaml } from "../lib/store/files";
import { SCRATCH_MARKER } from "../lib/store/history";
import { assertSlug, profileDir } from "../lib/store/paths";
import { createProfile } from "../lib/store/profiles";
import { syncFolder } from "../lib/store/cv-folder";
import { careerSchema, describeIssues, profileSchema } from "../lib/store/schemas";

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const args = rest.filter((a) => !a.startsWith("--"));

async function readYamlFile(file: string): Promise<unknown> {
  return fromYaml(await fs.readFile(path.resolve(file), "utf8"));
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

switch (cmd) {
  case "create-profile": {
    if (!args[0]) fail('usage: pnpm fenix create-profile "<Full Name>" [--scratch]');
    console.log(await createProfile(args[0], { scratch: flags.has("--scratch") }));
    break;
  }
  case "import-career": {
    const person = assertSlug(args[0] ?? "");
    const parsed = careerSchema.safeParse(await readYamlFile(args[1] ?? fail("usage: pnpm fenix import-career <person> <file.yaml>")));
    if (!parsed.success) fail(`not a valid career record:\n${describeIssues(parsed.error).join("\n")}`);
    await updateCareer(person, undefined, (c) => Object.assign(c, parsed.data), "imported");
    const positions = parsed.data.companies.reduce((n, c) => n + c.positions.length, 0);
    console.log(`${person}: career record imported (${parsed.data.companies.length} companies, ${positions} positions)`);
    break;
  }
  case "set-profile": {
    const person = assertSlug(args[0] ?? "");
    const patch = (await readYamlFile(args[1] ?? fail("usage: pnpm fenix set-profile <person> <file.yaml>"))) as Record<string, unknown>;
    await updateProfileRecord(person, undefined, (p) => {
      const next = { ...p, ...patch, settings: { ...p.settings, ...((patch.settings as object) ?? {}) } };
      const res = profileSchema.safeParse(next);
      // Throw, don't exit: exiting here would skip the lock's release.
      if (!res.success) throw new Error(`profile would be invalid:\n${describeIssues(res.error).join("\n")}`);
      Object.assign(p, res.data);
    }).catch((e: Error) => fail(e.message));
    console.log(`${person}: profile updated`);
    break;
  }
  case "remove-scratch": {
    const dir = profileDir(assertSlug(args[0] ?? ""));
    if (!(await fs.stat(path.join(dir, SCRATCH_MARKER)).catch(() => null))) fail(`${args[0]} is not a scratch profile; refusing to delete it`);
    await fs.rm(dir, { recursive: true, force: true });
    console.log(`removed ${args[0]}`);
    break;
  }
  case "sync-cvs": {
    const person = assertSlug(args[0] ?? fail("usage: pnpm fenix sync-cvs <person>"));
    const r = await syncFolder(person);
    if (!r.folder) fail(`${person} has no CV folder set (settings.cvFolder)`);
    for (const w of r.warnings) console.warn(w);
    console.log(`${person}: copied ${r.copied} PDF${r.copied === 1 ? "" : "s"} to ${r.folder}`);
    break;
  }
  default:
    fail("commands: create-profile, import-career, set-profile, remove-scratch, sync-cvs (see scripts/fenix.ts)");
}
