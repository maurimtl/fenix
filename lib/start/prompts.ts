// What a person tells Claude for each step. One place, so the same request reads the same on every page.

/** With several people on one install, the skills need to know who; `who` is the full name then, else null. */
const forWho = (who: string | null, text: string) => (who ? `For ${who}: ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text);

export const prompts = {
  onboard: (who: string | null) => forWho(who, "Set me up in Fenix. Here's my CV (I'll attach the PDF) or my LinkedIn profile link."),
  settings: (who: string | null) => forWho(who, "Ask me the Fenix settings questions: pay floor, where I can work and the roles I want."),
  stories: (who: string | null) => forWho(who, "Interview me for a career story."),
  interviews: (who: string | null) => forWho(who, "Review my last job interview. The recording is in Fellow, or I'll paste the transcript."),
  design: (who: string | null) => forWho(who, "Make a CV design from this screenshot."),
  linkedin: (who: string | null) => forWho(who, "Read my LinkedIn profile and draft a rewrite."),
  hunt: (who: string | null) => forWho(who, "Find me jobs."),
  banner: (who: string | null) => forWho(who, "Update my LinkedIn banner."),
  cvForJob: (who: string | null) => forWho(who, "Make a CV for this job: <paste the job link>"),
  apply: (who: string | null, company: string, title: string) => forWho(who, `Help me apply to ${company}, ${title}.`),
  brief: (who: string | null, company: string) => forWho(who, `Brief me for my next interview at ${company}.`),
};
