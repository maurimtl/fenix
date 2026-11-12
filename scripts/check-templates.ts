// pnpm check:templates [--base http://localhost:3007]
// 1. Every built-in template renders a sample CV with no missing variables.
// 2. A hostile fixture template proves the guards, through the running app: no script runs in the print page
//    (JS on) or the PDF, HTML in data prints literally, a typo'd variable fails by name, a runaway loop is stopped.
// 3. Every built-in prints the demo person to a PDF that three text extractors read cleanly (scripts/template-parse.ts).
//    Checked on macOS: the designs name macOS fonts, and other fonts wrap differently. Needs uv (brew install uv).
// pnpm check:templates --report <person> <templateId>   prints the parse findings for that person's design; exits 0.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { PDF_OPTIONS } from "../lib/pdf/render";
import { canonicalFromRecords, loadResumeDoc } from "../lib/resume/load";
import { resolve } from "../lib/resume/resolve";
import { fromYaml, toYaml } from "../lib/store/files";
import { dataRoot } from "../lib/store/paths";
import { careerSchema, profileSchema } from "../lib/store/schemas";
import { loadTemplate, renderFiles } from "../lib/templates/registry";
import { buildView } from "../lib/templates/view";
import type { ResumeDocument } from "../lib/resume/types";
import { extract, parseIssues, type ParseExpect } from "./template-parse";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3007";
const PROBE = "zz-tpl-check";
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

const sample: ResumeDocument = {
  templateId: "",
  fullName: "Alex Morgan",
  headline: "Director of Product",
  email: "alex@example.com",
  phone: null,
  location: "Toronto, Canada",
  linkedin: "https://www.linkedin.com/in/example/",
  summary: "Product leader.\nShips things.",
  positions: [
    { id: "p1", company: "Acme", title: "Director of Product", location: null, startDate: "2021-03-01T00:00:00.000Z", endDate: null, bullets: [{ id: "b1", text: "Grew activation 12%." }] },
  ],
  education: [{ id: "e1", degree: "BComm", institution: "McGill", location: null, startYear: null, endYear: 2010 }],
  skills: [{ id: "s1", name: "SQL" }],
  skillsHeading: "Skills",
  hideEducationDates: false,
  educationDateIds: [],
  languages: ["English"],
  contactInSidebar: false,
  educationInSidebar: false,
  compactSidebar: false,
  courses: [{ id: "c1", name: "Growth", term: "2023", provider: "Reforge" }],
  keyAchievements: [],
};

const OUT = path.join(process.cwd(), ".scratch", "check-templates");

let shared: Browser | null = null;
async function printPdf(html: string, file: string) {
  shared ??= await chromium.launch();
  const page = await shared.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await page.pdf({ ...PDF_OPTIONS, path: file });
  } finally {
    await page.close();
  }
}

if (args[0] === "--report") {
  const [, person, templateId] = args;
  if (!person || !templateId) {
    console.error("usage: pnpm check:templates --report <person> <templateId>");
    process.exit(2);
  }
  const doc = await loadResumeDoc(person, "base");
  if (!doc) throw new Error(`no career record for ${person}`);
  const t = await loadTemplate(person, templateId);
  const file = path.join(OUT, `report-${templateId}.pdf`);
  await printPdf(await renderFiles(t.files, t.css, { ...doc, templateId }), file);
  // A person's design has no hand-written expectations, so they come from the document itself.
  const view = buildView(doc);
  const expect: ParseExpect = {
    name: view.fullName,
    email: view.email,
    phone: view.phone,
    linkedinHandle: view.linkedinHandle,
    jobs: view.positions.filter((p) => p.bullets.length).map((p) => ({ title: p.title, dates: p.dates, first: p.bullets[0].text, last: p.bullets.at(-1)!.text })),
  };
  const issues = parseIssues(extract(file), expect);
  console.log(issues.length ? issues.map((i) => `- ${i}`).join("\n") : "no parse issues");
  console.log(`${issues.length} issue(s) in ${person}/${templateId} (${file})`);
  process.exit(0);
}

async function readDir(dir: string) {
  const files: Record<string, string> = {};
  let css = "";
  for (const n of await fs.readdir(dir)) {
    const text = await fs.readFile(path.join(dir, n), "utf8");
    if (n === "style.css") css = text;
    else if (n.endsWith(".liquid")) files[n] = text;
  }
  return { files, css };
}

