// Captures what the running app shows (API JSON, page text, PDFs) so a migration can be compared before/after.
//   tsx scripts/snapshot-app.ts capture <label> [--base <url>] [--profile <p> --live]   writes .scratch/migration/<label>/
//     --live rewrites ids.json from the person's files first (the list frozen at the database migration goes stale)
//   tsx scripts/snapshot-app.ts compare <a> <b> [--only api,pages,pdfs]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const OUT = path.resolve(".scratch/migration");
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const BASE = flag("--base") ?? "http://localhost:3007";
// Paths carry {p} where the profile prefix goes once pages move under /p/<slug> (task 7).
const PROFILE = flag("--profile");
const PREFIX = flag("--prefix") ?? (PROFILE ? `/p/${PROFILE}` : "");
const API_PREFIX = flag("--api-prefix") ?? (PROFILE ? `/api/p/${PROFILE}` : "/api");

type Ids = { jobs: string[]; companies: string[]; variants: string[] };

async function readIds(): Promise<Ids> {
  const file = path.join(OUT, "ids.json");
  if (args.includes("--live")) {
    if (!PROFILE) throw new Error("--live needs --profile");
    const { readAllCvs } = await import("../lib/store/cvs");
    const { readAllJobs } = await import("../lib/store/jobs");
    const [cvs, jobs] = await Promise.all([readAllCvs(PROFILE), readAllJobs(PROFILE)]);
    const ids: Ids = {
      jobs: jobs.map((j) => j.data.id).sort(),
      companies: [...new Set(jobs.map((j) => j.data.company))].sort(),
      variants: cvs.map((c) => c.data.id).sort(),
    };
    await fs.mkdir(OUT, { recursive: true });
    await fs.writeFile(file, JSON.stringify(ids, null, 2));
    return ids;
  }
  return JSON.parse(await fs.readFile(file, "utf8"));
}


async function get(url: string): Promise<Response> {
  const res = await fetch(BASE + url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res;
}

function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const VOLATILE = new Set(["updatedAt"]);
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !VOLATILE.has(k))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, stable(x)]),
    );
  }
  return v;
}

async function capture(label: string) {
  const dir = path.join(OUT, label);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.join(dir, "pdf"), { recursive: true });
  // ids.json was written from Postgres when the "before" snapshot was taken; every later capture reuses it.
  const ids = await readIds();

  const api: Record<string, unknown> = {};
  api.canonical = await (await get(`${API_PREFIX}/canonical`)).json();
  api.answers = await (await get(`${API_PREFIX}/answers?q=`)).json();
  for (const c of ids.companies) api[`jobs?company=${c}`] = await (await get(`${API_PREFIX}/jobs?company=${encodeURIComponent(c)}`)).json();
  for (const v of ids.variants) api[`variants/${v}`] = await (await get(`${API_PREFIX}/variants/${v}`)).json();
  await fs.writeFile(path.join(dir, "api.json"), JSON.stringify(stable(api), null, 2));

  const pages: Record<string, string> = {};
  const pagePaths = [
    "/jobs",
    "/jobs/filtered",
    "/canonical",
    "/variants",
    ...ids.jobs.slice(0, 5).map((j) => `/jobs/${j}`),
    ...ids.variants.slice(0, 5).map((v) => `/cv/${v}`),
  ];
  for (const p of pagePaths) pages[p] = pageText(await (await get(PREFIX + p)).text());
  await fs.writeFile(path.join(dir, "pages.json"), JSON.stringify(pages, null, 2));

  const pdfs: Record<string, { pages: number; text: string; page1: string }> = {};
  for (const v of ids.variants) {
    const buf = Buffer.from(await (await get(`${API_PREFIX}/cv/${v}/pdf`)).arrayBuffer());
    const file = path.join(dir, "pdf", `${v}.pdf`);
    await fs.writeFile(file, buf);
    const count = Number((buf.toString("latin1").match(/\/Count (\d+)/) ?? [])[1] ?? 0);
    const text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
    execFileSync("pdftoppm", ["-r", "100", "-f", "1", "-l", "1", "-png", "-singlefile", file, path.join(dir, "pdf", v)]);
    const page1 = createHash("sha256").update(await fs.readFile(path.join(dir, "pdf", `${v}.png`))).digest("hex");
    pdfs[v] = { pages: count, text, page1 };
  }
  await fs.writeFile(path.join(dir, "pdfs.json"), JSON.stringify(pdfs, null, 2));

  const answers = (api.answers as { answers: unknown[] }).answers.length;
  console.log(`${label}: ${ids.jobs.length} jobs, ${ids.companies.length} companies, ${ids.variants.length} CVs, ${pagePaths.length} pages, ${Object.keys(pdfs).length} PDFs, ${answers} answers in search`);
}

async function compare(a: string, b: string) {
  const only = (flag("--only") ?? "api,pages,pdfs").split(",");
  let diffs = 0;
  const load = async (label: string, f: string) => JSON.parse(await fs.readFile(path.join(OUT, label, f), "utf8"));
  for (const kind of only) {
    const A = await load(a, `${kind}.json`);
    const B = await load(b, `${kind}.json`);
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = JSON.stringify(A[k]);
      const y = JSON.stringify(B[k]);
      if (x !== y) {
        diffs++;
        if (diffs <= 20) console.log(`DIFF ${kind} ${k}\n  ${a}: ${x?.slice(0, 300)}\n  ${b}: ${y?.slice(0, 300)}`);
      }
    }
  }
  console.log(diffs === 0 ? `no differences (${only.join(", ")})` : `${diffs} differences`);
  process.exit(diffs === 0 ? 0 : 1);
}

if (args[0] === "capture") await capture(args[1]);
else if (args[0] === "compare") await compare(args[1], args[2]);
else {
  console.error("usage: capture <label> | compare <a> <b>");
  process.exit(2);
}
