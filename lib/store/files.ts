import { createHash, randomBytes } from "node:crypto";
import { promises as fs, constants as fsc } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { StoreError } from "./paths";

// YAML 1.1 output quotes no/on/yes, dates and 007, so any YAML reader keeps them as strings.
const STRINGIFY = { version: "1.1", lineWidth: 0 } as const;

export function toYaml(data: unknown): string {
  return YAML.stringify(data, STRINGIFY);
}

export function fromYaml(text: string): unknown {
  return YAML.parse(text) ?? {};
}

export type FrontMatterDoc = { data: Record<string, unknown>; body: string };

export function parseFrontMatter(text: string): FrontMatterDoc {
  const norm = text.replace(/^﻿/, "");
  if (!norm.startsWith("---\n") && norm !== "---") return { data: {}, body: norm };
  const end = norm.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: norm };
  const after = norm.indexOf("\n", end + 4);
  const yamlText = norm.slice(4, end + 1);
  const body = after === -1 ? "" : norm.slice(after + 1);
  const data = fromYaml(yamlText);
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new StoreError("invalid", "front matter is not a mapping");
  }
  return { data: data as Record<string, unknown>, body };
}

export function stringifyFrontMatter(doc: FrontMatterDoc): string {
  // The body is stored byte-for-byte so it round-trips exactly (no trailing newline is added).
  return `---\n${toYaml(doc.data)}---\n${doc.body}`;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export async function readText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Atomic replace: fsynced dotfile temp in the same directory, then rename. */
export async function writeAtomic(file: string, text: string | Uint8Array): Promise<void> {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${randomBytes(4).toString("hex")}.tmp`);
  const fh = await fs.open(tmp, "w");
  try {
    await fh.writeFile(text);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await fs.rename(tmp, file);
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
}

/** Replace only if the file still has the content the caller read (null = must not exist). */
export async function writeIfUnchanged(file: string, text: string, expectedHash: string | null): Promise<void> {
  const current = await readText(file);
  const currentHash = current === null ? null : hashText(current);
  if (currentHash !== expectedHash) {
    throw new StoreError("stale", `${path.basename(file)} changed since it was read`);
  }
  await writeAtomic(file, text);
}

/** Create a new file; throws StoreError("exists") if it is already there (O_EXCL). */
export async function createExclusive(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  let fh;
  try {
    fh = await fs.open(file, fsc.O_WRONLY | fsc.O_CREAT | fsc.O_EXCL);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") {
      throw new StoreError("exists", `${path.basename(file)} already exists`);
    }
    throw e;
  }
  try {
    await fh.writeFile(text, "utf8");
    await fh.sync();
  } finally {
    await fh.close();
  }
}

/** Record files in a directory with the given extension, skipping dotfiles; [] if the dir is missing. */
export async function listRecordFiles(dir: string, ext: string): Promise<string[]> {
  try {
    const names = await fs.readdir(dir);
    return names
      .filter((n) => !n.startsWith(".") && n.endsWith(ext))
      .sort()
      .map((n) => path.join(dir, n));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/** Today as YYYY-MM-DD on this machine's clock (toISOString would give the UTC date, a day ahead in the evening west of UTC). */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
