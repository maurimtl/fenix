import { z } from "zod";

/** Per-bullet delta (keyed by canonical bullet id). */
export const bulletOverrideSchema = z.object({
  reworded: z.string().optional(),
  hidden: z.boolean().optional(),
});

/**
 * Per-position override. Two inclusion modes (see "CV versions" in docs/architecture.md):
 * - `reflow` (default): bullets shown-by-default; deltas only. New canonical bullets auto-appear.
 * - `curated`: explicit ordered `includedBulletIds` snapshot. New canonical bullets do NOT appear.
 */
export const positionOverrideSchema = z.object({
  titleOverride: z.string().optional(),
  hidden: z.boolean().optional(),
  mode: z.enum(["reflow", "curated"]).default("reflow"),
  includedBulletIds: z.array(z.string()).optional(),
  bullets: z.record(z.string(), bulletOverrideSchema).default({}),
});

export const overridesSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  /** Subset + order of skills to show; undefined = all canonical skills. */
  skillIds: z.array(z.string()).optional(),
  /** Sidebar skills heading; undefined = template default ("Tools & Stack"). */
  skillsHeading: z.string().optional(),
  /** Drop graduation years from Education (canonical keeps them). */
  hideEducationDates: z.boolean().optional(),
  /** Education ids that keep their year even when hideEducationDates is set. */
  educationDateIds: z.array(z.string()).optional(),
  /** Header location line; undefined = canonical profile location. */
  location: z.string().optional(),
  /** Languages block in the sidebar; undefined/empty = not rendered. */
  languages: z.array(z.string()).optional(),
  /** Subset + order of courses to show; undefined = all canonical courses. */
  courseIds: z.array(z.string()).optional(),
  /** Move phone/email/location/LinkedIn into the sidebar. */
  contactInSidebar: z.boolean().optional(),
  /** Render Education in the sidebar instead of the main column. */
  educationInSidebar: z.boolean().optional(),
  /**
   * End the sidebar where its content ends instead of running it the full page
   * height, so the main column reclaims full width below it. Buys ~50% more
   * text per line for the back half of page 1.
   */
  compactSidebar: z.boolean().optional(),
  /** Which bullet text to prefer when a bullet has a currency alternate. */
  currency: z.string().default("USD"),
  hiddenPositionIds: z.array(z.string()).optional(),
  /** Reorder positions by id; ids omitted keep canonical order after the listed ones. */
  positionOrder: z.array(z.string()).optional(),
  positions: z.record(z.string(), positionOverrideSchema).default({}),
  /** Short titled results shown near the top by designs whose template.yaml lists the keyAchievements feature. */
  keyAchievements: z
    .array(z.object({ title: z.string().trim().min(1).max(60), text: z.string().trim().min(1).max(200) }))
    .max(4)
    .optional(),
});

export type Overrides = z.infer<typeof overridesSchema>;
export type PositionOverride = z.infer<typeof positionOverrideSchema>;

/** Parse unknown JSON (from the DB) into a validated Overrides, tolerating {} / null. */
export function parseOverrides(raw: unknown): Overrides {
  return overridesSchema.parse(raw ?? {});
}
