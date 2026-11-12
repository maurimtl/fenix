// pnpm check:public — lists every file in the app repo (tracked or not ignored) that names a person who has a
// profile in data/: their name, email, phone or LinkedIn handle, read from data/*/profile.yaml. Reads only.
// The term list comes from the profiles, so it never ships. Exit 1 when anything is found.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { listProfileSlugs, readProfile } from "../lib/store/profiles";

const terms = new Set<string>();
for (const slug of await listProfileSlugs()) {
  const p = await readProfile(slug);
  for (const part of p.fullName.split(/\s+/)) if (part.length >= 4) terms.add(part.toLowerCase());
  if (p.email) {
    terms.add(p.email.toLowerCase());
    terms.add(p.email.split("@")[0].toLowerCase());
  }
  const digits = (p.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) terms.add(digits.slice(-7));
  const handle = p.linkedin?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
  if (handle) terms.add(handle.toLowerCase());
}
if (terms.size === 0) {
  console.log("no profiles in data/: nothing to check against");
  process.exit(0);
}

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Phone digits may be split by spaces, dots or dashes in text.
const patterns = [...terms].map((t) =>
  /^\d+$/.test(t) ? new RegExp(t.split("").join("[\\s.()-]*")) : new RegExp(escape(t), "i"),
);

let hits = 0;
for (const f of files) {
  const st = await fs.stat(f).catch(() => null);
  if (!st?.isFile() || st.size > 2_000_000) continue;
  const buf = await fs.readFile(f);
  if (buf.includes(0)) continue;
  const lines = buf.toString("utf8").split("\n");
  for (const [i, line] of lines.entries()) {
    if (patterns.some((re) => re.test(line))) {
      hits++;
      console.log(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`);
    }
  }
  if (patterns.some((re) => re.test(f))) {
    hits++;
    console.log(`${f}: (file name)`);
  }
}
console.log(`${hits} hit(s) in ${files.length} files, ${terms.size} terms from data/*/profile.yaml`);
process.exit(hits ? 1 : 0);