// 1. Built-ins.
const builtinRoot = path.join(process.cwd(), "templates");
for (const id of (await fs.readdir(builtinRoot).catch(() => [] as string[])).sort()) {
  const { files, css } = await readDir(path.join(builtinRoot, id));
  try {
    const html = await renderFiles(files, css, sample);
    check(`built-in ${id} renders the sample`, html.includes("Alex Morgan"));
  } catch (e) {
    check(`built-in ${id} renders the sample`, false, (e as Error).message);
  }
}

// A personal design is loaded only from its own folder; with no @import it can't pull in a built-in's CSS,
// so changing a built-in can't change anyone's own design.
for (const person of await fs.readdir(dataRoot()).catch(() => [] as string[])) {
  for (const id of await fs.readdir(path.join(dataRoot(), person, "templates")).catch(() => [] as string[])) {
    const css = await fs.readFile(path.join(dataRoot(), person, "templates", id, "style.css"), "utf8").catch(() => "");
    check(`${person}/${id} imports no other stylesheet`, !/@import/i.test(css));
  }
}

// A person whose default names a personal design that was deleted gets the fallback built-in, Plain.
const FALLBACK_PROBE = "zz-tpl-fallback";
try {
  await fs.mkdir(path.join(dataRoot(), FALLBACK_PROBE), { recursive: true });
  await fs.writeFile(path.join(dataRoot(), FALLBACK_PROBE, ".scratch-profile"), "");
  await fs.writeFile(
    path.join(dataRoot(), FALLBACK_PROBE, "profile.yaml"),
    toYaml({ fullName: "Zz Fallback", headline: "x", email: "zz@example.com", summary: "x", settings: { floorUsd: 1, homeCountry: "CA", homeCountryName: "Canada", remoteRule: "any", defaultTemplate: "deleted-design" } }),
  );
  const t = await loadTemplate(FALLBACK_PROBE, "");
  check("a deleted personal default falls back to plain", t.id === "plain", t.id);
} finally {
  await fs.rm(path.join(dataRoot(), FALLBACK_PROBE), { recursive: true, force: true });
}

// 2d, 2e. No server needed.
await renderFiles({ "template.liquid": "{{ nope }}" }, "", sample).then(
  () => check("an undefined variable fails", false, "rendered without error"),
  (e) => check("an undefined variable fails, naming it", /nope/.test((e as Error).message), (e as Error).message),
);
const t0 = Date.now();
await renderFiles({ "template.liquid": "{% for i in (1..30000) %}{% for j in (1..30000) %}{% endfor %}{% endfor %}" }, "", sample).then(
  () => check("a runaway loop is stopped", false, "it finished"),
  (e) => check(`a runaway loop is stopped (${((Date.now() - t0) / 1000).toFixed(1)}s: ${(e as Error).message})`, Date.now() - t0 < 6_500, (e as Error).message),
);

// 2a-2c. Through the running app, with a throwaway person whose default template is the hostile fixture.
const dir = path.join(dataRoot(), PROBE);
try {
  await fs.mkdir(path.join(dir, "templates"), { recursive: true });
  await fs.cp(path.join(process.cwd(), "scripts/fixtures/hostile-template"), path.join(dir, "templates/hostile"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "profile.yaml"),
    toYaml({
      fullName: "Zz Template Check", headline: "Check", email: "zz@example.com", summary: "Check.",
      settings: { floorUsd: 1, homeCountry: "CA", homeCountryName: "Canada", remoteRule: "any", defaultTemplate: "hostile" },
    }),
  );
  await fs.writeFile(
    path.join(dir, "career.yaml"),
    toYaml({
      companies: [{ id: "c1", name: "Acme", positions: [{ id: "p1", title: "Lead", startDate: "2020-01-01", bullets: [{ id: "b1", text: "<b>x</b> & more" }] }] }],
      education: [], skills: [], courses: [],
    }),
  );

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: true });
    const res = await page.goto(`${BASE}/print/${PROBE}/base`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.body.innerText);
    check("print page loads", res?.status() === 200, `status ${res?.status()}`);
    check("print page sends script-src 'none'", /script-src 'none'/.test(res?.headers()["content-security-policy"] ?? ""));
    check("no script runs in the print page (JS on)", !text.includes("SCRIPT-RAN"));
    check("HTML in data prints literally", text.includes("<b>x</b> & more"));
  } finally {
    await browser.close();
  }

  const pdf = Buffer.from(await (await fetch(`${BASE}/api/p/${PROBE}/cv/base/pdf`)).arrayBuffer());
  const pdfFile = path.join(process.cwd(), ".scratch", "check-templates.pdf");
  await fs.mkdir(path.dirname(pdfFile), { recursive: true });
  await fs.writeFile(pdfFile, pdf);
  const pdfText = execFileSync("pdftotext", [pdfFile, "-"], { encoding: "utf8" });
  check("no script runs in the PDF", pdfText.includes("Zz Template Check") && !pdfText.includes("SCRIPT-RAN"));
  check("HTML in data prints literally in the PDF", pdfText.includes("<b>x</b> & more"));
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}

