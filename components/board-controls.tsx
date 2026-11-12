import Link from "next/link";
import { PRESET_LABEL, SORT_LABEL, viewHref, type BoardPreset, type BoardSort, type BoardView } from "@/lib/jobs/board-view";

const SORTS: BoardSort[] = ["best", "newest", "oldest"];
const PRESETS: BoardPreset[] = ["7d", "30d"];

export function BoardControls({ base, view, shown, total }: { base: string; view: BoardView; shown: number; total: number }) {
  const custom = view.window !== null && view.since === null;
  return (
    <div className="board-controls">
      <nav className="seg" aria-label="Sort">
        {SORTS.map((s) => (
          <Link key={s} href={viewHref(base, view, { sort: s })} aria-current={view.sort === s ? "page" : undefined}>
            {SORT_LABEL[s]}
          </Link>
        ))}
      </nav>
      <nav className="seg" aria-label="Date entered stage">
        <Link href={viewHref(base, view, { since: null })} aria-current={view.window === null ? "page" : undefined}>
          All
        </Link>
        {PRESETS.map((p) => (
          <Link key={p} href={viewHref(base, view, { since: p })} aria-current={view.since === p ? "page" : undefined}>
            {PRESET_LABEL[p]}
          </Link>
        ))}
      </nav>
      <form className={`board-range${custom ? " board-range-active" : ""}`} action={base} method="get">
        {view.sort !== "best" && <input type="hidden" name="sort" value={view.sort} />}
        <label>
          From <input type="date" name="from" defaultValue={view.from ?? ""} />
        </label>
        <label>
          to <input type="date" name="to" defaultValue={view.to ?? ""} />
        </label>
        <button type="submit" className="btn">
          Apply
        </button>
      </form>
      {view.rejected && <p className="board-showing">That date filter wasn&apos;t valid, so the whole board is shown.</p>}
      {view.window && (
        <p className="board-showing">
          {shown === 0 ? "Nothing entered a stage in this range." : `Showing ${shown} of ${total}`}
        </p>
      )}
    </div>
  );
}
