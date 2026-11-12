import { NextResponse } from "next/server";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { findBullet, updateCareer } from "@/lib/store/career";
import { StoreError } from "@/lib/store/paths";

type Ctx = ProfileParams<{ id: string }>;

// PATCH /api/p/:profile/canonical/bullets/:id { text?, altText?, altCurrency?, version? } — edit text and/or currency alternate.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => ({}))) as { text?: string; altText?: string; altCurrency?: string; version?: string };
  try {
    const { version } = await updateCareer(profile, body.version, (c) => {
      const hit = findBullet(c, id);
      if (!hit) throw new StoreError("not_found", "no such bullet");
      const b = hit.bullet;
      if (typeof body.text === "string") b.text = body.text;
      if (typeof body.altText === "string") b.altText = body.altText || null;
      if (typeof body.altCurrency === "string") b.altCurrency = body.altCurrency || null;
    }, "bullet edited");
    return NextResponse.json({ ok: true, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}

// DELETE /api/p/:profile/canonical/bullets/:id?version=...
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const expected = new URL(req.url).searchParams.get("version") ?? undefined;
  try {
    const { version } = await updateCareer(profile, expected, (c) => {
      const hit = findBullet(c, id);
      if (!hit) throw new StoreError("not_found", "no such bullet");
      hit.position.bullets.splice(hit.index, 1);
    }, "bullet deleted");
    return NextResponse.json({ ok: true, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
