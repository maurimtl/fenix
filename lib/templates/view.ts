import type { ResumeDocument } from "@/lib/resume/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthYear(iso: string | null): string {
  if (!iso) return "Present";
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function yearRange(start: number | null, end: number | null): string {
  if (start && end) return `${start} - ${end}`;
  if (end) return String(end);
  if (start) return String(start);
  return "";
}

/**
 * Everything a template can print, precomputed so templates stay simple: formatted dates, education years with
 * the hide rules applied, courses grouped by provider, the summary split into lines. Optional values are null,
 * never missing, so strict variables only fail on real typos.
 */
export function buildView(doc: ResumeDocument) {
  const summaryLines = doc.summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const linkedinLabel = doc.linkedin ? doc.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : null;
  const profileUrl = linkedinLabel?.match(/^(.*\/in\/)([^/?#]+)/);

  const courseGroups: { provider: string; items: { id: string; name: string; term: string | null }[] }[] = [];
  for (const c of doc.courses) {
    const key = c.provider ?? "Courses";
    let g = courseGroups.find((x) => x.provider === key);
    if (!g) courseGroups.push((g = { provider: key, items: [] }));
    g.items.push({ id: c.id, name: c.name, term: c.term ?? null });
  }

  return {
    fullName: doc.fullName,
    // For CSS strings such as an @page margin box: every character but letters, digits, space, dot and hyphen
    // becomes a CSS escape, which the template's HTML escaping then leaves alone.
    fullNameCss: doc.fullName.replace(/[^\p{L}\p{N} .-]/gu, (c) => `\\${c.codePointAt(0)!.toString(16)} `),
    headline: doc.headline,
    email: doc.email,
    phone: doc.phone ?? null,
    location: doc.location ?? null,
    linkedin: doc.linkedin ?? null,
    // Keeps the domain so the text is copy-pasteable; drops only the protocol and www.
    linkedinLabel,
    // The label in two parts, so a design can let it wrap only between them and never inside the handle.
    linkedinPrefix: profileUrl ? profileUrl[1] : null,
    linkedinHandle: profileUrl ? profileUrl[2] : linkedinLabel,
    summary: doc.summary,
    summaryLines,
    summaryIsList: summaryLines.length > 1,
    positions: doc.positions.map((p) => ({
      id: p.id,
      title: p.title,
      company: p.company,
      location: p.location ?? null,
      start: monthYear(p.startDate),
      end: monthYear(p.endDate),
      dates: `${monthYear(p.startDate)} - ${monthYear(p.endDate)}`,
      bullets: p.bullets.map((b) => ({ id: b.id, text: b.text })),
    })),
    education: doc.education.map((e) => ({
      id: e.id,
      degree: e.degree,
      institution: e.institution,
      location: e.location ?? null,
      years: !doc.hideEducationDates || doc.educationDateIds.includes(e.id) ? yearRange(e.startYear, e.endYear) : "",
    })),
    skills: doc.skills.map((s) => ({ id: s.id, name: s.name })),
    skillsHeading: doc.skillsHeading,
    courseGroups,
    languages: doc.languages,
    languagesText: doc.languages.join(" / "),
    keyAchievements: doc.keyAchievements.map((k) => ({ title: k.title, text: k.text })),
    contactInSidebar: doc.contactInSidebar,
    educationInSidebar: doc.educationInSidebar,
    compactSidebar: doc.compactSidebar,
  };
}

export type TemplateView = ReturnType<typeof buildView>;
