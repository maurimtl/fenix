// pnpm check:liveness — the closed-posting checker against stubbed boards: one open and one closed posting per board type.
import { livenessChecker } from "../lib/jobs/liveness";

const routes: Record<string, { status: number; body?: unknown }> = {
  "https://api.ashbyhq.com/posting-api/job-board/acme": { status: 200, body: { jobs: [{ id: "a-open" }] } },
  "https://boards-api.greenhouse.io/v1/boards/acme/jobs/111": { status: 200, body: { id: 111 } },
  "https://boards-api.greenhouse.io/v1/boards/acme/jobs/222": { status: 404 },
  "https://boards-api.greenhouse.io/v1/boards/acme": { status: 200, body: { name: "Acme" } },
  "https://api.lever.co/v0/postings/acme/l-open": { status: 200, body: { id: "l-open" } },
  "https://api.lever.co/v0/postings/acme/l-closed": { status: 404 },
  "https://api.lever.co/v0/postings/acme?mode=json&limit=1": { status: 200, body: [{ id: "l-open" }] },
};
const seen: string[] = [];
const check = livenessChecker(async (url) => {
  seen.push(url);
  const r = routes[url] ?? { status: 404 };
  return { status: r.status, json: async () => r.body };
});

const cases: [string, string, string, string][] = [
  ["ashby", "a-open", "https://jobs.ashbyhq.com/acme/a-open", "open"],
  ["ashby", "a-closed", "https://jobs.ashbyhq.com/acme/a-closed", "closed"],
  ["greenhouse", "111", "https://job-boards.greenhouse.io/acme/jobs/111", "open"],
  ["greenhouse", "222", "https://acme.com/careers?gh_jid=222", "closed"],
  ["lever", "l-open", "https://jobs.lever.co/acme/l-open", "open"],
  ["lever", "l-closed", "https://jobs.lever.co/acme/l-closed", "closed"],
  // Unknown board: a 404 must not count as closed.
  ["greenhouse", "333", "https://other.com/jobs?gh_jid=333", "unknown"],
];
let failed = 0;
for (const [source, id, url, want] of cases) {
  const company = url.includes("other.com") ? "Nobody Inc" : "Acme";
  const got = (await check({ source, sourceJobId: id, url, company })).status;
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${source} ${id}: ${got}${ok ? "" : ` (want ${want})`}`);
}
const ashbyFetches = seen.filter((u) => u.includes("ashbyhq")).length;
console.log(`${ashbyFetches === 1 ? "ok  " : "FAIL"} Ashby board fetched once for two postings (${ashbyFetches})`);
if (ashbyFetches !== 1) failed++;
process.exit(failed ? 1 : 0);
