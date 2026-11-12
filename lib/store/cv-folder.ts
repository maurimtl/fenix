import { promises as fs } from "node:fs";
import path from "node:path";
import { readAllCvs } from "./cvs";
import { dataRoot } from "./paths";
import { getSettings } from "./profiles";

/**
 * The person's CV folder (settings.cvFolder) gets a copy of every CV PDF the app saves, so the file to attach is easy
 * to find. The PDFs in data/<p>/cvs/ stay the record; the folder is only a convenience, so every function here returns
 * a warning instead of throwing, and a save never fails because of the folder.
 */

/** True when `folder` is inside data/, where copies would land on (and could delete) the records themselves. */
export async function insideData(folder: string): Promise<boolean> {
  const real = async (p: string) => fs.realpath(p).catch(() => path.resolve(p));
  const [root, target] = await Promise.all([real(dataRoot()), real(folder)]);
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The CV folder, or null when unset or when it points inside data/ (refused by the settings route; this covers hand edits). */
export async function resolveFolder(profile: string): Promise<string | null> {
  const folder = (await getSettings(profile)).cvFolder ?? null;
  return folder && !(await insideData(folder)) ? folder : null;
}

const warn = (what: string, e: unknown) => `${what}: ${e instanceof Error ? e.message : String(e)}`;

async function copyInto(folder: string, pdfPath: string): Promise<string | null> {
  try {
    await fs.mkdir(folder, { recursive: true });
    await fs.copyFile(pdfPath, path.join(folder, path.basename(pdfPath)));
    return null;
  } catch (e) {
    return warn(`Couldn't copy the PDF to ${folder}`, e);
  }
}

/** Copies one saved PDF into the folder under the same name. Null when done or when no folder is set. */
export async function copyToFolder(profile: string, pdfPath: string): Promise<string | null> {
  const folder = await resolveFolder(profile);
  return folder ? copyInto(folder, pdfPath) : null;
}

/** Removes a copy, unless another live CV version still names a PDF with that file name. */
export async function removeFromFolder(profile: string, name: string): Promise<string | null> {
  const folder = await resolveFolder(profile);
  if (!folder) return null;
  try {
    if ((await readAllCvs(profile)).some((cv) => cv.data.pdf === name)) return null;
    await fs.rm(path.join(folder, path.basename(name)), { force: true });
    return null;
  } catch (e) {
    return warn(`Couldn't remove the old copy from ${folder}`, e);
  }
}

/** Copies the PDF of every live CV version into the folder (not PDFs of deleted versions). */
export async function syncFolder(profile: string): Promise<{ folder: string | null; copied: number; warnings: string[] }> {
  const folder = await resolveFolder(profile);
  if (!folder) return { folder: null, copied: 0, warnings: [] };
  let copied = 0;
  const warnings: string[] = [];
  for (const cv of await readAllCvs(profile)) {
    if (!cv.data.pdf) continue;
    const file = path.join(path.dirname(cv.file), cv.data.pdf);
    if (!(await fs.stat(file).catch(() => null))) {
      warnings.push(`${cv.data.pdf} is named by ${cv.data.name} but isn't in cvs/`);
      continue;
    }
    const w = await copyInto(folder, file);
    if (w) warnings.push(w);
    else copied++;
  }
  return { folder, copied, warnings };
}
