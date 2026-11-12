// Chromium applies a PNG's gamma/colour chunks, so a background with them renders darker in the banner than
// the raw pixels shown in the approved 2026-11-09 banner. Dropping them makes the pixels plain sRGB, as CSS colours are.
const COLOR_CHUNKS = new Set(["gAMA", "cHRM", "sRGB", "iCCP"]);
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Returns the PNG without colour-management chunks; anything that isn't a well-formed PNG comes back unchanged. */
export function stripColorChunks(png: Buffer): Buffer {
  if (png.length < 8 || !png.subarray(0, 8).equals(SIGNATURE)) return png;
  const parts: Buffer[] = [SIGNATURE];
  let at = 8;
  while (at + 12 <= png.length) {
    const len = png.readUInt32BE(at);
    const end = at + 12 + len;
    if (end > png.length) return png;
    const type = png.toString("latin1", at + 4, at + 8);
    if (!COLOR_CHUNKS.has(type)) parts.push(png.subarray(at, end));
    at = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}
