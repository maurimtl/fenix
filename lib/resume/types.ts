// Canonical data as consumed by the pure resolver (decoupled from Prisma types).

export type CanonicalBullet = {
  id: string;
  text: string;
  altText: string | null;
  altCurrency: string | null;
  sortOrder: number;
};

export type CanonicalPosition = {
  id: string;
  companyName: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  bullets: CanonicalBullet[];
};

export type CanonicalEducation = {
  id: string;
  degree: string;
  institution: string;
  location: string | null;
  startYear: number | null;
  endYear: number | null;
};

export type CanonicalSkill = { id: string; name: string };
export type CanonicalCourse = {
  id: string;
  name: string;
  term: string | null;
  provider: string | null;
};

export type CanonicalData = {
  profile: {
    fullName: string;
    headline: string;
    email: string;
    phone: string | null;
    location: string | null;
    summary: string;
    about: string | null;
    linkedin: string | null;
  };
  /** Pre-flattened positions in canonical display order (company, then position). */
  positions: CanonicalPosition[];
  education: CanonicalEducation[];
  skills: CanonicalSkill[];
  courses: CanonicalCourse[];
};

// The resolved, render-ready document. Serialization-safe (dates are ISO strings).

export type ResumeBullet = { id: string; text: string };

export type ResumePosition = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  startDate: string; // ISO
  endDate: string | null; // ISO, null = present
  bullets: ResumeBullet[];
};

export type ResumeDocument = {
  templateId: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  summary: string;
  positions: ResumePosition[];
  education: CanonicalEducation[];
  skills: CanonicalSkill[];
  /** Sidebar heading for the skills block (variant-overridable). */
  skillsHeading: string;
  /** Render Education without graduation years. */
  hideEducationDates: boolean;
  /** Education ids exempt from hideEducationDates. */
  educationDateIds: string[];
  /** Sidebar languages block; empty = not rendered. */
  languages: string[];
  /** Contact details render in the sidebar rather than under the name. */
  contactInSidebar: boolean;
  /** Education renders in the sidebar rather than the main column. */
  educationInSidebar: boolean;
  /** Sidebar stops at its content height; main column goes full width below. */
  compactSidebar: boolean;
  courses: CanonicalCourse[];
  keyAchievements: { title: string; text: string }[];
};
