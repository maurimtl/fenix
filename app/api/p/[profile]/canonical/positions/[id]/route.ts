import { NextResponse } from "next/server";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { findPosition, updateCareer } from "@/lib/store/career";
import { StoreError } from "@/lib/store/paths";

type Ctx = ProfileParams<{ id: string }>;

// PATCH /api/p/:profile/canonical/positions/:id { title, version? } — edit the canonical (true) title.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => ({}))) as { title?: string; version?: string };
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  try {
    const { version } = await updateCareer(profile, body.version, (c) => {
      const p = findPosition(c, id);
      if (!p) throw new StoreError("not_found", "no such position");
      p.title = body.title!;
    }, "title edited");
    return NextResponse.json({ ok: true, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
