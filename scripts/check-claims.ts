// pnpm check:claims [profile] [--baseline]
// Lists numbers in CV versions that the career record and stories don't back. Exit 1 when any blocks check:data.
// --baseline records today's blocking hits in data/<person>/claims-baseline.yaml so they stop blocking while the
// person decides; they stay listed here until fixed.
import { UNBACKED, validateProfile } from "../lib/store/validate";
import { listProfileSlugs } from "../lib/store/profiles";
import { readClaimsBaseline, writeClaimsBaseline, claimKey } from "../lib/store/claims";

const args = process.argv.slice(2);
const writeBaseline = args.includes("--baseline");
const only = args.find((a) => !a.startsWith("--"));
const profiles = only ? [only] : await listProfileSlugs();
let blocking = 0;
let listed = 0;
for (const p of profiles) {
  const hits = (await validateProfile(p)).filter((i) => i.problem.includes(UNBACKED));
  const baseline = await readClaimsBaseline(p);
  for (const h of hits) {
    const state = !h.warning ? "BLOCKS" : !h.cvId ? "live" : baseline.has(claimKey(h.cvId, h.token!)) ? "waiting" : "sent";
    console.log(`${state.padEnd(7)} ${h.file}: ${h.problem}`);
  }
  listed += hits.length;
  const newHits = hits.filter((h) => !h.warning);
  // Only CV hits can be baselined; a LinkedIn draft's number is reworded, never waved through.
  const cvHits = newHits.filter((h) => h.cvId);
  if (writeBaseline && cvHits.length) {
    await writeClaimsBaseline(p, [
      ...[...baseline].map((k) => ({ cv: k.slice(0, k.indexOf(" ")), token: k.slice(k.indexOf(" ") + 1) })),
      ...cvHits.map((h) => ({ cv: h.cvId!, token: h.token! })),
    ]);
    console.log(`${p}: ${cvHits.length} hit(s) added to the baseline`);
    blocking += newHits.length - cvHits.length;
  } else blocking += newHits.length;
}
console.log(`${listed} unbacked number(s), ${blocking} blocking, in ${profiles.length} profile(s)`);
process.exit(blocking ? 1 : 0);
