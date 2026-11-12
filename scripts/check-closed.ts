// pnpm check:closed <profile> [--write]
// Asks each company board (Ashby, Greenhouse, Lever) whether the person's open jobs are still posted.
// Prints the closed ones; --write sets postingClosedAt and postingClosedEvidence on them. Stages never change.
import { patchJob } from "../lib/jobs/repo";
import { isBoardSource, livenessChecker } from "../lib/jobs/liveness";
import { readAllJobs } from "../lib/store/jobs";
import { assertSlug } from "../lib/store/paths";

const MAX_REQUESTS = 60;
const OPEN_STAGES = new Set(["FOUND", "SHORTLISTED", "CV_READY"]);

const args = process.argv.slice(2);
const profile = assertSlug(args.find((a) => !a.startsWith("--")) ?? "");
const write = args.includes("--write");

const jobs = (await readAllJobs(profile))
  .map((j) => j.data)
  .filter((d) => isBoardSource(d.source) && OPEN_STAGES.has(d.stage) && !d.postingClosedAt)
  .sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt));

const check = livenessChecker();
let requests = 0;
let checked = 0;
const closed: { id: string; label: string; evidence: string }[] = [];
const unknown: string[] = [];
for (const d of jobs) {
  // Each check costs at most 2 requests per slug tried; stop before the budget can be exceeded.
  if (requests + 4 > MAX_REQUESTS) break;
  const r = await check({ source: d.source, sourceJobId: d.sourceJobId, url: d.url, company: d.company });
  requests += r.requests;
  checked++;
  const label = `${d.company} - ${d.title} (${d.source})`;
  if (r.status === "closed") closed.push({ id: d.id, label, evidence: r.evidence });
  if (r.status === "unknown") unknown.push(label);
}

for (const c of closed) console.log(`closed   ${c.label}: ${c.evidence}`);
for (const u of unknown) console.log(`unknown  ${u}`);
console.log(`${checked}/${jobs.length} board jobs checked with ${requests} requests: ${closed.length} closed, ${unknown.length} unknown`);

if (write) {
  const at = new Date().toISOString();
  for (const c of closed) await patchJob(profile, c.id, { postingClosedAt: at, postingClosedEvidence: c.evidence });
  console.log(`flagged ${closed.length} job(s)`);
} else if (closed.length) {
  console.log("dry run: nothing written (add --write to flag them)");
}
