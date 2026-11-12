import { findCv } from "@/lib/store/cvs";
import { resolve } from "./resolve";
import type { CanonicalData, ResumeDocument } from "./types";
import { defaultTemplateId } from "@/lib/templates/registry";
import { readCareer, readProfileVersioned } from "@/lib/store/career";
import type { CareerRecord, ProfileRecord } from "@/lib/store/schemas";

const nul = <T>(v: T | null | undefined): T | null => (v === undefined ? null : v);

/** The person's career record and profile, from data/<person>/, in the resolver's input shape. */
export async function loadCanonical(slug: string): Promise<CanonicalData> {
  const [{ data: career }, { data: profile }] = await Promise.all([readCareer(slug), readProfileVersioned(slug)]);
  return canonicalFromRecords(profile, career);
}

/** The resolver's input built from already-parsed profile and career records. */
export function canonicalFromRecords(profile: ProfileRecord, career: CareerRecord): CanonicalData {
  return {
    profile: {
      fullName: profile.fullName,
      headline: profile.headline,
      email: profile.email,
      phone: nul(profile.phone),
      location: nul(profile.location),
      summary: profile.summary,
      about: nul(profile.about),
      linkedin: nul(profile.linkedin),
    },
    positions: career.companies.flatMap((c) =>
      c.positions.map((p) => ({
        id: p.id,
        companyName: c.name,
        title: p.title,
        location: nul(p.location),
        startDate: new Date(p.startDate),
        endDate: p.endDate ? new Date(p.endDate) : null,
        bullets: p.bullets.map((b, i) => ({
          id: b.id,
          text: b.text,
          altText: nul(b.altText),
          altCurrency: nul(b.altCurrency),
          sortOrder: i,
        })),
      })),
    ),
    education: career.education.map((e) => ({
      id: e.id,
      degree: e.degree,
      institution: e.institution,
      location: nul(e.location),
      startYear: nul(e.startYear),
      endYear: nul(e.endYear),
    })),
    skills: career.skills.map((k) => ({ id: k.id, name: k.name })),
    courses: career.courses.map((k) => ({ id: k.id, name: k.name, term: nul(k.term), provider: nul(k.provider) })),
  };
}

/**
 * Resolve a render-ready document for a given id.
 * `base` = raw canonical (no overrides); otherwise a real Variant id.
 * Returns null if the variant doesn't exist.
 */
export async function loadResumeDoc(profile: string, id: string): Promise<ResumeDocument | null> {
  const canonical = await loadCanonical(profile);
  if (id === "base") {
    return resolve(canonical, {}, await defaultTemplateId(profile));
  }
  const cv = await findCv(profile, id);
  if (!cv) return null;
  return resolve(canonical, cv.data.overrides, cv.data.templateId);
}
