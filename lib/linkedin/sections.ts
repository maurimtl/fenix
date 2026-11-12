// Pure (no Node imports): the LinkedIn page's client editor and the store share these.
export type LinkedinSection = { kind: "headline" } | { kind: "about" } | { kind: "role"; positionId: string };
type Texts = { headline: string; about: string; roles: { positionId: string; text: string }[] };

export function sectionText(rec: Texts, s: LinkedinSection): string {
  if (s.kind === "headline") return rec.headline;
  if (s.kind === "about") return rec.about;
  return rec.roles.find((r) => r.positionId === s.positionId)?.text ?? "";
}

export const sectionLabel = (s: LinkedinSection) => (s.kind === "role" ? `role ${s.positionId}` : s.kind);

/** A section named in a request body, or null when it isn't one. */
export function parseSection(x: unknown): LinkedinSection | null {
  const o = x as { kind?: unknown; positionId?: unknown } | null;
  if (o?.kind === "headline" || o?.kind === "about") return { kind: o.kind };
  if (o?.kind === "role" && typeof o.positionId === "string" && o.positionId) return { kind: "role", positionId: o.positionId };
  return null;
}
