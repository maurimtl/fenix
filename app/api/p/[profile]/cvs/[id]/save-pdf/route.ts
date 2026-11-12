import path from "node:path";
import { NextResponse } from "next/server";
import { renderPdf } from "@/lib/pdf/render";
import { APP_URL } from "@/lib/app-url";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { copyToFolder, removeFromFolder } from "@/lib/store/cv-folder";
import { findCv, pdfFileName, updateCvLocked } from "@/lib/store/cvs";
import { withProfileLock } from "@/lib/store/lock";
import { writeAtomic } from "@/lib/store/files";
import { commitProfile } from "@/lib/store/history";
import { readProfile } from "@/lib/store/profiles";
import { StoreError } from "@/lib/store/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = ProfileParams<{ id: string }>;

// POST /api/p/:profile/cvs/:id/save-pdf — renders the CV and saves it next to its file as the PDF to send.
// Rendering happens outside the profile lock (it takes seconds); writing the PDF and the `pdf:` field happens inside it.
// The copy to the person's CV folder happens after the lock, so a slow synced folder never holds it.
export async function POST(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  try {
    const [cv, person] = await Promise.all([findCv(profile, id), readProfile(profile)]);
    if (!cv) throw new StoreError("not_found", "no such CV");
    const pdf = await renderPdf(`${APP_URL}/print/${profile}/${id}`);
    const name = pdfFileName(person.settings.cvFileName, person.fullName, cv.data.name);
    const file = path.join(path.dirname(cv.file), name);
    let previous: string | null = null;
    const { version } = await withProfileLock(profile, async () => {
      await writeAtomic(file, pdf);
      const r = await updateCvLocked(profile, id, undefined, (d) => {
        previous = d.pdf ?? null;
        d.pdf = name;
      });
      await commitProfile(profile, `CV ${cv.data.name} PDF saved`, [file, cv.file]);
      return r;
    });
    const old: string | null = previous;
    const folderWarning =
      (await copyToFolder(profile, file)) ?? (old && old !== name ? await removeFromFolder(profile, old) : null);
    return NextResponse.json({ pdf: name, bytes: pdf.length, version, folderWarning });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
