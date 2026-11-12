import assert from "node:assert/strict";
import { classify } from "../lib/jobs/classify";
import { jobPatchSchema } from "../lib/jobs/schema";
import { formatComp, noReplyDays, stageDateLabel } from "../lib/jobs/format";
import { stageEnteredAt } from "../lib/store/jobs";
import { filterBoard, inWindow, parseBoardView, sortColumn, viewHref } from "../lib/jobs/board-view";

const cases: [string, Parameters<typeof classify>[0], ReturnType<typeof classify>][] = [
  ["180-220k USD posting, country_ok → filtered on comp",
    { compMax: 220000, currency: "USD", compSource: "posting", remoteVerdict: "country_ok" },
    { stage: "FILTERED_OUT", filterReason: "comp:220000", needsCheck: [], baseMaxUsd: 220000, compSource: "posting" }],
  ["220-260k USD posting, country_ok → shortlisted (range top counts)",
    { compMax: 260000, currency: "USD", compSource: "posting", remoteVerdict: "country_ok" },
    { stage: "SHORTLISTED", filterReason: null, needsCheck: [], baseMaxUsd: 260000, compSource: "posting" }],
  ["exactly 250k company_site, sponsorship → shortlisted",
    { compMax: 250000, currency: "USD", compSource: "company_site", remoteVerdict: "sponsorship_offered" },
    { stage: "SHORTLISTED", filterReason: null, needsCheck: [], baseMaxUsd: 250000, compSource: "company_site" }],
  ["unknown comp, country_ok → found, comp_unknown",
    { compMax: null, currency: null, compSource: "unknown", remoteVerdict: "country_ok" },
    { stage: "FOUND", filterReason: null, needsCheck: ["comp_unknown"], baseMaxUsd: null, compSource: "unknown" }],
  ["300k USD posting, us_only → filtered on remote",
    { compMax: 300000, currency: "USD", compSource: "posting", remoteVerdict: "us_only" },
    { stage: "FILTERED_OUT", filterReason: "remote:us_only", needsCheck: [], baseMaxUsd: 300000, compSource: "posting" }],
  ["onsite → filtered even with unknown comp",
    { compMax: null, currency: null, compSource: "unknown", remoteVerdict: "onsite" },
    { stage: "FILTERED_OUT", filterReason: "remote:onsite", needsCheck: [], baseMaxUsd: null, compSource: "unknown" }],
  ["340k CAD posting → 244800 USD → filtered",
    { compMax: 340000, currency: "CAD", compSource: "posting", remoteVerdict: "country_ok" },
    { stage: "FILTERED_OUT", filterReason: "comp:244800", needsCheck: [], baseMaxUsd: 244800, compSource: "posting" }],
  ["360k cad (lowercase) posting → 259200 USD → shortlisted",
    { compMax: 360000, currency: "cad", compSource: "posting", remoteVerdict: "country_ok" },
    { stage: "SHORTLISTED", filterReason: null, needsCheck: [], baseMaxUsd: 259200, compSource: "posting" }],
  ["unknown currency XYZ posting → treated as comp unknown",
    { compMax: 400000, currency: "XYZ", compSource: "posting", remoteVerdict: "country_ok" },
    { stage: "FOUND", filterReason: null, needsCheck: ["comp_unknown"], baseMaxUsd: null, compSource: "unknown" }],
  ["estimate below floor, unclear remote → found with both flags (estimates never filter)",
    { compMax: 200000, currency: "USD", compSource: "estimate", remoteVerdict: "unclear" },
    { stage: "FOUND", filterReason: null, needsCheck: ["comp_estimate", "remote_unclear"], baseMaxUsd: 200000, compSource: "estimate" }],
  ["only compMin posted, 200k → treated as the top → filtered",
    { compMin: 200000, compMax: null, currency: "USD", compSource: "posting", remoteVerdict: "country_ok" },
    { stage: "FILTERED_OUT", filterReason: "comp:200000", needsCheck: [], baseMaxUsd: 200000, compSource: "posting" }],
];

// Literal settings, independent of any profile file.
const HIGHER_FLOOR = { floorUsd: 250_000 };
const LOWER_FLOOR = { floorUsd: 200_000 };
const twoProfiles: Parameters<typeof classify>[0] = { compMin: 210000, compMax: 230000, currency: "USD", compSource: "posting", remoteVerdict: "country_ok" };

