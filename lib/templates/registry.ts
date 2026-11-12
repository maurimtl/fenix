import { promises as fs } from "node:fs";
import path from "node:path";
import { fromYaml, readText } from "@/lib/store/files";
import { isSlug, profilePath, StoreError } from "@/lib/store/paths";
import { getSettings } from "@/lib/store/profiles";
import type { ResumeDocument } from "@/lib/resume/types";
import { renderLiquid } from "./render";
import { buildView } from "./view";

/** The built-in used when a person's settings name no template that exists. */
export const FALLBACK_TEMPLATE = "plain";

const MAX_FILES = 40;
const MAX_BYTES = 512 * 1024;

/** `features` are optional parts of a CV a design prints, such as "keyAchievements"; the CV editor reads them. */
export type TemplateInfo = { id: string; name: string; description: string; personal: boolean; features: string[] };
type LoadedTemplate = TemplateInfo & { files: Record<string, string>; css: string };

const builtinRoot = () => path.join(process.cwd(), "templates");
const personalRoot = (profile: string) => profilePath(profile, "templates");

async function readInfo(dir: string, id: string, personal: boolean): Promise<TemplateInfo | null> {
  const text = await readText(path.join(dir, "template.yaml"));
  if (text === null) return null;
  const meta = fromYaml(text) as { name?: unknown; description?: unknown; features?: unknown };
  return {
    id,
    name: typeof meta.name === "string" ? meta.name : id,
    description: typeof meta.description === "string" ? meta.description : "",
    personal,
    features: Array.isArray(meta.features) ? meta.features.filter((f): f is string => typeof f === "string") : [],
  };
}

async function scan(root: string, personal: boolean): Promise<TemplateInfo[]> {
  const names = await fs.readdir(root).catch(() => [] as string[]);
  const out: TemplateInfo[] = [];
  for (const id of names.sort()) {
    if (!isSlug(id)) continue;
    const info = await readInfo(path.join(root, id), id, personal);
    if (info) out.push(info);
  }
  return out;
}

/** Built-ins plus the person's own; a personal template replaces a built-in with the same id. */
export async function listTemplates(profile: string): Promise<TemplateInfo[]> {
  const [builtin, personal] = await Promise.all([scan(builtinRoot(), false), scan(personalRoot(profile), true)]);
  const byId = new Map(builtin.map((t) => [t.id, t]));
  for (const t of personal) byId.set(t.id, t);
  return [...byId.values()];
}

async function loadDir(dir: string, info: TemplateInfo): Promise<LoadedTemplate> {
  const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".liquid") || n === "style.css");
  if (names.length > MAX_FILES) throw new StoreError("invalid", `template ${info.id} has more than ${MAX_FILES} files`);
  const files: Record<string, string> = {};
  let css = "";
  let bytes = 0;
  for (const n of names) {
    const text = (await readText(path.join(dir, n))) ?? "";
    bytes += text.length;
    if (n === "style.css") css = text;
    else files[n] = text;
  }
  if (bytes > MAX_BYTES) throw new StoreError("invalid", `template ${info.id} is larger than ${MAX_BYTES / 1024} KB`);
  if (!files["template.liquid"]) throw new StoreError("invalid", `template ${info.id} has no template.liquid`);
  return { ...info, files, css };
}

export async function defaultTemplateId(profile: string): Promise<string> {
  return (await getSettings(profile)).defaultTemplate || FALLBACK_TEMPLATE;
}

/** The template a CV names, else the person's default, else the fallback built-in, else any. */
export async function loadTemplate(profile: string, id: string): Promise<LoadedTemplate> {
  const available = await listTemplates(profile);
  const fallback = await defaultTemplateId(profile);
  const pick =
    available.find((t) => t.id === id) ??
    available.find((t) => t.id === fallback) ??
    available.find((t) => t.id === FALLBACK_TEMPLATE) ??
    available[0];
  if (!pick) throw new StoreError("not_found", "no templates installed");
  const dir = pick.personal ? path.join(personalRoot(profile), pick.id) : path.join(builtinRoot(), pick.id);
  return loadDir(dir, pick);
}

/** A whole HTML page for the print route. The CSS is never run through Liquid, and can't close its own <style>. */
export async function renderDocument(profile: string, doc: ResumeDocument): Promise<string> {
  const t = await loadTemplate(profile, doc.templateId);
  return renderFiles(t.files, t.css, doc);
}

export async function renderFiles(files: Record<string, string>, css: string, doc: ResumeDocument): Promise<string> {
  const body = await renderLiquid(files, "template.liquid", buildView(doc));
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const title = doc.fullName.replace(/[<>&"]/g, "");
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${safeCss}</style></head><body>${body}</body></html>`;
}
