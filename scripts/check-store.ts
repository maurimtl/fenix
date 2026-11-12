import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(".scratch/check-store");
process.env.FENIX_DATA_DIR = ROOT;

const { assertSlug, profilePath, StoreError } = await import("../lib/store/paths");
const files = await import("../lib/store/files");
const { withProfileLock } = await import("../lib/store/lock");

const counter = () => profilePath("t", "counter.yaml");

async function increment(times: number) {
  for (let i = 0; i < times; i++) {
    await withProfileLock("t", async () => {
      const text = await files.readText(counter());
      const n = text ? (files.fromYaml(text) as { n: number }).n : 0;
      await files.writeAtomic(counter(), files.toYaml({ n: n + 1 }));
    });
  }
}

if (process.argv[2] === "--worker") {
  await increment(Number(process.argv[3]));
  process.exit(0);
}

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`ok  ${name}`);
}

await fs.rm(ROOT, { recursive: true, force: true });
await fs.mkdir(ROOT, { recursive: true });

await check("empty file parses to empty front matter", () => {
  assert.deepEqual(files.parseFrontMatter(""), { data: {}, body: "" });
});
await check("text without front matter is all body", () => {
  assert.deepEqual(files.parseFrontMatter("# Hi\n"), { data: {}, body: "# Hi\n" });
});
await check("front matter + body round-trip, non-ASCII kept", () => {
  const doc = { data: { city: "Montréal", title: "Señor PM — Growth" }, body: "Line one\n## Not a field\n" };
  assert.deepEqual(files.parseFrontMatter(files.stringifyFrontMatter(doc)), doc);
});
await check("risky strings stay strings and are quoted", () => {
  const data = { a: "no", b: "on", c: "2026-01-05", d: "007", e: "yes", f: "12:30", g: "null" };
  const text = files.toYaml(data);
  assert.deepEqual(files.fromYaml(text), data);
  for (const v of ["no", "on", "2026-01-05", "007", "yes"]) assert.match(text, new RegExp(`"${v}"`));
});
await check("multiline text round-trips as a block scalar", () => {
  const data = { jd: "First line\n\n  indented\nlast: colon\n", notes: "a\nb" };
  const text = files.toYaml(data);
  assert.match(text, /jd: \|/);
  assert.deepEqual(files.fromYaml(text), data);
});
await check("bad slugs and path segments are rejected", () => {
  for (const s of ["../x", "A B", "", "-x", "a/b"]) assert.throws(() => assertSlug(s), StoreError);
  assert.throws(() => profilePath("t", ".."), StoreError);
  assert.throws(() => profilePath("t", "a/b"), StoreError);
});
await check("unknown keys survive a read-write cycle", async () => {
  const f = profilePath("t", "rec.md");
  await files.writeAtomic(f, files.stringifyFrontMatter({ data: { id: "1", portfolio: ["x"] }, body: "body\n" }));
  const doc = files.parseFrontMatter((await files.readText(f))!);
  doc.data.id = "2";
  await files.writeAtomic(f, files.stringifyFrontMatter(doc));
  const again = files.parseFrontMatter((await files.readText(f))!);
  assert.deepEqual(again.data, { id: "2", portfolio: ["x"] });
  assert.equal(again.body, "body\n");
});
await check("writeIfUnchanged refuses a stale hash", async () => {
  const f = profilePath("t", "stale.yaml");
  await files.writeAtomic(f, "a: 1\n");
  const h = files.hashText("a: 1\n");
  await files.writeAtomic(f, "a: 2\n");
  await assert.rejects(files.writeIfUnchanged(f, "a: 3\n", h), (e: unknown) => e instanceof StoreError && e.code === "stale");
  await files.writeIfUnchanged(f, "a: 3\n", files.hashText("a: 2\n"));
  assert.equal(await files.readText(f), "a: 3\n");
});
await check("createExclusive refuses an existing file", async () => {
  const f = profilePath("t", "once.md");
  await files.createExclusive(f, "x\n");
  await assert.rejects(files.createExclusive(f, "y\n"), (e: unknown) => e instanceof StoreError && e.code === "exists");
  assert.equal(await files.readText(f), "x\n");
});
await check("no temp files left behind", async () => {
  const names = await fs.readdir(path.join(ROOT, "t"));
  assert.equal(names.filter((n) => n.endsWith(".tmp")).length, 0);
});
await check("2 processes x 20 locked increments end at 40", async () => {
  await fs.rm(counter(), { force: true });
  const self = fileURLToPath(import.meta.url);
  const run = () =>
    new Promise<void>((res, rej) => {
      const p = spawn("pnpm", ["exec", "tsx", self, "--worker", "20"], { stdio: "inherit", env: process.env });
      p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`worker exit ${code}`))));
    });
  await Promise.all([run(), run()]);
  assert.deepEqual(files.fromYaml((await files.readText(counter()))!), { n: 40 });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
