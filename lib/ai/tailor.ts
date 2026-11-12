import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CanonicalData } from "@/lib/resume/types";
import { overridesSchema, type Overrides } from "@/lib/resume/schema";

// Default model per the claude-api skill (use opus-4-8 unless the user picks another).
// Swap to "claude-sonnet-5" here if you want cheaper drafts.
const MODEL = "claude-opus-4-8";

// The draft the model returns. Every bullet is referenced by its canonical id
// (no fuzzy back-matching of prose onto rows).
const DraftPositionSchema = z.object({
  positionId: z.string(),
  include: z.boolean(),
  titleOverride: z.string().nullable(),
  bulletIds: z.array(z.string()),
  rewrites: z.array(z.object({ bulletId: z.string(), text: z.string() })),
});

// Bullet text is in the base currency; a bullet may carry an alternate (altText in altCurrency).
const BASE_CURRENCY = "USD";

function draftSchema(currencies: [string, ...string[]]) {
  return z.object({
    headline: z.string(),
    summary: z.string(),
    currency: z.enum(currencies),
    positions: z.array(DraftPositionSchema),
  });
}

export type Draft = z.infer<ReturnType<typeof draftSchema>>;

/** The person's name and currency choices come from their own data, so the prompt works for anyone. */
export const LANDED_CAP = 3000;

/** Whole lines from the person's interview answer bank, up to LANDED_CAP characters in all. */
export function landedSection(landed: string[]): string {
  const lines: string[] = [];
  let used = 0;
  for (const l of landed) {
    const line = `- ${l.trim()}`;
    if (!l.trim() || used + line.length + 1 > LANDED_CAP) continue;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.length
    ? `\n\nHow they describe their work (lines that landed in their interviews; use the wording where it fits, never their numbers unless the career data has them):\n${lines.join("\n")}`
    : "";
}

export function systemPrompt(fullName: string, homeCountryName: string, alternates: string[], landed: string[] = []) {
  const currencyRule = alternates.length
    ? `"${BASE_CURRENCY}" by default. Choose ${alternates.map((c) => `"${c}"`).join(" or ")} only if the job is clearly for an employer paying in that currency (for example one based in ${homeCountryName}).`
    : `always "${BASE_CURRENCY}".`;
  return `You tailor ${fullName}'s résumé to a specific job description.

You are given their canonical career data (positions and bullets, each with a stable id) and a job description. Produce a tailored draft:

- headline: a concise title line tuned to the target role (e.g. "Director of Product Management | Growth").
- summary: 2-4 sentences positioning them for THIS role, drawn from their real experience.
- currency: ${currencyRule}
- positions: for EACH canonical position, decide:
  - include: whether it should appear on this résumé (hide clearly irrelevant older roles if the résumé is long, but keep a coherent history).
  - titleOverride: for founder/co-founder roles, propose a FUNCTIONAL title that matches what the target job wants (e.g. "Product & Engineering Lead", "Growth Lead", "Software Engineer"). For normal roles, return null to keep the canonical title.
  - bulletIds: the canonical bullet ids to show, most-relevant first. Reference ONLY ids that exist in that position's data.
  - rewrites: optional reworded versions of specific bullets, keyed by bulletId, tuned to the JD's language and keywords. Only rewrite bullets you also list in bulletIds. NEVER invent achievements, numbers, or employers — only rephrase what's already there. Every number in a rewrite, the headline or the summary must already appear in the career data.

Rules: use only the bullet ids provided; never fabricate facts, metrics, or companies; keep it truthful and ATS-friendly.${landedSection(landed)}`;
}

/** Compact canonical data for the prompt — ids + text only. */
function compactCanonical(canonical: CanonicalData) {
  return {
    profile: {
      fullName: canonical.profile.fullName,
      defaultHeadline: canonical.profile.headline,
      about: canonical.profile.about,
    },
    positions: canonical.positions.map((p) => ({
      positionId: p.id,
      company: p.companyName,
      canonicalTitle: p.title,
      bullets: p.bullets.map((b) => ({ bulletId: b.id, text: b.text })),
    })),
    skills: canonical.skills.map((s) => s.name),
  };
}

/** Call Claude to draft a tailored variant from a job description. */
export async function tailorFromJD(
  canonical: CanonicalData,
  jobDescription: string,
  homeCountryName: string,
  landed: string[] = [],
): Promise<Draft> {
  const alternates = [
    ...new Set(canonical.positions.flatMap((p) => p.bullets.map((b) => b.altCurrency)).filter((c): c is string => Boolean(c) && c !== BASE_CURRENCY)),
  ];
  const DraftSchema = draftSchema([BASE_CURRENCY, ...alternates]);
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — add it to .env to use AI tailoring."
    );
  }
  const client = new Anthropic();
  // Stream: a generous max_tokens (so adaptive thinking can't starve the JSON)
  // exceeds the SDK's non-streaming 10-minute guard, so we must stream.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: systemPrompt(canonical.profile.fullName, homeCountryName, alternates, landed),
    messages: [
      {
        role: "user",
        content: `CANDIDATE DATA (JSON):\n${JSON.stringify(
          compactCanonical(canonical)
        )}\n\nJOB DESCRIPTION:\n${jobDescription}`,
      },
    ],
    output_config: { format: zodOutputFormat(DraftSchema), effort: "medium" },
  });

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("The model declined this request.");
  }
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text) {
    throw new Error(
      `Model returned no draft text (stop_reason: ${message.stop_reason}).`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Model output was not valid JSON.");
  }
  const parsed = DraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Draft did not match schema: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Pure mapping: a model Draft → validated storage Overrides.
 * Curated mode per position (AI curation is a snapshot, not reflow).
 */
export function draftToOverrides(draft: Draft): Overrides {
  // Hidden roles use per-position `hidden` (same mechanism the editor toggles),
  // NOT the separate hiddenPositionIds array — so the editor can show them again.
  const positions: Record<string, unknown> = {};
  for (const p of draft.positions) {
    if (!p.include) {
      positions[p.positionId] = { mode: "reflow", hidden: true, bullets: {} };
      continue;
    }
    const bullets: Record<string, { reworded?: string }> = {};
    for (const r of p.rewrites) {
      bullets[r.bulletId] = { reworded: r.text };
    }
    positions[p.positionId] = {
      mode: "curated",
      titleOverride: p.titleOverride || undefined,
      includedBulletIds: p.bulletIds,
      bullets,
    };
  }

  return overridesSchema.parse({
    headline: draft.headline || undefined,
    summary: draft.summary || undefined,
    currency: draft.currency,
    positions,
  });
}
