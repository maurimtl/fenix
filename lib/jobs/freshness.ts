// How old a posting is, and which posting date to keep when the same job is saved again.

import type { POSTED_SOURCES } from "@/lib/store/schemas";
import { compConfirmed } from "./format";
import type { CompSource } from "./types";

export type PostedSource = (typeof POSTED_SOURCES)[number];
export type Freshness = "today" | "week" | "edge" | "old" | "stale" | "unknown";

/** A posting this many days old is held off the shortlist unless the fit is strong. */
export const STALE_DAYS = 21;

const DAY_MS = 86_400_000;

/** Whole days since the posting went up; 0 for a date slightly in the future. Null when there is no usable date. */
export function postingAgeDays(postedAt: Date | string | null | undefined, now: Date): number | null {
  if (postedAt == null) return null;
  const t = (postedAt instanceof Date ? postedAt : new Date(postedAt)).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function freshness(postedAt: Date | string | null | undefined, now: Date): Freshness {
  const days = postingAgeDays(postedAt, now);
  if (days === null) return "unknown";
  if (days <= 1) return "today";
  if (days <= 7) return "week";
  if (days <= 14) return "edge";
  if (days < STALE_DAYS) return "old";
  return "stale";
}

/** Board order, lower first. An undated job ranks with "edge": most stored jobs have no date and aren't penalized for it. */
export const FRESHNESS_RANK: Record<Freshness, number> = { today: 0, week: 1, edge: 2, unknown: 2, old: 3, stale: 4 };

const PREFIX: Partial<Record<Freshness, string>> = { edge: "Edge", old: "Old", stale: "Stale" };

/** The line a card shows: "Today", "1 day", "5 days", "Edge · 9 days", "Stale · 30 days", with " · reposted" when the listing said so. */
export function ageLine(job: { postedAt: Date | string | null | undefined; reposted?: boolean | null }, now: Date): string {
  const days = postingAgeDays(job.postedAt, now);
  if (days === null) return job.reposted ? "Age unknown · reposted" : "Age unknown";
  const label = freshness(job.postedAt, now);
  const span = `${days} days`;
  const text = days === 0 ? "Today" : days === 1 ? "1 day" : PREFIX[label] ? `${PREFIX[label]} · ${span}` : span;
  return job.reposted ? `${text} · reposted` : text;
}

export type Posted = { postedAt?: string | null; postedAtSource?: PostedSource | null; reposted?: boolean | null };

/**
 * The posting date to keep when a stored job is saved again. A company-board date beats a listing date, and within one
 * kind the earlier date stays, so a re-post never makes a job look newer. "Reposted" sticks once seen.
 */
export function mergePosted(stored: Posted, incoming: Posted): { postedAt: string | null; postedAtSource: PostedSource | null; reposted: boolean } {
  const reposted = Boolean(stored.reposted || incoming.reposted);
  const has = (p: Posted) => p.postedAt != null && p.postedAtSource != null && !Number.isNaN(new Date(p.postedAt).getTime());
  const pick = (p: Posted) => ({ postedAt: new Date(p.postedAt!).toISOString(), postedAtSource: p.postedAtSource!, reposted });
  if (!has(incoming)) return has(stored) ? pick(stored) : { postedAt: null, postedAtSource: null, reposted };
  if (!has(stored)) return pick(incoming);
  if (stored.postedAtSource !== incoming.postedAtSource) return pick(stored.postedAtSource === "board" ? stored : incoming);
  return pick(new Date(incoming.postedAt!).getTime() < new Date(stored.postedAt!).getTime() ? incoming : stored);
}

/** The board's "Best match" order: confirmed pay first, then the fresher posting, then the higher fit. */
export function bestMatchOrder(now: Date) {
  type Ranked = { compSource: CompSource; postedAt: Date | string | null; fitScore: number | null };
  return (a: Ranked, b: Ranked) =>
    Number(compConfirmed(b.compSource)) - Number(compConfirmed(a.compSource)) ||
    FRESHNESS_RANK[freshness(a.postedAt, now)] - FRESHNESS_RANK[freshness(b.postedAt, now)] ||
    (b.fitScore ?? -1) - (a.fitScore ?? -1);
}
