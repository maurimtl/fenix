// The background from the first approved banner (2026-11-09). The image model never draws text: Fenix adds it.
const BASE = [
  "Abstract background for a LinkedIn profile banner of a senior product and growth executive.",
  "Deep navy (#0F1E3D) to slate gradient with a single teal accent (#2EC4B6). Modern, premium, calm.",
  "Subtle growth-loop or network line art, only in the left half; the right half is clean, empty gradient for text.",
  "The bottom-left and bottom-centre stay calm and empty: a round profile photo covers them.",
  "Compose everything inside the vertical middle band: the image is cropped to a thin horizontal strip (4:1).",
  "Absolutely no text, letters, numbers, logos, people, photos or skylines.",
].join(" ");

export function backgroundPrompt(styleNote?: string | null): string {
  const note = styleNote?.trim();
  return note ? `${BASE} Style note: ${note.slice(0, 300)}` : BASE;
}
