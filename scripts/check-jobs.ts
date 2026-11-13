import assert from "node:assert/strict";
import { classify } from "../lib/jobs/classify";
import { jobPatchSchema } from "../lib/jobs/schema";
import { formatComp, noReplyDays, stageDateLabel } from "../lib/jobs/format";
import { stageEnteredAt } from "../lib/store/jobs";
import { filterBoard, inWindow, parseBoardView, sortColumn, viewHref } from "../lib/jobs/board-view";
import { ageLine, bestMatchOrder, freshness, FRESHNESS_RANK, mergePosted, postingAgeDays } from "../lib/jobs/freshness";
import { jobInputSchema } from "../lib/jobs/schema";
import { boardDate } from "../lib/jobs/posted-date";

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
const CLOCK = new Date("2026-11-11T12:00:00.000Z");
const PAID = { compMax: 300000, currency: "USD", compSource: "posting", remoteVerdict: "country_ok" } as const;
const pick = (c: ReturnType<typeof classify>) => ({ stage: c.stage, needsCheck: c.needsCheck });
const INPUT = { source: "linkedin", sourceJobId: "1", url: "https://x.test/1", company: "Acme", title: "VP Product", compSource: "unknown", remoteVerdict: "unclear" };
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
  // Posting age. CLOCK is a literal instant; every expected value below is written out by hand.
  ["age: 30 days old, fit 60 → held in Found as stale", () =>
    assert.deepEqual(pick(classify({ ...PAID, fitScore: 60, postedAt: "2026-10-12T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK)), { stage: "FOUND", needsCheck: ["stale"] })],
  ["age: 30 days old, fit 80 → shortlisted (strong fit)", () =>
    assert.deepEqual(pick(classify({ ...PAID, fitScore: 80, postedAt: "2026-10-12T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK)), { stage: "SHORTLISTED", needsCheck: [] })],
  ["age: 3 days old, fit 60 → shortlisted", () =>
    assert.deepEqual(pick(classify({ ...PAID, fitScore: 60, postedAt: "2026-11-08T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK)), { stage: "SHORTLISTED", needsCheck: [] })],
  ["age: no date, fit 60 → shortlisted (undated is not penalized)", () =>
    assert.deepEqual(pick(classify({ ...PAID, fitScore: 60 }, HIGHER_FLOOR, CLOCK)), { stage: "SHORTLISTED", needsCheck: [] })],
  ["age: 30 days old with no fit score → stale", () =>
    assert.deepEqual(pick(classify({ ...PAID, postedAt: "2026-10-12T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK)), { stage: "FOUND", needsCheck: ["stale"] })],
  ["age: exactly 21 days is stale, 20 is not", () => {
    assert.equal(classify({ ...PAID, fitScore: 60, postedAt: "2026-10-21T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK).stage, "FOUND");
    assert.equal(classify({ ...PAID, fitScore: 60, postedAt: "2026-10-22T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK).stage, "SHORTLISTED");
  }],
  ["age: the person's own strong-fit setting is used", () =>
    assert.equal(classify({ ...PAID, fitScore: 60, postedAt: "2026-10-12T12:00:00.000Z" }, { floorUsd: 250_000, strongMatchFit: 55 }, CLOCK).stage, "SHORTLISTED")],
  ["age: stale with unknown pay keeps only the pay check", () =>
    assert.deepEqual(pick(classify({ compMax: null, currency: null, compSource: "unknown", remoteVerdict: "country_ok", fitScore: 60, postedAt: "2026-10-12T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK)), { stage: "FOUND", needsCheck: ["comp_unknown"] })],
  ["age: a stale US-only job is still filtered out", () =>
    assert.equal(classify({ ...PAID, remoteVerdict: "us_only", fitScore: 60, postedAt: "2026-10-12T12:00:00.000Z" }, HIGHER_FLOOR, CLOCK).stage, "FILTERED_OUT")],
  ["age: days and labels across the scale", () =>
    assert.deepEqual(
      ["2026-11-11T11:00:00.000Z", "2026-11-10T12:00:00.000Z", "2026-11-09T12:00:00.000Z", "2026-11-04T12:00:00.000Z", "2026-11-03T12:00:00.000Z", "2026-10-28T12:00:00.000Z", "2026-10-27T12:00:00.000Z", "2026-10-22T12:00:00.000Z", "2026-10-21T12:00:00.000Z"]
        .map((d) => `${postingAgeDays(d, CLOCK)}:${freshness(d, CLOCK)}`),
      ["0:today", "1:today", "2:week", "7:week", "8:edge", "14:edge", "15:old", "20:old", "21:stale"])],
  ["age: no date, a bad date and a future date", () =>
    assert.deepEqual([freshness(null, CLOCK), freshness("not a date", CLOCK), postingAgeDays("2026-11-12T12:00:00.000Z", CLOCK)], ["unknown", "unknown", 0])],
  ["age line: yesterday, this week, edge, stale, reposted, unknown", () =>
    assert.deepEqual(
      [
        ageLine({ postedAt: new Date("2026-11-10T12:00:00.000Z") }, CLOCK),
        ageLine({ postedAt: "2026-11-06T12:00:00.000Z" }, CLOCK),
        ageLine({ postedAt: "2026-11-02T12:00:00.000Z" }, CLOCK),
        ageLine({ postedAt: "2026-10-12T12:00:00.000Z" }, CLOCK),
        ageLine({ postedAt: "2026-11-06T12:00:00.000Z", reposted: true }, CLOCK),
        ageLine({ postedAt: null }, CLOCK),
        ageLine({ postedAt: CLOCK }, CLOCK),
      ],
      ["1 day", "5 days", "Edge · 9 days", "Stale · 30 days", "5 days · reposted", "Age unknown", "Today"])],
  ["age order: today, this week, then edge and undated together, then old, then stale", () =>
    assert.deepEqual((["today", "week", "edge", "unknown", "old", "stale"] as const).map((f) => FRESHNESS_RANK[f]), [0, 1, 2, 2, 3, 4])],
  ["age order: with pay confirmed on both, the fresher job leads even at a lower fit; unconfirmed pay still goes last", () => {
    const jobs = [
      { id: "old-high-fit", compSource: "posting" as const, postedAt: "2026-10-12T12:00:00.000Z", fitScore: 90 },
      { id: "unconfirmed-today", compSource: "unknown" as const, postedAt: "2026-11-11T08:00:00.000Z", fitScore: 95 },
      { id: "fresh-low-fit", compSource: "posting" as const, postedAt: "2026-11-09T12:00:00.000Z", fitScore: 60 },
      { id: "undated", compSource: "company_site" as const, postedAt: null, fitScore: 70 },
      { id: "fresh-higher-fit", compSource: "posting" as const, postedAt: "2026-11-08T12:00:00.000Z", fitScore: 75 },
    ];
    assert.deepEqual(jobs.sort(bestMatchOrder(CLOCK)).map((j) => j.id), ["fresh-higher-fit", "fresh-low-fit", "undated", "old-high-fit", "unconfirmed-today"]);
  }],
  ["posted date: a later listing date leaves a board date alone", () =>
    assert.deepEqual(
      mergePosted({ postedAt: "2026-10-05T00:00:00.000Z", postedAtSource: "board" }, { postedAt: "2026-11-12T00:00:00.000Z", postedAtSource: "listing", reposted: true }),
      { postedAt: "2026-10-05T00:00:00.000Z", postedAtSource: "board", reposted: true })],
  ["posted date: a board date replaces a listing date, even a later one", () =>
    assert.deepEqual(
      mergePosted({ postedAt: "2026-10-05T00:00:00.000Z", postedAtSource: "listing" }, { postedAt: "2026-10-20T00:00:00.000Z", postedAtSource: "board" }),
      { postedAt: "2026-10-20T00:00:00.000Z", postedAtSource: "board", reposted: false })],
  ["posted date: a re-post never moves a listing date forward", () =>
    assert.deepEqual(
      mergePosted({ postedAt: "2026-10-05T00:00:00.000Z", postedAtSource: "listing" }, { postedAt: "2026-11-12T00:00:00.000Z", postedAtSource: "listing" }),
      { postedAt: "2026-10-05T00:00:00.000Z", postedAtSource: "listing", reposted: false })],
  ["posted date: an earlier listing date replaces a later one", () =>
    assert.equal(mergePosted({ postedAt: "2026-11-12T00:00:00.000Z", postedAtSource: "listing" }, { postedAt: "2026-11-01T00:00:00.000Z", postedAtSource: "listing" }).postedAt, "2026-11-01T00:00:00.000Z")],
  ["posted date: a save with no date, or an explicit null, keeps the stored one and its reposted mark", () => {
    const stored = { postedAt: "2026-10-05T00:00:00.000Z", postedAtSource: "board" as const, reposted: true };
    assert.deepEqual(mergePosted(stored, {}), stored);
    assert.deepEqual(mergePosted(stored, { postedAt: null, postedAtSource: null, reposted: null }), stored);
  }],
  ["posted date: nothing stored and nothing sent stays empty", () =>
    assert.deepEqual(mergePosted({}, {}), { postedAt: null, postedAtSource: null, reposted: false })],
  ["posted date: an offset time is stored in UTC", () =>
    assert.equal(mergePosted({}, { postedAt: "2026-11-12T09:00:00-05:00", postedAtSource: "listing" }).postedAt, "2026-11-12T14:00:00.000Z")],
  ["board date: ISO text, an offset, Lever's milliseconds, and junk", () =>
    assert.deepEqual(
      [boardDate("2026-11-12T22:08:26.431+00:00"), boardDate("2026-10-05T10:00:00-04:00"), boardDate(1760000000000), boardDate(null), boardDate("junk"), boardDate({})],
      ["2026-11-12T22:08:26.431Z", "2026-10-05T14:00:00.000Z", "2025-10-09T08:53:20.000Z", null, null, null])],
  ["job input: the three posting fields are accepted, and none is still fine", () => {
    assert.equal(jobInputSchema.safeParse({ ...INPUT, postedAt: "2026-11-12T14:00:00.000Z", postedAtSource: "board", reposted: true }).success, true);
    assert.equal(jobInputSchema.safeParse(INPUT).success, true);
  }],
  ["job input: a date without its source, a bare day, and a far-future date are refused", () => {
    assert.equal(jobInputSchema.safeParse({ ...INPUT, postedAt: "2026-11-12T14:00:00.000Z" }).success, false);
    assert.equal(jobInputSchema.safeParse({ ...INPUT, postedAt: "2026-11-12", postedAtSource: "listing" }).success, false);
    assert.equal(jobInputSchema.safeParse({ ...INPUT, postedAt: "2999-01-01T00:00:00.000Z", postedAtSource: "listing" }).success, false);
  }],
  ["closing without a reason is refused", () => assert.equal(jobPatchSchema.safeParse({ stage: "CLOSED" }).success, false)],
  ["closing with a reason is accepted", () => assert.equal(jobPatchSchema.safeParse({ stage: "CLOSED", closedReason: "rejected" }).success, true)],
  ["foundVia is optional, must be a web link, and is kept by the input schema", () => {
    const post = "https://www.linkedin.com/posts/someone_hiring-activity-7260000000000000000";
    assert.equal(jobInputSchema.parse({ ...INPUT, foundVia: post }).foundVia, post);
    assert.equal("foundVia" in jobInputSchema.parse(INPUT), false);
    assert.equal(jobInputSchema.safeParse({ ...INPUT, foundVia: "a post on LinkedIn" }).success, false);
    assert.equal(jobInputSchema.safeParse({ ...INPUT, foundVia: "javascript:alert(1)" }).success, false);
  }],
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
