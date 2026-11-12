// Text that survives a paste into LinkedIn's profile editor.
// Bullet lines become "\u200B• " (the zero-width space stops LinkedIn's auto-list conversion, same as
// the usual LinkedIn formatter trick), blank lines hold a zero-width space so the editor keeps them,
// and runs of blank lines collapse to one.

/** LinkedIn editor limits (headline and role descriptions per third-party references; About per LinkedIn's talent blog). */
export const LINKEDIN_LIMITS = { headline: 220, about: 2600, role: 2000 } as const;

export function toLinkedInPaste(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => (/^\s*[-*•]\s+/.test(line) ? line.replace(/^\s*[-*•]\s+/, "\u200B• ") : line.trim() === "" ? "\u200B" : line))
    .join("\n");
}

/** Length as LinkedIn counts it in the editor (characters you see; the zero-width spaces aren't typed). */
export function visibleLength(text: string): number {
  return [...text.replace(/\u200B/g, "")].length;
}