// 3. Parse rules on the demo person. Expectations are literals, so a formatting bug can't pass its own test.
const DEMO = path.join(process.cwd(), "examples", "demo");
const demoCanonical = canonicalFromRecords(
  profileSchema.parse(fromYaml(await fs.readFile(path.join(DEMO, "profile.yaml"), "utf8"))),
  careerSchema.parse(fromYaml(await fs.readFile(path.join(DEMO, "career.yaml"), "utf8"))),
);
const DEMO_EXPECT: ParseExpect = {
  name: "Alex Morgan",
  email: "alex.morgan@example.com",
  phone: "416-555-0142",
  linkedinHandle: "example-alex-morgan",
  jobs: [
    { title: "Director of Product, Growth", dates: "Apr 2022 - Present", first: "Lifted trial-to-paid conversion", last: "Redesigned pricing into three plans" },
    { title: "Senior Product Manager", dates: "Sep 2019 - Mar 2022", first: "Shipped 12 integrations in 18 months", last: "Cut first-90-day churn from 7%" },
    { title: "Product Manager", dates: "Jan 2018 - Aug 2019", first: "Led the dashboard builder rewrite", last: "Ran 60 customer interviews a year" },
    { title: "Associate Product Manager", dates: "Jun 2016 - Dec 2017", first: "Shipped scheduled email reports", last: "Rewrote the setup guide with" },
    { title: "Business Analyst", dates: "Jan 2015 - May 2016", first: "Built the weekly sales forecast", last: "Measured the loyalty program's" },
    { title: "Junior Business Analyst", dates: "May 2013 - Dec 2014", first: "Replaced 14 hand-built spreadsheets", last: "Replaced 14 hand-built spreadsheets" },
  ],
};
const KEY_ACHIEVEMENTS = [
  { title: "Trial-to-paid", text: "Lifted trial-to-paid from 9% to 13% in a year." },
  { title: "First growth team", text: "Built a team of 2 PMs, 6 engineers and 1 designer." },
  { title: "Pricing", text: "Raised revenue per account 18% with three plans." },
];
const features = async (id: string) => {
  const meta = fromYaml(await fs.readFile(path.join(builtinRoot, id, "template.yaml"), "utf8")) as { features?: string[] };
  return meta.features ?? [];
};
const SIDE: Record<string, string[]> = { sidebar: ["Experiment design", "Pricing & packaging", "McGill University", "Growth Series"] };
for (const id of (await fs.readdir(builtinRoot)).sort()) {
  const { files, css } = await readDir(path.join(builtinRoot, id));
  const file = path.join(OUT, `${id}.pdf`);
  try {
    await printPdf(await renderFiles(files, css, resolve(demoCanonical, {}, id)), file);
    const issues = parseIssues(extract(file), { ...DEMO_EXPECT, side: SIDE[id] });
    check(`built-in ${id} parses cleanly`, issues.length === 0, issues.join("; "));
    if ((await features(id)).includes("keyAchievements")) {
      const kaFile = path.join(OUT, `${id}-key-achievements.pdf`);
      await printPdf(await renderFiles(files, css, resolve(demoCanonical, { keyAchievements: KEY_ACHIEVEMENTS }, id)), kaFile);
      const present = KEY_ACHIEVEMENTS.flatMap((k) => [k.title, k.text]);
      const kaIssues = parseIssues(extract(kaFile), { ...DEMO_EXPECT, side: SIDE[id], present });
      check(`built-in ${id} prints Key achievements and still parses cleanly`, kaIssues.length === 0, kaIssues.join("; "));
    }
  } catch (e) {
    check(`built-in ${id} parses cleanly`, false, (e as Error).message);
  }
}

