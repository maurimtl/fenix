import { NextResponse } from "next/server";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { findPosition, newBulletId, updateCareer } from "@/lib/store/career";
import { StoreError } from "@/lib/store/paths";

// POST /api/p/:profile/canonical/bullets { positionId, text, version? } — add a bullet (appended last).
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => ({}))) as { positionId?: string; text?: string; version?: string };
  if (!body.positionId || !body.text?.trim()) {
    return NextResponse.json({ error: "positionId and text required" }, { status: 400 });
  }
  try {
    const { result: id, version } = await updateCareer(profile, body.version, (c) => {
      const p = findPosition(c, body.positionId!);
      if (!p) throw new StoreError("not_found", "no such position");
      const id = newBulletId();
      p.bullets.push({ id, text: body.text! });
      return id;
    }, "bullet added");
    return NextResponse.json({ id, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
