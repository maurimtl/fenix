export type NoteItem = { label: string | null; text: string };

const LABEL_MAX_CHARS = 30;
const LABEL_MAX_WORDS = 3;

/**
 * Fit notes ("Why it fits", "Watch out for") as list items. A value on one line is one unlabelled item,
 * so notes written as a paragraph before the one-point-per-line format are drawn as that paragraph.
 */
export function parseNotes(text: string): NoteItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•]\s+/, ""))
    .filter((l) => l !== "");
  if (lines.length <= 1) return lines.map((l) => ({ label: null, text: l }));
  return lines.map((line) => {
    const at = line.indexOf(": ");
    if (at <= 0) return { label: null, text: line };
    const label = line.slice(0, at);
    const short = label.length < LABEL_MAX_CHARS && label.split(/\s+/).length <= LABEL_MAX_WORDS;
    return short ? { label, text: line.slice(at + 2).trim() } : { label: null, text: line };
  });
}
