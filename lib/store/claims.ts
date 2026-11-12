import { fromYaml, readText, toYaml, writeAtomic } from "./files";
import { profilePath } from "./paths";
import type { CareerRecord, CvRecord, ProfileRecord, StoryRecord } from "./schemas";

// A number token: optional ~/≈ and currency, digits, optional scale word or K/M/B, %, x/× or +.
const TOKEN = /(?<![\w.])[~≈]?[$€£]?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|thousand)\b|[kKmMbB](?![a-zA-Z])|%|[x×](?![a-zA-Z])|\+)?/g;
const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };
// Index = value. "zero" and "one" are left out: in prose they are almost never counts ("one of the", "someone").
const WORDS = ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Comparable form of a token: "$270K" and "$270,000" match; "30%", "3x" and "3×" keep their unit; "+" is dropped. */
export function numberKey(token: string): string | null {
  const m = token.toLowerCase().replace(/[~≈$€£,\s]/g, "").match(/^(\d+(?:\.\d+)?)(million|billion|thousand|[kmb%x×+])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "";
  if (unit === "%") return `${n}%`;
  if (unit === "x" || unit === "×") return `${n}x`;
  const value = n * (SCALE[unit] ?? 1);
  return String(Math.round(value * 1000) / 1000);
}

export function numberTokens(text: string): { token: string; key: string }[] {
  const out: { token: string; key: string }[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const token = m[0].trim();
    const key = numberKey(token);
    if (!key) continue;
    // Plain years aren't claims.
    if (/^\d{4}$/.test(key) && Number(key) >= 1900 && Number(key) <= 2100 && !/[$€£%x×]/.test(token)) continue;
    out.push({ token, key });
  }
  return out;
}

function keysOf(texts: (string | null | undefined)[]): Set<string> {
  const keys = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const { key } of numberTokens(t)) keys.add(key);
    // "four PMs" in the source backs "4 PMs" in a CV; "two of", "three-year" and "ten or so" don't count anything.
    for (const [i, w] of WORDS.entries())
      if (w && new RegExp(`\\b${w}\\s+(?!(?:of|or|and|to|than|more|times)\\b)[a-z]`, "i").test(t)) keys.add(String(i));
  }
  return keys;
}

/** Every number the career record, the profile and the stories' claims can back. */
export function sourceNumbers(profile: ProfileRecord, career: CareerRecord, stories: StoryRecord[]): Set<string> {
  const texts: (string | null | undefined)[] = [profile.headline, profile.summary, profile.about];
  for (const c of career.companies) {
    texts.push(c.name);
    for (const p of c.positions) {
      texts.push(p.title);
      for (const b of p.bullets) texts.push(b.text, b.altText);
    }
  }
  for (const e of career.education) texts.push(e.degree, e.institution);
  for (const s of career.skills) texts.push(s.name);
  for (const c of career.courses) texts.push(c.name);
  for (const s of stories) for (const n of s.numbers) texts.push(n.claim);
  return keysOf(texts);
}

export type InventedNumber = { field: string; token: string };

/** Numbers in a CV version's headline, summary, reworded bullets and Key achievements that no source backs. */
export function inventedNumbers(cv: CvRecord, sources: Set<string>): InventedNumber[] {
  const o = cv.overrides;
  const fields: [string, string | undefined][] = [
    ["headline", o.headline],
    ["summary", o.summary],
  ];
  for (const [pid, po] of Object.entries(o.positions))
    for (const [bid, b] of Object.entries(po.bullets)) fields.push([`bullet ${bid} (position ${pid})`, b.reworded]);
  (o.keyAchievements ?? []).forEach((k, i) => fields.push([`key achievement ${i + 1} title`, k.title], [`key achievement ${i + 1} text`, k.text]));
  const out: InventedNumber[] = [];
  for (const [field, text] of fields) {
    if (!text) continue;
    for (const { token, key } of numberTokens(text)) if (!sources.has(key)) out.push({ field, token });
  }
  return out;
}

// Known unbacked numbers waiting on the person (claims-baseline.yaml): listed by check:claims, not blocking.
export const BASELINE_FILE = "claims-baseline.yaml";
export const claimKey = (cvId: string, token: string) => `${cvId} ${token}`;

export async function readClaimsBaseline(profile: string): Promise<Set<string>> {
  const text = await readText(profilePath(profile, BASELINE_FILE));
  const raw = text ? (fromYaml(text) as { known?: { cv?: unknown; token?: unknown }[] }) : null;
  const out = new Set<string>();
  for (const k of raw?.known ?? []) if (typeof k.cv === "string" && typeof k.token === "string") out.add(claimKey(k.cv, k.token));
  return out;
}

export async function writeClaimsBaseline(profile: string, known: { cv: string; token: string }[]) {
  const unique = [...new Map(known.map((k) => [claimKey(k.cv, k.token), k])).values()];
  if (unique.length === 0) return;
  await writeAtomic(profilePath(profile, BASELINE_FILE), toYaml({ known: unique }));
}

/** The unbacked numbers in one saved CV, read fresh from the person's career record, profile and stories. */
export async function unbackedInCv(profile: string, cv: CvRecord): Promise<InventedNumber[]> {
  const [{ readCareer, readProfileVersioned }, { readAllStories }] = await Promise.all([import("./career"), import("./stories")]);
  const [career, prof, stories] = await Promise.all([readCareer(profile), readProfileVersioned(profile), readAllStories(profile)]);
  return inventedNumbers(cv, sourceNumbers(prof.data, career.data, stories.map((s) => s.data)));
}
