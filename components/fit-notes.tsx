import { parseNotes, type NoteItem } from "@/lib/jobs/notes";

/** Fit notes as a list; a single unlabelled note stays the paragraph it was written as. */
export function FitNotes({ text, items }: { text?: string; items?: NoteItem[] }) {
  const notes = items ?? parseNotes(text ?? "");
  if (notes.length === 0) return null;
  if (notes.length === 1 && notes[0].label === null) return <p className="prose">{notes[0].text}</p>;
  return (
    <ul className="notes">
      {notes.map((n, i) => (
        <li key={i}>
          {n.label && <strong>{n.label}: </strong>}
          {n.text}
        </li>
      ))}
    </ul>
  );
}
