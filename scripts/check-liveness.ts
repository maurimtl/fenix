// pnpm check:liveness — the closed-posting checker and the posting-date lookup against stubbed boards.
import { livenessChecker } from "../lib/jobs/liveness";
import { postedDateLookup } from "../lib/jobs/posted-date";

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
// The posting-date lookup against its own stubbed boards: one dated posting per board type, one missing, one unknown board.
const dated: Record<string, { status: number; body?: unknown }> = {
  "https://api.ashbyhq.com/posting-api/job-board/acme": { status: 200, body: { jobs: [{ id: "a-1", publishedAt: "2026-11-12T22:08:26.000+00:00" }, { id: "a-2" }] } },
  "https://boards-api.greenhouse.io/v1/boards/acme/jobs/111": { status: 200, body: { id: 111, first_published: "2026-10-05T10:00:00-04:00", updated_at: "2026-11-12T10:00:00-05:00" } },
  "https://api.lever.co/v0/postings/acme/l-1": { status: 200, body: { id: "l-1", createdAt: 1760000000000 } },
};
const dateFetches: string[] = [];
const lookup = postedDateLookup(async (url) => {
  dateFetches.push(url);
  const r = dated[url] ?? { status: 404 };
  return { status: r.status, json: async () => r.body };
});
const dateCases: [string, string, string, string | null][] = [
  ["ashby", "a-1", "https://jobs.ashbyhq.com/acme/a-1", "2026-11-12T22:08:26.000Z"],
  ["ashby", "a-2", "https://jobs.ashbyhq.com/acme/a-2", null],
  ["greenhouse", "111", "https://job-boards.greenhouse.io/acme/jobs/111", "2026-10-05T14:00:00.000Z"],
  ["lever", "l-1", "https://jobs.lever.co/acme/l-1", "2025-10-09T08:53:20.000Z"],
  ["greenhouse", "333", "https://other.com/jobs?gh_jid=333", null],
];
for (const [source, id, url, want] of dateCases) {
  const company = url.includes("other.com") ? "Nobody Inc" : "Acme";
  const got = (await lookup({ source, sourceJobId: id, url, company })).postedAt;
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} posted date ${source} ${id}: ${got}${ok ? "" : ` (want ${want})`}`);
}
const ashbyDateFetches = dateFetches.filter((u) => u.includes("ashbyhq")).length;
console.log(`${ashbyDateFetches === 1 ? "ok  " : "FAIL"} Ashby board fetched once for two date lookups (${ashbyDateFetches})`);
if (ashbyDateFetches !== 1) failed++;
process.exit(failed ? 1 : 0);
