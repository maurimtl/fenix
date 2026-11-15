export type NoteItem = { label: string | null; text: string };

const LABEL_MAX_CHARS = 30;
const LABEL_MAX_WORDS = 3;

function lineItems(text: string): NoteItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•]\s+/, ""))
    .filter((l) => l !== "")
    .map((line) => {
      const at = line.indexOf(": ");
      if (at <= 0) return { label: null, text: line };
      const label = line.slice(0, at);
      const short = label.length < LABEL_MAX_CHARS && label.split(/\s+/).length <= LABEL_MAX_WORDS;
      return short ? { label, text: line.slice(at + 2).trim() } : { label: null, text: line };
    });
}

/**
 * Fit notes ("Why it fits", "Watch out for") as list items. Notes written as prose before the one-point-per-line
 * format (one line, or several lines of which fewer than half start with a label) come back as one unlabelled item
 * holding the text as written, so they are drawn as the paragraphs they are.
 */
export function parseNotes(text: string): NoteItem[] {
  const items = lineItems(text);
  const labelled = items.filter((i) => i.label !== null).length;
  if (items.length > 1 && labelled * 2 >= items.length) return items;
  const prose = text.trim();
  return prose === "" ? [] : [{ label: null, text: prose }];
}

const SUMMARY_MAX_ITEMS = 6;

/** The role summary as list items, cut to what the job page shows. */
export function summaryItems(text: string): NoteItem[] {
  return lineItems(text).slice(0, SUMMARY_MAX_ITEMS);
}
