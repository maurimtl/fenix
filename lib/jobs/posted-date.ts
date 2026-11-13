// Asks a company's job board when a stored posting went up. Ashby, Greenhouse and Lever public APIs only.
import { slugCandidates, type BoardJob } from "./liveness";

export type PostedLookup = { postedAt: string | null; evidence: string; requests: number };
type Fetch = (url: string) => Promise<{ status: number; json: () => Promise<unknown> }>;

const defaultFetch: Fetch = (url) =>
  fetch(url, { headers: { "user-agent": "fenix-posted-date" }, signal: AbortSignal.timeout(20_000) });

/** A board's date (ISO text, or Lever's epoch milliseconds) as UTC ISO text; null when missing or unreadable. */
export function boardDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** One run's state: an Ashby board is fetched once per slug, since it only comes as a whole list. */
export function postedDateLookup(fetchImpl: Fetch = defaultFetch) {
  const ashbyBoards = new Map<string, Map<string, unknown> | null>();

  async function get(url: string): Promise<unknown> {
    try {
      const r = await fetchImpl(url);
      return r.status === 200 ? await r.json().catch(() => null) : null;
    } catch {
      return null;
    }
  }

  return async function lookup(job: BoardJob): Promise<PostedLookup> {
    let requests = 0;
    for (const slug of slugCandidates(job)) {
      const s = encodeURIComponent(slug);
      const id = encodeURIComponent(job.sourceJobId);
      let raw: unknown;
      let field = "";
      if (job.source === "ashby") {
        if (!ashbyBoards.has(slug)) {
          requests++;
          const jobs = ((await get(`https://api.ashbyhq.com/posting-api/job-board/${s}`)) as { jobs?: { id: string; publishedAt?: unknown }[] } | null)?.jobs;
          ashbyBoards.set(slug, Array.isArray(jobs) ? new Map(jobs.map((j) => [j.id, j.publishedAt])) : null);
        }
        raw = ashbyBoards.get(slug)?.get(job.sourceJobId);
        field = "Ashby publishedAt";
      } else if (job.source === "greenhouse") {
        requests++;
        raw = ((await get(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs/${id}`)) as { first_published?: unknown } | null)?.first_published;
        field = "Greenhouse first_published";
      } else if (job.source === "lever") {
        requests++;
        raw = ((await get(`https://api.lever.co/v0/postings/${s}/${id}`)) as { createdAt?: unknown } | null)?.createdAt;
        field = "Lever createdAt";
      }
      const postedAt = boardDate(raw);
      if (postedAt) return { postedAt, evidence: `${field} on the board ${slug}`, requests };
    }
    return { postedAt: null, evidence: "no board gave a date for this posting", requests };
  };
}
