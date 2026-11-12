// pnpm check:start — the setup checklist and Today on Home, on a scratch profile, step by step.
// Expected counts are literals; the profile is removed afterwards and, being scratch, never committed.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { computeProgress, setupPending } from "../lib/start/progress";
import { computeToday } from "../lib/start/today";
import { hasCareer } from "../lib/store/career";
import { dataRoot, profileDir } from "../lib/store/paths";
import { createProfile } from "../lib/store/profiles";

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);
const fenix = (...a: string[]) => execFileSync("pnpm", ["-s", "fenix", ...a], { encoding: "utf8" });
const head = () => execFileSync("git", ["-C", dataRoot(), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const before = head();
const slug = await createProfile(`Zz Start ${Date.now().toString(36)}`, { scratch: true });
const tmp = path.join(".scratch", `check-start-${slug}`);
try {
  const done = async () => (await computeProgress(slug)).filter((s) => s.done).map((s) => s.key);

  let steps = await computeProgress(slug);
  check("new profile: 7 steps", steps.length === 7, String(steps.length));
  check("new profile: 0 done", (await done()).length === 0, (await done()).join(","));
  check("new profile: setup pending", setupPending(steps));
  check("new profile: no career", !(await hasCareer(slug)));

  fenix("import-career", slug, "examples/demo/career.yaml");
  check("after import-career: career done only", JSON.stringify(await done()) === '["career"]', (await done()).join(","));
  check("after import-career: hasCareer", await hasCareer(slug));

  await fs.mkdir(tmp, { recursive: true });
  const patch = path.join(tmp, "settings.yaml");
  await fs.writeFile(patch, "settings:\n  floorUsd: 0\n  remoteRule: remote, hiring in Canada\n  targetTitles: [Director of Product]\n");
  fenix("set-profile", slug, patch);
  check("after set-profile (floor 0 allowed): career, settings", JSON.stringify(await done()) === '["career","settings"]', (await done()).join(","));

  const demo = "examples/demo/stories";
  for (const f of await fs.readdir(demo)) await fs.copyFile(path.join(demo, f), path.join(profileDir(slug), "stories", f));
  steps = await computeProgress(slug);
  check("2 stories: not done", !steps.find((s) => s.key === "stories")!.done, steps.find((s) => s.key === "stories")!.detail);
  const one = await fs.readFile(path.join(demo, "pricing-plans.md"), "utf8");
  await fs.writeFile(path.join(profileDir(slug), "stories", "third-story.md"), one);
  steps = await computeProgress(slug);
  check("3 stories: done", steps.find((s) => s.key === "stories")!.detail === "3 stories");
  check("after 3 stories: setup no longer pending", !setupPending(steps));
  check("hunt still open", !steps.find((s) => s.key === "hunt")!.done);

  await fs.writeFile(path.join(profileDir(slug), "career.yaml"), "companies: [not, valid\n");
  steps = await computeProgress(slug);
  const career = steps.find((s) => s.key === "career")!;
  check("broken career.yaml: that step errors, the rest compute", Boolean(career.error) && steps.find((s) => s.key === "settings")!.done, career.error ?? "");

  // Today, on a fixed local "now": the demo's Brightline application entered Applied 2026-10-21 14:05 UTC.
  const now = new Date(2026, 10, 21, 15, 0);
  const jobsDir = path.join(profileDir(slug), "jobs");
  for (const f of await fs.readdir("examples/demo/jobs")) await fs.copyFile(path.join("examples/demo/jobs", f), path.join(jobsDir, f));
  const round = await fs.readFile("examples/demo/interviews/2026-10-20-brightline-r1.md", "utf8");
  const ivDir = path.join(profileDir(slug), "interviews");
  await fs.mkdir(ivDir, { recursive: true });
  for (const [date, r] of [["2026-11-24", 2], ["2026-11-29", 3], ["2026-11-20", 4]] as const) {
    const text = round.replace('date: "2026-10-20"', `date: "${date}"`).replace("round: 1", `round: ${r}`);
    await fs.writeFile(path.join(ivDir, `${date}-brightline-r${r}.md`), text);
  }
  await fs.writeFile(path.join(ivDir, "2026-11-22-brightline-r5.md"), "---\nround: [not, valid\n---\n");
  const today = await computeToday(slug, now);
  check("today: interview 3 days ahead listed, 8 days ahead and yesterday not, broken round skipped",
    JSON.stringify(today.interviews.lines.map((l) => l.detail)) === '["2026-11-24"]', JSON.stringify(today.interviews.lines));
  const utcNow = new Date(Date.UTC(2026, 10, 21, 15, 0));
  check("today: Applied 31 days with no reply listed",
    JSON.stringify((await computeToday(slug, utcNow)).noReply.lines.map((l) => l.detail)) === '["no reply in 31 days"]', "");
  check("today: CV ready and needs-a-check jobs listed",
    today.cvReady.lines.length === 1 && today.found.lines.length === 1, `${today.cvReady.lines.length} ${today.found.lines.length}`);
  check("today: 30 days is not yet no-reply", (await computeToday(slug, new Date(Date.UTC(2026, 10, 20, 15, 0)))).noReply.lines.length === 0);
} finally {
  fenix("remove-scratch", slug);
  await fs.rm(tmp, { recursive: true, force: true });
}
check("data repo HEAD unchanged", head() === before);

for (const [name, ok, detail] of results) console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail && !ok ? ` (${detail})` : ""}`);
const failed = results.filter((r) => !r[1]).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