await check("a live holder past the stale age keeps its lock (heartbeat)", async () => {
  const holder = withProfileLock("t", () => sleep(17_000));
  await sleep(10_500);
  await assert.rejects(withProfileLock("t", async () => "stolen"), (e) => e instanceof StoreError && e.code === "locked");
  await holder;
  assert.equal(await withProfileLock("t", async () => "free"), "free");
});
await check("a crashed holder's lock is taken over, and only the new owner releases it", async () => {
  const lock = profilePath("t", ".lock");
  await fs.mkdir(lock, { recursive: true });
  await fs.writeFile(path.join(lock, "owner"), "dead-process");
  const old = new Date(Date.now() - 60_000);
  await fs.utimes(lock, old, old);
  assert.equal(await withProfileLock("t", async () => (await fs.readFile(path.join(lock, "owner"), "utf8")) !== "dead-process"), true);
  assert.equal(await fs.stat(lock).catch(() => null), null);
  assert.deepEqual((await fs.readdir(profilePath("t"))).filter((n) => n.startsWith(".lock")), []);
});

await check("number words back digits only when they count something", async () => {
  const { sourceNumbers } = await import("../lib/store/claims");
  const keys = (text: string) =>
    sourceNumbers({ fullName: "T", headline: "", email: "", summary: text } as never, { companies: [], education: [], skills: [], courses: [] } as never, []);
  assert.ok(keys("Hired four PMs").has("4"));
  assert.ok(!keys("one of the largest teams").has("1"));
  assert.ok(!keys("someone did it").has("1"));
  assert.ok(!keys("two of our teams").has("2"));
  assert.ok(!keys("a three-year plan").has("3"));
  assert.ok(keys("grew revenue 30% in 2 years").has("30%"));
});

const { validateProfile } = await import("../lib/store/validate");
const D = "2026-11-07";
const settings = { floorUsd: 200000, homeCountry: "CA", homeCountryName: "Canada", remoteRule: "remote in Canada" };
const job = {
  id: "j1", source: "linkedin", sourceJobId: "1", url: "https://x.test/1", company: "Acme", title: "VP Product",
  firstSeenAt: D, lastSeenAt: D, updatedAt: D, portfolio: ["kept"],
};
async function seedProfile(slug: string) {
  await files.writeAtomic(profilePath(slug, "profile.yaml"), files.toYaml({ fullName: "Test", headline: "", email: "", summary: "", settings }));
  await files.writeAtomic(profilePath(slug, "career.yaml"), files.toYaml({
    companies: [{ id: "c1", name: "Acme", positions: [{ id: "p1", title: "PM", startDate: "2020-01-01", bullets: [{ id: "b1", text: "Did 3x" }] }] }],
  }));
}

