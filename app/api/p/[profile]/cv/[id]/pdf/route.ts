import { findCv, pdfFileName } from "@/lib/store/cvs";
import { readProfile } from "@/lib/store/profiles";
import { renderPdf } from "@/lib/pdf/render";
import { APP_URL } from "@/lib/app-url";
import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = ProfileParams<{ id: string }>;

// GET /api/p/:profile/cv/:id/pdf — render the résumé to PDF.
// Inline by default (so it can be embedded in a preview iframe); `?dl=1` downloads.
export async function GET(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();

  const person = await readProfile(profile);
  let label = "CV";
  if (id !== "base") {
    const cv = await findCv(profile, id);
    if (!cv) return new Response("Not found", { status: 404 });
    label = cv.data.name;
  }

  try {
    const pdf = await renderPdf(`${APP_URL}/print/${profile}/${id}`);
    const download = new URL(req.url).searchParams.get("dl") === "1";
    const filename = pdfFileName(person.settings.cvFileName, person.fullName, label);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF render failed";
    return new Response(`PDF render failed: ${message}`, { status: 500 });
  }
}