// Sidebar: a long LinkedIn handle wraps inside the side column instead of running into the main column.
{
  const { files, css } = await readDir(path.join(builtinRoot, "sidebar"));
  const html = await renderFiles(files, css, { ...sample, linkedin: "https://www.linkedin.com/in/alexandra-montgomery-richardson-4821937/?trk=public" });
  shared ??= await chromium.launch();
  const page = await shared.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const over = await page.evaluate(() => {
    const side = document.querySelector(".side")!.getBoundingClientRect();
    return [...document.querySelectorAll(".contact span")].some((s) => s.getBoundingClientRect().right > side.right + 0.5);
  });
  await page.close();
  check("sidebar: a long LinkedIn handle stays inside the side column", !over);
}

// Gutter: every date range comes out on one line, exactly as printed, in all three extractors.
{
  const texts = extract(path.join(OUT, "gutter.pdf"));
  const split = DEMO_EXPECT.jobs.flatMap((j) =>
    (Object.entries(texts) as [string, string][]).filter(([, x]) => !x.split("\n").some((l) => l.includes(j.dates))).map(([tool]) => `${tool}: ${j.dates}`),
  );
  check("gutter: every date range is on one line", split.length === 0, split.join("; "));
}

// Executive on a long career: two or more pages, the name and page number on page 2 only, and no job title or
// company line left at the bottom of a page apart from its bullets.
const longDoc = (fullName: string): ResumeDocument => ({
  ...sample,
  templateId: "executive",
  fullName,
  email: "long@example.com",
  linkedin: null,
  summary: "Product executive with a long career.",
  keyAchievements: KEY_ACHIEVEMENTS,
  positions: Array.from({ length: 10 }, (_, i) => ({
    id: `r${i}`,
    company: `Company ${i + 1}`,
    title: `Role ${i + 1} title`,
    location: "Toronto",
    startDate: `${2020 - i}-01-01T00:00:00.000Z`,
    endDate: `${2020 - i}-12-31T00:00:00.000Z`,
    bullets: Array.from({ length: 4 }, (_, j) => ({ id: `r${i}b${j}`, text: `Bullet ${j + 1} of role ${i + 1}, long enough to read like a real line about the work and the result it had.` })),
  })),
});
{
  const { files, css } = await readDir(path.join(builtinRoot, "executive"));
  const file = path.join(OUT, "executive-long.pdf");
  await printPdf(await renderFiles(files, css, longDoc("Pat Long")), file);
  const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [file], { encoding: "utf8" }))![1]);
  check(`executive: a 10-role career prints on 2 or more pages (${pages})`, pages >= 2);
  const pageText = (n: number) => execFileSync("pdftotext", ["-f", String(n), "-l", String(n), file, "-"], { encoding: "utf8" });
  check("executive: page 1 shows the name once (no page header)", pageText(1).split("Pat Long").length - 1 === 1);
  check("executive: page 2 shows the name and its page number", pageText(2).includes("Pat Long") && pageText(2).includes(`Page 2 of ${pages}`));
  const texts = extract(file);
  const missing = KEY_ACHIEVEMENTS.flatMap((k) => [k.title, k.text]).filter((s) => !Object.values(texts).every((x) => x.replace(/\s+/g, " ").includes(s)));
  check("executive: Key achievements print in all three extractors", missing.length === 0, missing.join("; "));
  const isHead = (l: string) => /^Role \d+ title$/.test(l) || /^Company \d+, /.test(l);
  const lines = (n: number) => pageText(n).split("\n").map((l) => l.trim()).filter((l) => l && l !== "Pat Long" && !/^Page \d+ of \d+$/.test(l));
  const stranded: string[] = [];
  for (let n = 1; n < pages; n++) {
    if (isHead(lines(n).at(-1)!)) stranded.push(`page ${n} ends on "${lines(n).at(-1)}"`);
    if (/^Company \d+, /.test(lines(n + 1)[0])) stranded.push(`page ${n + 1} starts on "${lines(n + 1)[0]}"`);
  }
  check("executive: no job title or company line stranded at a page break", stranded.length === 0, stranded.join("; "));
  const oddFile = path.join(OUT, "executive-odd-name.pdf");
  await printPdf(await renderFiles(files, css, longDoc('Zoë "Q" O\'Neil\\')), oddFile);
  const odd = execFileSync("pdftotext", ["-f", "2", "-l", "2", oddFile, "-"], { encoding: "utf8" });
  check("executive: a name with quotes and a backslash prints intact on page 2", odd.includes('Zoë "Q" O\'Neil\\'), odd.split("\n")[0]);
}

await shared?.close();
for (const [name, ok, detail] of results) console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => !r[1]).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
