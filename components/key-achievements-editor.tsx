"use client";

type Item = { title: string; text: string };

export const KA_MAX = 4;
const TITLE_MAX = 60;
const TEXT_MAX = 200;

/** Rows with both a title and a line; what the preview and the save use. */
export function completeAchievements(items: Item[] | undefined): Item[] | undefined {
  const done = (items ?? []).map((k) => ({ title: k.title.trim(), text: k.text.trim() })).filter((k) => k.title && k.text);
  return done.length ? done : undefined;
}

export function KeyAchievementsEditor({
  items,
  onChange,
  shownBy,
  designName,
  shownHere,
}: {
  items: Item[];
  onChange: (next: Item[]) => void;
  shownBy: string[];
  designName: string;
  shownHere: boolean;
}) {
  const set = (i: number, patch: Partial<Item>) => onChange(items.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="editor-section key-achievements">
      <h3>Key achievements</h3>
      {items.map((k, i) => (
        <div key={i} className="ka-row">
          <label className="fld">
            <span>
              Title <small>{k.title.length}/{TITLE_MAX}</small>
            </span>
            <input aria-label={`Achievement ${i + 1} title`} value={k.title} maxLength={TITLE_MAX} onChange={(e) => set(i, { title: e.target.value })} />
          </label>
          <label className="fld">
            <span>
              Line <small>{k.text.length}/{TEXT_MAX}</small>
            </span>
            <input aria-label={`Achievement ${i + 1} line`} value={k.text} maxLength={TEXT_MAX} onChange={(e) => set(i, { text: e.target.value })} />
          </label>
          <div className="ka-actions">
            <button type="button" className="btn" aria-label={`Move achievement ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="btn" aria-label={`Move achievement ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" className="btn" aria-label={`Remove achievement ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn" disabled={items.length >= KA_MAX} onClick={() => onChange([...items, { title: "", text: "" }])}>
        Add an achievement
      </button>
      <p className="ka-note">
        {shownBy.length ? `Shown by: ${shownBy.join(", ")}.` : "No design shows them yet."}
        {!shownHere && ` Not shown by ${designName}.`}
        {" Rows without both a title and a line aren't saved."}
      </p>
    </div>
  );
}
