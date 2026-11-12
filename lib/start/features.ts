import { prompts } from "./prompts";

/** One row per thing Fenix does, for Home's "What Fenix can do": the page it lives on and what to tell Claude. */
export const FEATURES: { label: string; what: string; href: string; prompt: (who: string | null) => string }[] = [
  { label: "Find jobs", what: "LinkedIn, job boards and the companies you follow, checked against your pay floor and where you can work.", href: "/jobs", prompt: prompts.hunt },
  { label: "A CV for a job", what: "A tailored version of your CV for one posting, with only numbers you can back up.", href: "/variants", prompt: prompts.cvForJob },
  { label: "Apply", what: "Claude fills the application form in your Chrome from your answers; you click Submit.", href: "/jobs", prompt: (who) => prompts.apply(who, "<company>", "<role>") },
  { label: "Interviews", what: "A brief before each round and a review after it, from your recording or a transcript.", href: "/interviews", prompt: prompts.interviews },
  { label: "Career stories", what: "The context behind your results, and where each number comes from.", href: "/stories", prompt: prompts.stories },
  { label: "LinkedIn", what: "A rewrite of your headline, About and roles, and a banner image.", href: "/linkedin", prompt: prompts.linkedin },
  { label: "CV designs", what: "Pick a built-in design, or have Claude build one from a screenshot of a CV you like.", href: "/designs", prompt: prompts.design },
];
