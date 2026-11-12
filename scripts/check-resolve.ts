// Pure-function checks for the resume resolver. Run: pnpm check:resolve
import { resolve } from "../lib/resume/resolve";
import type { CanonicalData } from "../lib/resume/types";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("  ✗ " + msg);
    failures++;
  } else {
    console.log("  ✓ " + msg);
  }
}

const base: CanonicalData = {
  profile: {
    fullName: "Test Person",
    headline: "Canonical Headline",
    email: "t@example.com",
    phone: null,
    location: null,
    summary: "Canonical summary",
    about: null,
    linkedin: null,
  },
  positions: [
    {
      id: "pA",
      companyName: "A Co",
      title: "Co-Founder",
      location: null,
      startDate: new Date("2020-01-01"),
      endDate: null,
      bullets: [{ id: "a1", text: "A1", altText: null, altCurrency: null, sortOrder: 0 }],
    },
    {
      id: "pB",
      companyName: "B Co",
      title: "Engineer",
      location: "NYC",
      startDate: new Date("2018-01-01"),
      endDate: new Date("2019-01-01"),
      bullets: [
        { id: "b1", text: "B1 USD", altText: "B1 CAD", altCurrency: "CAD", sortOrder: 0 },
        { id: "b2", text: "B2", altText: null, altCurrency: null, sortOrder: 1 },
      ],
    },
  ],
  education: [],
  skills: [
    { id: "s1", name: "S1" },
    { id: "s2", name: "S2" },
  ],
  courses: [],
};

// canonical with a NEWLY-ADDED bullet b3 on pB — models a later canonical edit.
const withNewBullet: CanonicalData = structuredClone(base);
withNewBullet.positions[1].bullets.push({
  id: "b3",
  text: "B3 new",
  altText: null,
  altCurrency: null,
  sortOrder: 2,
});

console.log("empty override:");
const empty = resolve(base, {});
assert(empty.positions.length === 2, "both positions present");
assert(empty.headline === "Canonical Headline", "headline falls back to canonical");
assert(
  empty.positions[1].bullets.map((b) => b.text).join("|") === "B1 USD|B2",
  "pB shows all canonical bullets, USD default"
);

console.log("currency = CAD:");
const cad = resolve(base, { currency: "CAD" });
assert(cad.positions[1].bullets[0].text === "B1 CAD", "b1 uses CAD alternate");

console.log("reflow reword + hide:");
const reflow = resolve(base, {
  positions: { pB: { bullets: { b1: { reworded: "B1 new" }, b2: { hidden: true } } } },
});
assert(
  reflow.positions[1].bullets.map((b) => b.text).join("|") === "B1 new",
  "reworded b1 shown, b2 hidden"
);

console.log("title override + headline override:");
const titled = resolve(base, {
  headline: "Tailored Headline",
  positions: { pA: { titleOverride: "Marketing Lead" } },
});
assert(titled.headline === "Tailored Headline", "headline overridden");
assert(titled.positions[0].title === "Marketing Lead", "pA retitled from Co-Founder");

console.log("hide a position:");
const hidden = resolve(base, { hiddenPositionIds: ["pA"] });
assert(hidden.positions.length === 1 && hidden.positions[0].id === "pB", "pA hidden");

console.log("skill subset + order:");
const skilled = resolve(base, { skillIds: ["s2"] });
assert(
  skilled.skills.length === 1 && skilled.skills[0].name === "S2",
  "only S2, in given order"
);

console.log("position reorder:");
const reordered = resolve(base, { positionOrder: ["pB", "pA"] });
assert(reordered.positions[0].id === "pB", "pB moved first");

console.log("CRITERION 6 — new canonical bullet, reflow vs curated:");
const reflowNew = resolve(withNewBullet, {});
assert(
  reflowNew.positions[1].bullets.length === 3,
  "reflow variant: new bullet b3 auto-appears"
);
const curatedNew = resolve(withNewBullet, {
  positions: { pB: { mode: "curated", includedBulletIds: ["b1", "b2"] } },
});
assert(
  curatedNew.positions[1].bullets.length === 2 &&
    !curatedNew.positions[1].bullets.some((b) => b.id === "b3"),
  "curated variant: new bullet b3 does NOT appear (snapshot)"
);

console.log("key achievements:");
assert(resolve(base, {}).keyAchievements.length === 0, "no field gives an empty list");
const ka = resolve(base, {
  keyAchievements: [
    { title: "Grew trials", text: "Lifted trial-to-paid from 9% to 13%." },
    { title: "Québec launch", text: "Opened the first office." },
  ],
});
assert(
  ka.keyAchievements.length === 2 && ka.keyAchievements[0].title === "Grew trials" && ka.keyAchievements[1].title === "Québec launch",
  "2 items come through in order, non-ASCII intact"
);
let tooMany = false;
try {
  resolve(base, { keyAchievements: Array.from({ length: 5 }, () => ({ title: "t", text: "x" })) });
} catch {
  tooMany = true;
}
assert(tooMany, "5 items are refused");

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll resolver checks passed.");
