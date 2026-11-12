// Verifies draftToOverrides produces a valid, resolvable curated override
// referencing real canonical bulletIds — no API call.
import { draftToOverrides, LANDED_CAP, systemPrompt } from "../lib/ai/tailor";
import { readInterviewAnswers } from "../lib/store/interviews";
import { loadCanonical } from "../lib/resume/load";
import { resolve } from "../lib/resume/resolve";

// Runs on the fictional demo person, so it needs no one's real data.
process.env.FENIX_DATA_DIR = new URL("../examples", import.meta.url).pathname;
const canonical = await loadCanonical("demo");
const founder = canonical.positions.find((p) => p.companyName === "Fabrikam Analytics")!;
const lead = canonical.positions.find((p) => p.companyName === "Northwind Software")!;

// Simulate a model draft: retitle Fabrikam, keep 2 of its bullets, rewrite one;
// include the first Northwind role with all bullets; hide everything else.
const draft = {
  headline: "Product & Engineering Leader",
  summary: "Tailored summary.",
  currency: "USD" as const,
  positions: canonical.positions.map((p) => {
    if (p.id === founder.id) {
      return {
        positionId: p.id,
        include: true,
        titleOverride: "Product & Engineering Lead",
        bulletIds: [founder.bullets[0].id, founder.bullets[1].id],
        rewrites: [{ bulletId: founder.bullets[0].id, text: "REWRITTEN founding bullet." }],
      };
    }
    if (p.id === lead.id) {
      return { positionId: p.id, include: true, titleOverride: null, bulletIds: lead.bullets.map((b) => b.id), rewrites: [] };
    }
    return { positionId: p.id, include: false, titleOverride: null, bulletIds: [], rewrites: [] };
  }),
};

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) fail++; };

const overrides = draftToOverrides(draft);
ok(overrides.currency === "USD", "overrides validated against zod schema");
const hiddenCount = Object.values(overrides.positions).filter((p) => p.hidden).length;
ok(hiddenCount === canonical.positions.length - 2, "non-included positions hidden via per-position hidden (editor-toggleable)");
ok(overrides.positions[founder.id]?.mode === "curated", "included position is curated (snapshot)");

const doc = resolve(canonical, overrides);
ok(doc.headline === "Product & Engineering Leader", "headline applied");
ok(doc.positions.length === 2, "only 2 positions shown");
const ig = doc.positions.find((p) => p.company === "Fabrikam Analytics")!;
ok(ig.title === "Product & Engineering Lead", "Fabrikam role retitled to a functional title");
ok(ig.bullets.length === 2 && ig.bullets[0].text === "REWRITTEN founding bullet.", "curated to 2 bullets, first reworded");
ok(ig.bullets.every((b) => founder.bullets.some((cb) => cb.id === b.id)), "all shown bullets reference real canonical ids");

// The interview answer bank's lines that landed reach the system prompt, capped, and an empty bank changes nothing.
const base = systemPrompt("Alex Morgan", "Canada", []);
const bank = await readInterviewAnswers("demo");
ok(bank?.landed[0] === "Growth starts at the first report a trial builds.", "demo answer bank read");
const withBank = systemPrompt("Alex Morgan", "Canada", [], bank!.landed);
ok(withBank.includes("- Growth starts at the first report a trial builds."), "a line that landed is in the prompt");
ok(systemPrompt("Alex Morgan", "Canada", [], []) === base, "an empty bank leaves the prompt unchanged");
const many = Array.from({ length: 40 }, (_, i) => `Line number ${i} ${"x".repeat(100)}`);
const capped = systemPrompt("Alex Morgan", "Canada", [], many);
ok(capped.includes("Line number 0 ") && !capped.includes("Line number 39 "), "lines past the cap are left out whole");
ok(capped.length - base.length <= LANDED_CAP + 300, "the added section stays under the cap plus its heading");

if (fail) { console.error(`\n${fail} failed`); process.exit(1); }
console.log("\nTailor mapping checks passed.");
