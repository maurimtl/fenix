import { readCareer } from "@/lib/store/career";
import { readAllInterviews } from "@/lib/store/interviews";
import { readAllCvs } from "@/lib/store/cvs";
import { listRecordFiles } from "@/lib/store/files";
import { readLinkedinDraft, readLinkedinProfile } from "@/lib/store/linkedin";
import { isUnreadable, profilePath } from "@/lib/store/paths";
import { getSettings, isPlaceholderRule, listProfileSlugs, NEW_SETTINGS, readProfile } from "@/lib/store/profiles";
import type { Settings } from "@/lib/store/schemas";
import { readAllStories } from "@/lib/store/stories";
import { listTemplates } from "@/lib/templates/registry";
import { prompts } from "./prompts";

export const STORIES_TARGET = 3;

export type StepKey = "career" | "settings" | "stories" | "interviews" | "design" | "linkedin" | "hunt";
export type Step = {
  key: StepKey;
  label: string;
  required: boolean;
  done: boolean;
  /** What's there now, e.g. "2 of 3 stories". */
  detail: string;
  /** Set when the step's files couldn't be read. */
  error?: string;
  prompt: string;
};

/** The full name to put in prompts when the install has more than one person, else null. */
export async function promptWho(profile: string): Promise<string | null> {
  if ((await listProfileSlugs()).length < 2) return null;
  try {
    return (await readProfile(profile)).fullName;
  } catch {
    return profile;
  }
}

async function step(base: Omit<Step, "done" | "detail" | "error">, check: () => Promise<[boolean, string]>): Promise<Step> {
  try {
    const [done, detail] = await check();
    return { ...base, done, detail };
  } catch (e) {
    if (!isUnreadable(e)) throw e;
    return { ...base, done: false, detail: "", error: (e as Error).message.split("\n")[0] };
  }
}

const settingsAnswered = (s: Settings) => !isPlaceholderRule(s.remoteRule) && s.targetTitles.length > 0;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function computeProgress(profile: string): Promise<Step[]> {
  const who = await promptWho(profile);
  return Promise.all([
    step({ key: "career", label: "Your career record", required: true, prompt: prompts.onboard(who) }, async () => {
      const positions = (await readCareer(profile)).data.companies.reduce((n, c) => n + c.positions.length, 0);
      return [positions > 0, plural(positions, "position")];
    }),
    step({ key: "settings", label: "Pay floor, where you can work, target roles", required: true, prompt: prompts.settings(who) }, async () => {
      const s = await getSettings(profile);
      const answered = settingsAnswered(s);
      return [answered, answered ? s.targetTitles.slice(0, 3).join(", ") : "not answered yet"];
    }),
    step({ key: "stories", label: "Career stories (Claude interviews you)", required: true, prompt: prompts.stories(who) }, async () => {
      const n = (await readAllStories(profile)).length;
      return [n >= STORIES_TARGET, n >= STORIES_TARGET ? plural(n, "story", "stories") : `${n} of ${STORIES_TARGET} stories`];
    }),
    step({ key: "interviews", label: "Job interview recordings", required: false, prompt: prompts.interviews(who) }, async () => {
      const n = (await readAllInterviews(profile)).length;
      return [n > 0, plural(n, "interview")];
    }),
    step({ key: "design", label: "A CV design you like", required: false, prompt: prompts.design(who) }, async () => {
      const [templates, cvs, s] = await Promise.all([listTemplates(profile), readAllCvs(profile), getSettings(profile)]);
      const own = templates.filter((t) => t.personal).length;
      const picked = s.defaultTemplate !== NEW_SETTINGS.defaultTemplate || cvs.some((c) => c.data.templateId !== s.defaultTemplate);
      return [own > 0 || picked, own > 0 ? plural(own, "design") + " of your own" : picked ? "picked a built-in design" : "using the default"];
    }),
    step({ key: "linkedin", label: "LinkedIn profile rewrite", required: false, prompt: prompts.linkedin(who) }, async () => {
      const [draft, live] = await Promise.all([readLinkedinDraft(profile), readLinkedinProfile(profile)]);
      const done = draft !== null || Boolean(live.data.headline);
      return [done, draft ? "draft ready" : live.data.headline ? "profile read" : "not started"];
    }),
    step({ key: "hunt", label: "Your first job hunt", required: true, prompt: prompts.hunt(who) }, async () => {
      const n = (await listRecordFiles(profilePath(profile, "jobs"), ".md")).length;
      return [n > 0, plural(n, "job")];
    }),
  ]);
}

/** Setup is pending while a required step before the hunt (career, settings, stories) is open. */
export const setupPending = (steps: Step[]) => steps.some((s) => s.required && s.key !== "hunt" && !s.done);
