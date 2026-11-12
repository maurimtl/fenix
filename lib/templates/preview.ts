import { APP_URL } from "@/lib/app-url";
import { renderPng } from "@/lib/pdf/render";
import { readCareer, readProfileVersioned } from "@/lib/store/career";
import { hashText } from "@/lib/store/files";
import { StoreError } from "@/lib/store/paths";
import { listTemplates, loadTemplate } from "./registry";

const MAX_ENTRIES = 32;
// Promises, so a second request for the same preview waits for the render already running instead of starting one.
const cache = new Map<string, Promise<Buffer>>();

/** Page 1 of the person's career record in one design, as a PNG. Re-rendered only when the design or record changes. */
export async function designPreview(profile: string, id: string): Promise<Buffer> {
  if (!(await listTemplates(profile)).some((t) => t.id === id)) throw new StoreError("not_found", `no design named ${id}`);
  const [t, career, person] = await Promise.all([loadTemplate(profile, id), readCareer(profile), readProfileVersioned(profile)]);
  const key = [profile, id, hashText(JSON.stringify([t.files, t.css])), career.version, person.version].join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const png = renderPng(`${APP_URL}/print/${profile}/base?template=${encodeURIComponent(id)}`);
  cache.set(key, png);
  png.catch(() => cache.delete(key));
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return png;
}
