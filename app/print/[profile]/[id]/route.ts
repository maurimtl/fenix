import { loadResumeDoc } from "@/lib/resume/load";
import { getPreview } from "@/lib/pdf/preview-store";
import { apiProfile } from "@/lib/http";
import { listTemplates, renderDocument } from "@/lib/templates/registry";
import { TemplateError } from "@/lib/templates/render";
import type { ResumeDocument } from "@/lib/resume/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Templates may come from a person or a model: the page may never run script, load remote files, or post a form.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; form-action 'none'; base-uri 'none'";

// GET /print/:profile/:id — the bare CV page Playwright prints. `base` = career record (optionally `?template=<id>`),
// `pv_*` = an unsaved editor preview, anything else a CV version id.
export async function GET(req: Request, { params }: { params: Promise<{ profile: string; id: string }> }) {
  const { profile: slug, id } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return new Response("Not found", { status: 404 });
  const doc: ResumeDocument | null = id.startsWith("pv_") ? getPreview(profile, id) : await loadResumeDoc(profile, id);
  if (!doc) return new Response("Not found", { status: 404 });
  // `?template=` previews the career record in another design (the Designs page); never a silent fallback.
  const template = new URL(req.url).searchParams.get("template");
  if (template !== null && id === "base") {
    if (!(await listTemplates(profile)).some((t) => t.id === template)) return new Response("No such design", { status: 404 });
    doc.templateId = template;
  }
  try {
    const html = await renderDocument(profile, doc);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": CSP, "cache-control": "no-store" },
    });
  } catch (e) {
    if (e instanceof TemplateError) return new Response(`Template error: ${e.message}`, { status: 500 });
    throw e;
  }
}
