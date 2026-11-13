// pnpm backfill:posted <profile> [--write]
// Asks each company board (Ashby, Greenhouse, Lever) when the person's open and applied jobs were posted, open ones first.
// Prints the dates it found; --write stores them as postedAt with postedAtSource "board". Stages never change.
import { setPostedFromBoard } from "../lib/jobs/repo";
import { isBoardSource } from "../lib/jobs/liveness";
import { postedDateLookup } from "../lib/jobs/posted-date";
import { readAllJobs } from "../lib/store/jobs";
import { assertSlug } from "../lib/store/paths";

const MAX_REQUESTS = 60;
const STAGES = ["FOUND", "SHORTLISTED", "CV_READY", "APPLIED"];

const args = process.argv.slice(2);
const profile = assertSlug(args.find((a) => !a.startsWith("--")) ?? "");
const write = args.includes("--write");

const jobs = (await readAllJobs(profile))
  .map((j) => j.data)
  .filter((d) => isBoardSource(d.source) && STAGES.includes(d.stage) && d.postedAtSource !== "board")
  .sort((a, b) => Number(a.stage === "APPLIED") - Number(b.stage === "APPLIED") || a.lastSeenAt.localeCompare(b.lastSeenAt));

const lookup = postedDateLookup();
let requests = 0;
let checked = 0;
const found: { id: string; label: string; postedAt: string }[] = [];
const missing: string[] = [];
for (const d of jobs) {
  // Each lookup costs at most 1 request per slug tried (2 slugs); stop before the budget can be exceeded.
  if (requests + 2 > MAX_REQUESTS) break;
  const r = await lookup({ source: d.source, sourceJobId: d.sourceJobId, url: d.url, company: d.company });
  requests += r.requests;
  checked++;
  const label = `${d.company} - ${d.title} (${d.source})`;
  if (r.postedAt) found.push({ id: d.id, label, postedAt: r.postedAt });
  else missing.push(label);
}

for (const f of found) console.log(`posted ${f.postedAt.slice(0, 10)}  ${f.label}`);
for (const m of missing) console.log(`no date            ${m}`);
console.log(`${checked}/${jobs.length} open and applied board jobs without a board date checked with ${requests} requests: ${found.length} dated, ${missing.length} without a date`);

if (write) {
  for (const f of found) await setPostedFromBoard(profile, f.id, f.postedAt);
  console.log(`set the posting date on ${found.length} job(s)`);
} else if (found.length) {
  console.log("dry run: nothing written (add --write to store them)");
}
