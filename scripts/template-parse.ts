// What a CV PDF looks like to the text extractors applicant tracking systems build on, and the rules a design must pass.
import { execFileSync } from "node:child_process";

export type Texts = { pdftotext: string; pdfminer: string; pypdf: string };

export type JobExpect = { title: string; dates: string; first: string; last: string };
export type ParseExpect = {
  name: string;
  email: string;
  phone: string | null;
  linkedinHandle: string | null;
  jobs: JobExpect[];
  /** Side-column strings (two-column designs): none may land inside a job, and pypdf must read the name first. */
  side?: string[];
  /** Strings every extractor must find, such as Key achievements. */
  present?: string[];
};

const PDFMINER = "pdfminer.six==20260107";
const PYPDF = "pypdf==7.0.1";
const PYPDF_SCRIPT = "import sys,pypdf\nr=pypdf.PdfReader(sys.argv[1])\nprint('\\n'.join(p.extract_text() or '' for p in r.pages))";

function uvx(args: string[]): string {
  try {
    return execFileSync("uvx", ["-q", ...args], { encoding: "utf8", timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error("uvx not found: install uv (brew install uv)");
    throw e;
  }
}

export function extract(pdf: string): Texts {
  return {
    pdftotext: execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" }),
    pdfminer: uvx(["--from", PDFMINER, "pdf2txt.py", pdf]),
    pypdf: uvx(["--with", PYPDF, "python", "-c", PYPDF_SCRIPT, pdf]),
  };
}

const flat = (s: string) => s.replace(/[‐-―]/g, "-").replace(/\s+/g, " ");
const head = (s: string) => flat(s).slice(0, 28);

export function parseIssues(texts: Texts, expect: ParseExpect): string[] {
  const issues: string[] = [];
  for (const [tool, raw] of Object.entries(texts) as [keyof Texts, string][]) {
    const say = (m: string) => issues.push(`${tool}: ${m}`);
    const text = flat(raw);
    const spaced = raw.match(/(?<!\p{L})(?:\p{L} ){3,}\p{L}(?!\p{L})/u);
    if (spaced) say(`letter-spaced text "${spaced[0]}"`);
    const lig = raw.match(/[ﬀ-ﬆ]/);
    if (lig) say(`ligature character U+${lig[0].codePointAt(0)!.toString(16).toUpperCase()}`);
    for (const [what, value] of [["email", expect.email], ["phone", expect.phone], ["LinkedIn handle", expect.linkedinHandle]] as const) {
      if (value && !text.includes(value)) say(`${what} "${value}" not intact`);
    }
    for (const s of expect.present ?? []) if (!text.includes(flat(s))) say(`"${s}" missing`);

    // `pos` is where the previous job's last bullet starts; a missing job is reported and the next is searched from there.
    let pos = 0;
    for (const job of expect.jobs) {
      const ti = text.indexOf(job.title, pos);
      if (ti < 0) {
        say(`job "${job.title}" missing or out of order`);
        continue;
      }
      const fb = text.indexOf(head(job.first), ti);
      if (fb < 0) {
        say(`first bullet of "${job.title}" not after its title`);
        continue;
      }
      const lb = job.last === job.first ? fb : text.indexOf(head(job.last), fb);
      const di = text.indexOf(job.dates, pos);
      if (di < 0 || di > fb) say(`dates "${job.dates}" not between the previous job and "${job.title}"'s first bullet`);
      for (const s of expect.side ?? []) {
        const si = text.indexOf(s, ti);
        if (si >= 0 && si < Math.max(lb, fb)) say(`side text "${s}" inside job "${job.title}"`);
      }
      pos = Math.max(lb, fb);
    }
    if (tool === "pypdf" && expect.side?.length) {
      const ni = text.indexOf(expect.name);
      const firstSide = Math.min(...expect.side.map((s) => text.indexOf(s)).filter((i) => i >= 0));
      if (ni < 0 || ni > firstSide) say("reads the side column before the name");
    }
  }
  return issues;
}
