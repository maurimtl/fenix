export type BoardSort = "best" | "newest" | "oldest";
export type BoardPreset = "7d" | "30d";
export type SearchParams = Record<string, string | string[] | undefined>;

export type BoardView = {
  sort: BoardSort;
  since: BoardPreset | null;
  from: string | null;
  to: string | null;
  /** Local-day window on the stage-entry date, both ends inclusive; null means show everything. */
  window: { start: Date | null; end: Date | null } | null;
  /** The address asked for a filter that didn't parse, so everything is shown. */
  rejected: boolean;
};

export const SORT_LABEL: Record<BoardSort, string> = { best: "Best match", newest: "Newest first", oldest: "Oldest first" };
export const PRESET_LABEL: Record<BoardPreset, string> = { "7d": "Last 7 days", "30d": "Last 30 days" };
const PRESET_DAYS: Record<BoardPreset, number> = { "7d": 7, "30d": 30 };

function first(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s : null;
}

// Round-trips the parts, so 2026-02-30 is refused instead of rolling over to March 2.
function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function parseBoardView(sp: SearchParams, now: Date): BoardView {
  const sortRaw = first(sp.sort);
  const sort: BoardSort = sortRaw === "newest" || sortRaw === "oldest" ? sortRaw : "best";
  const all: BoardView = { sort, since: null, from: null, to: null, window: null, rejected: false };
  const rejected: BoardView = { ...all, rejected: true };

  const since = first(sp.since);
  if (since) {
    if (since !== "7d" && since !== "30d") return rejected;
    // Calendar arithmetic, not 24-hour blocks, so a DST change doesn't move the start.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (PRESET_DAYS[since] - 1));
    return { ...all, since, window: { start, end: null } };
  }

  const fromRaw = first(sp.from);
  const toRaw = first(sp.to);
  if (!fromRaw && !toRaw) return all;
  const from = fromRaw ? parseDay(fromRaw) : null;
  const to = toRaw ? parseDay(toRaw) : null;
  if ((fromRaw && !from) || (toRaw && !to) || (from && to && from > to)) return rejected;
  return { ...all, from: fromRaw, to: toRaw, window: { start: from, end: to ? endOfDay(to) : null } };
}

export function inWindow(job: { stageEnteredAt: Date }, view: BoardView): boolean {
  if (!view.window) return true;
  const t = job.stageEnteredAt.getTime();
  const { start, end } = view.window;
  return (!start || t >= start.getTime()) && (!end || t <= end.getTime());
}

export function filterBoard<T extends { stageEnteredAt: Date }>(jobs: T[], view: BoardView): T[] {
  return jobs.filter((j) => inWindow(j, view));
}

// "best" keeps the order the jobs came in; the date sorts are stable, so ties keep that order too.
export function sortColumn<T extends { stageEnteredAt: Date }>(jobs: T[], sort: BoardSort): T[] {
  if (sort === "best") return jobs;
  const dir = sort === "newest" ? -1 : 1;
  return [...jobs].sort((a, b) => dir * (a.stageEnteredAt.getTime() - b.stageEnteredAt.getTime()));
}

type ViewChange = { sort?: BoardSort; since?: BoardPreset | null; from?: string | null; to?: string | null };

/** A link to the board with one part of the view changed; a preset and a custom range replace each other. */
export function viewHref(base: string, view: BoardView, change: ViewChange): string {
  const next = { sort: view.sort, since: view.since, from: view.from, to: view.to, ...change };
  if ("since" in change) {
    next.from = null;
    next.to = null;
  }
  if ("from" in change || "to" in change) next.since = null;
  const qs = new URLSearchParams();
  if (next.sort !== "best") qs.set("sort", next.sort);
  if (next.since) qs.set("since", next.since);
  if (next.from) qs.set("from", next.from);
  if (next.to) qs.set("to", next.to);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}
