import { renderPdf } from "@/lib/pdf/render";
import { APP_URL } from "@/lib/app-url";
import { putPreview } from "@/lib/pdf/preview-store";
import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";
import type { ResumeDocument } from "@/lib/resume/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/p/:profile/preview-pdf { doc } — render an (unsaved) resolved document to an
// inline PDF for the live editor preview, via a short-lived print token.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => ({}))) as { doc?: ResumeDocument };
  if (!body.doc || typeof body.doc !== "object") {
    return new Response("Missing doc", { status: 400 });
  }
  try {
    const token = putPreview(profile, body.doc);
    const pdf = await renderPdf(`${APP_URL}/print/${profile}/${token}`);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF render failed";
    return new Response(`PDF render failed: ${message}`, { status: 500 });
  }
}