await check("a valid profile with an extra portfolio key has no issues", async () => {
  await seedProfile("v");
  await files.writeAtomic(profilePath("v", "jobs", "acme.md"), files.stringifyFrontMatter({ data: job, body: "JD\n" }));
  assert.deepEqual(await validateProfile("v"), []);
});
await check("a job missing company is reported by field", async () => {
  const { company: _drop, ...noCompany } = job;
  await files.writeAtomic(profilePath("v", "jobs", "acme.md"), files.stringifyFrontMatter({ data: noCompany, body: "" }));
  const issues = await validateProfile("v");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].file, "v/jobs/acme.md");
  assert.match(issues[0].problem, /^company: /);
});
await check("a CV naming a missing bullet is reported with both", async () => {
  await files.writeAtomic(profilePath("v", "jobs", "acme.md"), files.stringifyFrontMatter({ data: job, body: "" }));
  await files.writeAtomic(profilePath("v", "cvs", "acme.yaml"), files.toYaml({
    id: "cv1", name: "Acme", templateId: "sidebar", createdAt: D, updatedAt: D,
    overrides: { positions: { p1: { bullets: { b404: { hidden: true } } } } },
  }));
  const issues = await validateProfile("v");
  assert.deepEqual(issues, [{ file: "v/cvs/acme.yaml", problem: "bullet b404 is not in career.yaml" }]);
});
await check("memory index and wikilinks are checked", async () => {
  await fs.rm(profilePath("v", "cvs"), { recursive: true });
  await files.writeAtomic(profilePath("v", "memory", "MEMORY.md"), "- [A](a.md) — a\n- [Gone](gone.md) — b\n");
  await files.writeAtomic(profilePath("v", "memory", "a.md"), "---\nname: a\ndescription: x\n---\nSee [[b]].\n");
  await files.writeAtomic(profilePath("v", "memory", "c.md"), "---\nname: c\ndescription: x\n---\n");
  const problems = (await validateProfile("v")).map((i) => `${i.file}: ${i.problem}`).sort();
  assert.deepEqual(problems, [
    "v/memory/MEMORY.md: links missing file gone.md",
    "v/memory/a.md: [[b]] matches no memory name",
    "v/memory/c.md: not listed in MEMORY.md",
  ]);
});

await check("a save commits only its own files; a hand edit stays uncommitted; deletions and 'all' commit", async () => {
  const { execFileSync } = await import("node:child_process");
  const { commitProfile } = await import("../lib/store/history");
  const git = (...a: string[]) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).trim();
  await fs.rm(path.join(ROOT, ".git"), { recursive: true, force: true });
  git("init", "-q");
  git("config", "user.email", "check@example.com");
  git("config", "user.name", "check");
  const job = profilePath("g", "jobs", "a.md");
  const note = profilePath("g", "memory", "hand.md");
  await files.writeAtomic(job, "one\n");
  await files.writeAtomic(note, "one\n");
  assert.equal(await commitProfile("g", "profile created", "all"), true);
  assert.deepEqual(git("show", "--name-only", "--format=", "HEAD").split("\n").sort(), ["g/jobs/a.md", "g/memory/hand.md"]);

  await files.writeAtomic(note, "edited by hand\n");
  await files.writeAtomic(job, "two\n");
  assert.equal(await commitProfile("g", "job saved", [job]), true);
  assert.equal(git("show", "--name-only", "--format=", "HEAD"), "g/jobs/a.md");
  assert.equal(git("status", "--porcelain", "--", "g/"), "M g/memory/hand.md");

  assert.equal(await commitProfile("g", "job saved again", [job]), false, "nothing changed: no commit");
  await fs.rm(job);
  assert.equal(await commitProfile("g", "job deleted", [job, profilePath("g", "jobs", "never-existed.md")]), true);
  assert.equal(git("show", "--name-status", "--format=", "HEAD"), "D\tg/jobs/a.md");
  await assert.rejects(commitProfile("g", "x", [profilePath("other", "a.md")]), /outside g\//);
  assert.equal(await commitProfile("g", "skill files", "all"), true);
  assert.equal(git("status", "--porcelain", "--", "g/"), "");
  await fs.rm(path.join(ROOT, ".git"), { recursive: true, force: true });
});

await fs.rm(ROOT, { recursive: true, force: true });
console.log(`\n${passed} checks passed`);
