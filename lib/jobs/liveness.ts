// Asks a company's job board whether a stored posting still exists. Ashby, Greenhouse and Lever public APIs only.
// A posting counts as closed only when the board itself answered (the board exists and the posting isn't on it);
// anything else is "unknown", never closed.

export type Liveness = { status: "open" | "closed" | "unknown"; evidence: string; requests: number };
export type BoardJob = { source: string; sourceJobId: string; url: string; company: string };
type Fetch = (url: string) => Promise<{ status: number; json: () => Promise<unknown> }>;

const LIVENESS_SOURCES = new Set(["ashby", "greenhouse", "lever"]);
export const isBoardSource = (source: string) => LIVENESS_SOURCES.has(source);

/** Board slugs to try: the one in the posting URL, then the company name squashed. */
export function slugCandidates(job: BoardJob): string[] {
  const out: string[] = [];
  const m =
    job.url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i) ??
    job.url.match(/(?:job-)?boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?(?:embed\/job_app\?for=)?([^/?#&]+)/i) ??
    job.url.match(/jobs\.lever\.co\/([^/?#]+)/i);
  if (m) out.push(decodeURIComponent(m[1]).toLowerCase());
  const squashed = job.company.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (squashed && !out.includes(squashed)) out.push(squashed);
  return out;
}

const defaultFetch: Fetch = (url) =>
  fetch(url, { headers: { "user-agent": "fenix-liveness" }, signal: AbortSignal.timeout(20_000) });

/** One run's state: Ashby boards are fetched once per slug, and Greenhouse boards are confirmed once per slug. */
export function livenessChecker(fetchImpl: Fetch = defaultFetch) {
  const ashbyBoards = new Map<string, Set<string> | null>();
  const greenhouseBoards = new Map<string, boolean>();

  async function get(url: string): Promise<{ status: number; body: unknown }> {
    try {
      const r = await fetchImpl(url);
      return { status: r.status, body: r.status === 200 ? await r.json().catch(() => null) : null };
    } catch {
      return { status: 0, body: null };
    }
  }

  return async function check(job: BoardJob): Promise<Liveness> {
    let requests = 0;
    for (const slug of slugCandidates(job)) {
      const s = encodeURIComponent(slug);
      const id = encodeURIComponent(job.sourceJobId);
      if (job.source === "ashby") {
        if (!ashbyBoards.has(slug)) {
          requests++;
          const r = await get(`https://api.ashbyhq.com/posting-api/job-board/${s}`);
          const jobs = (r.body as { jobs?: { id: string }[] } | null)?.jobs;
          ashbyBoards.set(slug, r.status === 200 && Array.isArray(jobs) ? new Set(jobs.map((j) => j.id)) : null);
        }
        const ids = ashbyBoards.get(slug);
        if (!ids) continue;
        return ids.has(job.sourceJobId)
          ? { status: "open", evidence: `listed on the Ashby board ${slug}`, requests }
          : { status: "closed", evidence: `no longer listed on the Ashby board ${slug}`, requests };
      }
      if (job.source === "greenhouse") {
        requests++;
        const r = await get(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs/${id}`);
        if (r.status === 200) return { status: "open", evidence: `Greenhouse board ${slug} returns the posting`, requests };
        if (r.status !== 404) continue;
        if (!greenhouseBoards.has(slug)) {
          requests++;
          greenhouseBoards.set(slug, (await get(`https://boards-api.greenhouse.io/v1/boards/${s}`)).status === 200);
        }
        if (greenhouseBoards.get(slug)) return { status: "closed", evidence: `Greenhouse board ${slug} returns 404 for posting ${job.sourceJobId}`, requests };
        continue;
      }
      if (job.source === "lever") {
        requests++;
        const r = await get(`https://api.lever.co/v0/postings/${s}/${id}`);
        if (r.status === 200) return { status: "open", evidence: `Lever board ${slug} returns the posting`, requests };
        // Lever answers 404 for an unknown company too, so confirm the board lists anything at all.
        if (r.status !== 404) continue;
        requests++;
        const list = await get(`https://api.lever.co/v0/postings/${s}?mode=json&limit=1`);
        if (list.status === 200 && Array.isArray(list.body)) return { status: "closed", evidence: `Lever board ${slug} returns 404 for posting ${job.sourceJobId}`, requests };
      }
    }
    return { status: "unknown", evidence: "no board answered for this posting", requests };
  };
}
