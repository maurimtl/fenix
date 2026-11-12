// pnpm get-started: installs the libraries, then sets up this computer. Safe to run again: each step is skipped when it's already done.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { dataRoot } from "../lib/store/paths";

const root = dataRoot();
const done: string[] = [];
const exists = (p: string) => fs.stat(p).then(() => true, () => false);
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

await fs.mkdir(root, { recursive: true });

if (!(await exists(path.join(root, ".git")))) {
  git("init", "-q");
  done.push(`made ${root} a git repo (your data's history; never part of the app repo)`);
}

// Lock folders, temp files and the regenerable banner export never belong in a person's history.
const IGNORE = [".lock/", ".lock.stale-*/", "*.tmp", ".DS_Store", "*/linkedin/banner.png"];
const ignoreFile = path.join(root, ".gitignore");
const ignored = (await fs.readFile(ignoreFile, "utf8").catch(() => "")).split("\n");
const missing = IGNORE.filter((l) => !ignored.includes(l));
if (missing.length) {
  await fs.appendFile(ignoreFile, (ignored.at(-1) === "" ? "" : "\n") + missing.join("\n") + "\n");
  git("add", ".gitignore");
  git("commit", "-q", "-m", "data: ignore lock folders, temp files and banner exports", "--", ".gitignore");
  done.push(`data/.gitignore: added ${missing.join(", ")}`);
}

const demo = path.join(root, "demo");
if (!(await exists(demo))) {
  await fs.cp(path.join(process.cwd(), "examples", "demo"), demo, { recursive: true });
  git("add", "-A", "--", "demo/");
  git("commit", "-q", "-m", "demo: example person", "--", "demo/");
  done.push("added the demo person (data/demo/), so there is something to click through");
}

const env = path.join(process.cwd(), ".env");
if (!(await exists(env))) {
  await fs.copyFile(path.join(process.cwd(), ".env.example"), env);
  done.push("created .env from .env.example");
}

// Playwright skips the download when this browser version is already installed.
const before = execFileSync("pnpm", ["exec", "playwright", "install", "--dry-run", "chromium"], { encoding: "utf8" });
const browserDir = before.match(/Install location:\s+(\S+)/)?.[1];
if (!browserDir || !(await exists(browserDir))) {
  execFileSync("pnpm", ["exec", "playwright", "install", "chromium"], { stdio: "inherit" });
  done.push("installed the Chromium that prints PDFs");
}

console.log(done.length ? done.map((d) => `- ${d}`).join("\n") : "Nothing to do: setup is already complete.");

if (!git("remote")) {
  console.log(
    [
      "",
      "Your data is only on this computer. To back it up, create a PRIVATE repository (for example on GitHub) and run:",
      `  git -C ${root} remote add origin <your private repo URL>`,
      `  git -C ${root} push -u origin HEAD`,
      "After that, `pnpm backup` commits and pushes it.",
    ].join("\n"),
  );
}
console.log("\nNext: pnpm dev, then open http://localhost:3007");
