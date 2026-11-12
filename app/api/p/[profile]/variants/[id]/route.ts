import { NextResponse } from "next/server";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { removeFromFolder } from "@/lib/store/cv-folder";
import { deleteCv, findCv, updateCv } from "@/lib/store/cvs";
import { overridesSchema, type Overrides } from "@/lib/resume/schema";

type Ctx = ProfileParams<{ id: string }>;

// GET /api/p/:profile/variants/:id — name, template and overrides (lets the hunt skill start a draft from an existing CV).
export async function GET(_req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const cv = await findCv(profile, id);
  if (!cv) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { name, templateId, overrides } = cv.data;
  return NextResponse.json({ id, name, templateId, overrides, version: cv.version });
}

// PATCH /api/p/:profile/variants/:id { name?, templateId?, overrides?, version? } — a stale version gets 409.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => ({}))) as { name?: string; templateId?: string; overrides?: unknown; version?: string };
  let overrides: Overrides | undefined;
  if (body.overrides !== undefined) {
    const parsed = overridesSchema.safeParse(body.overrides);
    if (!parsed.success) return NextResponse.json({ error: "invalid overrides", detail: parsed.error.issues }, { status: 400 });
    overrides = parsed.data;
  }
  try {
    const { version } = await updateCv(profile, id, body.version, (d) => {
      if (typeof body.name === "string") d.name = body.name;
      if (typeof body.templateId === "string") d.templateId = body.templateId;
      if (overrides) d.overrides = overrides;
    });
    return NextResponse.json({ ok: true, id, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}

// DELETE /api/p/:profile/variants/:id — also removes the PDF's copy from the CV folder, after the lock.
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  try {
    const pdf = await deleteCv(profile, id);
    const folderWarning = pdf ? await removeFromFolder(profile, pdf) : null;
    return NextResponse.json({ ok: true, folderWarning });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
