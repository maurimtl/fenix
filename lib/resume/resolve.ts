import type {
  CanonicalBullet,
  CanonicalData,
  ResumeBullet,
  ResumeDocument,
  ResumePosition,
} from "./types";
import { parseOverrides } from "./schema";

/** Pick the bullet text for the chosen currency (default `text` is USD framing). */
function bulletText(b: CanonicalBullet, currency: string): string {
  if (b.altText && b.altCurrency && b.altCurrency === currency) return b.altText;
  return b.text;
}

/**
 * Pure merge: canonical data + a variant's raw override JSON → render-ready ResumeDocument.
 * No I/O. See "CV versions" in docs/architecture.md for the reflow/curated semantics.
 */
export function resolve(
  canonical: CanonicalData,
  rawOverrides: unknown,
  // Empty means "the person's default template", decided when the CV is printed.
  templateId = ""
): ResumeDocument {
  const ov = parseOverrides(rawOverrides);
  const currency = ov.currency;

  // --- positions: order → filter hidden → map title/bullets ---
  let positions = canonical.positions;

  if (ov.positionOrder && ov.positionOrder.length > 0) {
    const idx = new Map(ov.positionOrder.map((id, i) => [id, i]));
    positions = [...positions]
      .map((p, i) => ({ p, i }))
      .sort((a, b) => {
        const ai = idx.has(a.p.id) ? idx.get(a.p.id)! : Number.MAX_SAFE_INTEGER;
        const bi = idx.has(b.p.id) ? idx.get(b.p.id)! : Number.MAX_SAFE_INTEGER;
        return ai - bi || a.i - b.i; // stable: keep canonical order among unlisted
      })
      .map((x) => x.p);
  }

  const hiddenSet = new Set(ov.hiddenPositionIds ?? []);

  const resolvedPositions: ResumePosition[] = positions
    .filter((p) => !hiddenSet.has(p.id) && !ov.positions[p.id]?.hidden)
    .map((p) => {
      const po = ov.positions[p.id];
      const bulletOv = po?.bullets ?? {};
      const mode = po?.mode ?? "reflow";

      let bullets: ResumeBullet[];
      if (mode === "curated" && po?.includedBulletIds) {
        // Snapshot: explicit ids in explicit order; new canonical bullets do NOT appear.
        const byId = new Map(p.bullets.map((b) => [b.id, b]));
        bullets = po.includedBulletIds
          .map((id) => byId.get(id))
          .filter((b): b is CanonicalBullet => Boolean(b))
          .map((b) => ({
            id: b.id,
            text: bulletOv[b.id]?.reworded ?? bulletText(b, currency),
          }));
      } else {
        // Reflow: all canonical bullets by sortOrder, minus hidden; new ones auto-appear.
        bullets = [...p.bullets]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .filter((b) => !bulletOv[b.id]?.hidden)
          .map((b) => ({
            id: b.id,
            text: bulletOv[b.id]?.reworded ?? bulletText(b, currency),
          }));
      }

      return {
        id: p.id,
        company: p.companyName,
        title: po?.titleOverride ?? p.title,
        location: p.location,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate ? p.endDate.toISOString() : null,
        bullets,
      };
    });

  // --- skills: subset+order or all ---
  let skills = canonical.skills;
  if (ov.skillIds) {
    const byId = new Map(canonical.skills.map((s) => [s.id, s]));
    skills = ov.skillIds
      .map((id) => byId.get(id))
      .filter((s): s is (typeof canonical.skills)[number] => Boolean(s));
  }

  // --- courses: subset+order or all ---
  let courses = canonical.courses;
  if (ov.courseIds) {
    const byId = new Map(canonical.courses.map((c) => [c.id, c]));
    courses = ov.courseIds
      .map((id) => byId.get(id))
      .filter((c): c is (typeof canonical.courses)[number] => Boolean(c));
  }

  return {
    templateId,
    fullName: canonical.profile.fullName,
    headline: ov.headline ?? canonical.profile.headline,
    email: canonical.profile.email,
    phone: canonical.profile.phone,
    location: ov.location ?? canonical.profile.location,
    linkedin: canonical.profile.linkedin,
    summary: ov.summary ?? canonical.profile.summary,
    positions: resolvedPositions,
    education: canonical.education,
    skills,
    skillsHeading: ov.skillsHeading ?? "Tools & Stack",
    hideEducationDates: ov.hideEducationDates ?? false,
    educationDateIds: ov.educationDateIds ?? [],
    languages: ov.languages ?? [],
    contactInSidebar: ov.contactInSidebar ?? false,
    educationInSidebar: ov.educationInSidebar ?? false,
    compactSidebar: ov.compactSidebar ?? false,
    courses: courses,
    keyAchievements: ov.keyAchievements ?? [],
  };
}
