// pnpm check:isolation [--base http://localhost:3007]
// Against the running app: makes two scratch profiles, gives the first a job, an answer, a CV, a story and a
// template, and checks that no page or route of the second shows any of them. Both are removed afterwards and,
// being scratch profiles, never reach the data repo's history.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createProfile } from "../lib/store/profiles";
import { dataRoot, profileDir } from "../lib/store/paths";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3007";
const stamp = Date.now().toString(36);
const MARK = `zzisomark${stamp}`;
// Greenhouse ids are digits (lib/jobs/schema.ts), so the job id carries no marker; company, title and URL do.
const JOB_ID = String(Date.now());
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

async function call(method: string, url: string, body?: unknown) {
  const r = await fetch(BASE + url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, text: await r.text() };
}

const git = (...g: string[]) => execFileSync("git", ["-C", dataRoot(), ...g], { encoding: "utf8" }).trim();
const head = git("rev-parse", "HEAD");
let a = "";
let b = "";
try {
  a = await createProfile(`Zz Iso A ${stamp}`, { scratch: true });
  b = await createProfile(`Zz Iso B ${stamp}`, { scratch: true });

  const job = await call("POST", `/api/p/${a}/jobs`, {
    source: "greenhouse", sourceJobId: JOB_ID, url: `https://example.com/${MARK}`, company: `${MARK} Company`,
    title: `${MARK} Title`, compSource: "unknown", remoteVerdict: "unclear",
  });
  check("job created for A", job.status === 200 || job.status === 201, `${job.status} ${job.text.slice(0, 120)}`);
  const jobId = (JSON.parse(job.text) as { id?: string; job?: { id: string } }).id ?? (JSON.parse(job.text) as { job?: { id: string } }).job?.id;
  const ans = await call("PUT", `/api/p/${a}/jobs/${jobId}/answers`, { answers: [{ question: `${MARK} question`, answer: `${MARK} answer` }] });
  check("answer saved for A", ans.status === 200, `${ans.status} ${ans.text.slice(0, 120)}`);
  const cv = await call("POST", `/api/p/${a}/variants`, { name: `${MARK} CV` });
  check("CV created for A", cv.status === 200 || cv.status === 201, `${cv.status} ${cv.text.slice(0, 120)}`);
  await fs.writeFile(path.join(profileDir(a), "stories", `${MARK}.md`), `---\ntitle: ${MARK} story\n---\nBody.\n`);
  const tpl = path.join(profileDir(a), "templates", MARK);
  await fs.mkdir(tpl);
  await fs.writeFile(path.join(tpl, "template.yaml"), `name: ${MARK} template\n`);
  await fs.writeFile(path.join(tpl, "template.liquid"), "<p>{{ fullName }}</p>");

  const round = `2026-01-02-${MARK}-r1`;
  await fs.mkdir(path.join(profileDir(a), "interviews"), { recursive: true });
  await fs.writeFile(
    path.join(profileDir(a), "interviews", `${round}.md`),
    `---\njob: ${jobId}\ncompany: ${MARK} Company\nround: 1\ndate: "2026-01-02"\nstatus: brief\n---\n## Brief\n${MARK} brief.\n`,
  );
  await fs.writeFile(path.join(profileDir(a), "interview-answers.md"), `---\nname: interview-answers\ndescription: x\nlanded:\n  - ${MARK} line\n---\n${MARK} answer.\n`);

  // A sees its own data (so a pass below means isolation, not a broken write).
  for (const route of [`/p/${a}/jobs`, `/api/p/${a}/answers?q=${MARK}`, `/p/${a}/variants`, `/p/${a}/stories`, `/api/p/${a}/templates`, `/p/${a}/interviews`, `/p/${a}/interviews/answers`, `/p/${a}/jobs/${jobId}`, `/p/${a}/designs`]) {
    const r = await call("GET", route);
    check(`A sees its own data at ${route.replace(a, "A")}`, r.text.includes(MARK), `status ${r.status}`);
  }
  const routes = [
    `/p/${b}/jobs`, `/p/${b}/jobs/filtered`, `/api/p/${b}/jobs?company=${MARK}%20Company`,
    `/api/p/${b}/jobs?source=greenhouse&ids=${JOB_ID}`, `/api/p/${b}/answers?q=${MARK}`, `/p/${b}/variants`,
    `/p/${b}/stories`, `/api/p/${b}/templates`, `/p/${b}/canonical`, `/p/${b}/jobs/${jobId}`, `/p/${b}/home`, `/p/${b}/interviews`, `/p/${b}/interviews/answers`, `/p/${b}/designs`,
  ];
  for (const route of routes) {
    const r = await call("GET", route);
    check(`B shows nothing of A at ${route.replace(b, "B")}`, !r.text.includes(MARK), `status ${r.status}`);
  }
  // The 404 page echoes the requested path, which holds MARK, so check the status and A's brief text instead.
  const other = await call("GET", `/p/${b}/interviews/${round}`);
  check("B can't open A's interview round", other.status === 404 && !other.text.includes(`${MARK} brief`), `status ${other.status}`);
  const preview = await call("GET", `/api/p/${b}/designs/${MARK}/preview`);
  check("B can't preview A's personal design", preview.status === 404, `status ${preview.status}`);
  const known = await call("GET", `/api/p/${b}/jobs?source=greenhouse&ids=${JOB_ID}`);
  check("B doesn't know A's job id", !known.text.includes(JOB_ID), known.text.slice(0, 120));
} finally {
  for (const p of [a, b]) if (p) await fs.rm(profileDir(p), { recursive: true, force: true });
}

// Scratch profiles must never be committed. A commit here usually means the dev server runs code older than lib/store/history.ts.
const touched = git("log", "--format=%h %s", `${head}..HEAD`, "--", ":(glob)zz-iso-*/**");
check("no data commit for the scratch profiles", touched === "", `${touched.replaceAll("\n", "; ")}. Restart the dev server, then remove these commits`);
const leftover = (await fs.readdir(path.dirname(profileDir("x")))).filter((n) => n.startsWith("zz-iso"));
check("no zz-iso folders left", leftover.length === 0, leftover.join(", "));
for (const [name, ok, detail] of results) console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => !r[1]).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