let failed = 0;
for (const [name, input, expected] of cases) {
  try {
    assert.deepEqual(classify(input, HIGHER_FLOOR), expected);
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n${(e as Error).message}`);
  }
}
try {
  assert.equal(classify(twoProfiles, LOWER_FLOOR).stage, "SHORTLISTED");
  assert.equal(classify(twoProfiles, HIGHER_FLOOR).stage, "FILTERED_OUT");
  console.log("ok   same 230k USD job: shortlisted at a 200k floor, filtered at 250k");
} catch (e) {
  failed++;
  console.log(`FAIL two-profile case\n${(e as Error).message}`);
}
// Pinned here rather than in package.json so a direct run gets the same local days; Node reads TZ on each Date use.
process.env.TZ = "America/Toronto";
const NOW = new Date(2026, 10, 11, 12);
const at = (iso: string) => ({ stageEnteredAt: new Date(iso) });
const extra: [string, () => void][] = [
  ["board: the time zone is pinned for these cases", () => assert.equal(new Date(2026, 10, 11).toISOString(), "2026-11-11T05:00:00.000Z")],
  ["board: since=7d includes the 6th day back from midnight", () => assert.equal(inWindow(at("2026-11-05T00:00:00-05:00"), parseBoardView({ since: "7d" }, NOW)), true)],
  ["board: since=7d excludes the minute before", () => assert.equal(inWindow(at("2026-11-04T23:59:00-05:00"), parseBoardView({ since: "7d" }, NOW)), false)],
  ["board: since=30d starts 29 days back", () => assert.equal(parseBoardView({ since: "30d" }, NOW).window?.start?.toISOString(), "2026-10-13T04:00:00.000Z")],
  ["board: from/to includes late on the last day", () => assert.equal(inWindow(at("2026-11-10T23:00:00-05:00"), parseBoardView({ from: "2026-11-01", to: "2026-11-10" }, NOW)), true)],
  ["board: from/to excludes just after the last day", () => assert.equal(inWindow(at("2026-11-11T00:01:00-05:00"), parseBoardView({ from: "2026-11-01", to: "2026-11-10" }, NOW)), false)],
  ["board: a lone from runs open-ended", () => assert.deepEqual(parseBoardView({ from: "2026-11-01" }, NOW).window, { start: new Date("2026-11-01T04:00:00.000Z"), end: null })],
  ["board: since=banana shows everything, flagged", () => assert.deepEqual([parseBoardView({ since: "banana" }, NOW).window, parseBoardView({ since: "banana" }, NOW).rejected], [null, true])],
  ["board: no filter is not flagged", () => assert.equal(parseBoardView({}, NOW).rejected, false)],
  ["board: an unreal date shows everything", () => assert.equal(parseBoardView({ from: "2026-02-30" }, NOW).window, null)],
  ["board: from after to shows everything", () => assert.equal(parseBoardView({ from: "2026-11-10", to: "2026-11-01" }, NOW).window, null)],
  ["board: empty from/to from the form shows everything", () => assert.equal(parseBoardView({ from: "", to: "" }, NOW).window, null)],
  ["board: since wins over from/to", () => assert.equal(parseBoardView({ since: "7d", from: "2026-01-01" }, NOW).from, null)],
  ["board: across the March DST change the start is local midnight", () =>
    assert.equal(parseBoardView({ since: "7d" }, new Date(2026, 2, 10, 12)).window?.start?.toISOString(), "2026-03-04T05:00:00.000Z")],
  ["board: unknown sort is best", () => assert.equal(parseBoardView({ sort: "bogus" }, NOW).sort, "best")],
  ["board: the first of repeated params wins", () => assert.equal(parseBoardView({ sort: ["newest", "oldest"] }, NOW).sort, "newest")],
  ["board: newest first", () => {
    const jobs = [{ id: "a", ...at("2026-11-02T12:00:00Z") }, { id: "b", ...at("2026-11-09T12:00:00Z") }, { id: "c", ...at("2026-11-05T12:00:00Z") }];
    assert.deepEqual(sortColumn(jobs, "newest").map((j) => j.id), ["b", "c", "a"]);
    assert.deepEqual(sortColumn(jobs, "oldest").map((j) => j.id), ["a", "c", "b"]);
    assert.deepEqual(sortColumn(jobs, "best").map((j) => j.id), ["a", "b", "c"]);
  }],
  ["board: ties keep the incoming order", () => {
    const jobs = [{ id: "x", ...at("2026-11-05T12:00:00Z") }, { id: "y", ...at("2026-11-05T12:00:00Z") }, { id: "z", ...at("2026-11-01T12:00:00Z") }];
    assert.deepEqual(sortColumn(jobs, "newest").map((j) => j.id), ["x", "y", "z"]);
  }],
  ["board: a sort link keeps the filter and drops the default", () =>
    assert.equal(viewHref("/jobs", parseBoardView({ sort: "newest", since: "7d" }, NOW), { sort: "best" }), "/jobs?since=7d")],
  ["board: a preset link drops a custom range", () =>
    assert.equal(viewHref("/jobs", parseBoardView({ sort: "oldest", from: "2026-11-01", to: "2026-11-05" }, NOW), { since: "7d" }), "/jobs?sort=oldest&since=7d")],
  ["board: All drops every filter", () =>
    assert.equal(viewHref("/jobs", parseBoardView({ since: "30d" }, NOW), { since: null }), "/jobs")],
  ["board: N of M come from the same list", () => {
    const jobs = ["2026-11-10", "2026-11-08", "2026-11-05", "2026-11-01", "2026-10-20"].map((d) => at(`${d}T12:00:00-05:00`));
    const shown = filterBoard(jobs, parseBoardView({ since: "7d" }, NOW));
    assert.deepEqual([shown.length, jobs.length], [3, 5]);
  }],
  ["closing without a reason is refused", () => assert.equal(jobPatchSchema.safeParse({ stage: "CLOSED" }).success, false)],
  ["closing with a reason is accepted", () => assert.equal(jobPatchSchema.safeParse({ stage: "CLOSED", closedReason: "rejected" }).success, true)],
  ["a reason without CLOSED is refused", () => assert.equal(jobPatchSchema.safeParse({ stage: "APPLIED", closedReason: "passed" }).success, false)],
  ["low fit is a reason", () => assert.equal(jobPatchSchema.safeParse({ stage: "CLOSED", closedReason: "low_fit" }).success, true)],
  ["no response is a reason", () => assert.equal(jobPatchSchema.safeParse({ stage: "CLOSED", closedReason: "no_response" }).success, true)],
  ["an unknown reason is refused", () => assert.equal(jobPatchSchema.safeParse({ stage: "CLOSED", closedReason: "ghosted" }).success, false)],
  ["stage date: the latest entry for the current stage wins", () => {
    const r = stageEnteredAt({ stage: "APPLIED", firstSeenAt: "2026-10-01T00:00:00.000Z", stageHistory: [
      { stage: "APPLIED", at: "2026-11-01T10:00:00.000Z", by: "user" },
      { stage: "CLOSED", at: "2026-11-03T10:00:00.000Z", by: "user" },
      { stage: "APPLIED", at: "2026-11-05T10:00:00.000Z", by: "user" },
    ] });
    assert.deepEqual(r, { at: new Date("2026-11-05T10:00:00.000Z"), known: true });
  }],
  ["stage date: empty history falls back to first seen, flagged", () =>
    assert.deepEqual(stageEnteredAt({ stage: "FOUND", firstSeenAt: "2026-10-01T00:00:00.000Z", stageHistory: [] }), { at: new Date("2026-10-01T00:00:00.000Z"), known: false })],
  ["stage date: history for other stages only falls back", () =>
    assert.equal(stageEnteredAt({ stage: "OFFER", firstSeenAt: "2026-10-01T00:00:00.000Z", stageHistory: [{ stage: "APPLIED", at: "2026-11-01T10:00:00.000Z", by: "user" }] }).known, false)],
  ["card date: same year shows month and day", () =>
    assert.equal(stageDateLabel("APPLIED", new Date(2026, 10, 10, 12), true, new Date(2026, 10, 11, 9)), "Applied Nov 10")],
  ["card date: another year adds the year", () =>
    assert.equal(stageDateLabel("SHORTLISTED", new Date(2025, 11, 30, 12), true, new Date(2026, 10, 11, 9)), "Shortlisted Dec 30, 2025")],
  ["card date: a first-seen fallback says Seen", () =>
    assert.equal(stageDateLabel("CLOSED", new Date(2026, 10, 2, 12), false, new Date(2026, 10, 11, 9)), "Seen Nov 2")],
  ["no reply: 29 days in Applied is not tagged", () =>
    assert.equal(noReplyDays({ stage: "APPLIED", stageDateKnown: true, stageEnteredAt: new Date("2026-10-13T12:00:00Z") }, new Date("2026-11-11T12:00:00Z")), null)],
  ["no reply: 30 days in Applied is not tagged", () =>
    assert.equal(noReplyDays({ stage: "APPLIED", stageDateKnown: true, stageEnteredAt: new Date("2026-10-12T12:00:00Z") }, new Date("2026-11-11T12:00:00Z")), null)],
  ["no reply: 31 days in Applied is tagged 31", () =>
    assert.equal(noReplyDays({ stage: "APPLIED", stageDateKnown: true, stageEnteredAt: new Date("2026-10-11T12:00:00Z") }, new Date("2026-11-11T12:00:00Z")), 31)],
  ["no reply: an Applied job with no recorded date (first-seen 60 days ago) is not tagged", () =>
    assert.equal(noReplyDays({ stage: "APPLIED", stageDateKnown: false, stageEnteredAt: new Date("2026-09-12T12:00:00Z") }, new Date("2026-11-11T12:00:00Z")), null)],
  ["no reply: 90 days in Interviewing is not tagged", () =>
    assert.equal(noReplyDays({ stage: "INTERVIEWING", stageDateKnown: true, stageEnteredAt: new Date("2026-08-13T12:00:00Z") }, new Date("2026-11-11T12:00:00Z")), null)],
  ["USD pay names its currency", () => assert.equal(formatComp({ compMin: 240000, compMax: 320000, currency: "USD", compSource: "posting" }), "$240k–$320k USD, posted")],
  ["CAD pay shows a USD conversion", () => assert.match(formatComp({ compMin: 255500, compMax: 365000, currency: "CAD", compSource: "company_site" }), /^\$256k–\$365k CAD \(≈ \$\d+k–\$\d+k USD\)/)],
];
for (const [name, run] of extra) {
  try {
    run();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n${(e as Error).message}`);
  }
}
const total = cases.length + 1 + extra.length;
console.log(`${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
