import { NextResponse } from "next/server";
import { parseSection } from "@/lib/linkedin/sections";
import { readLinkedinProfile, saveLinkedinSection } from "@/lib/store/linkedin";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/p/:profile/linkedin — the live LinkedIn profile record and its version.
export async function GET(_req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  try {
    const { data, version } = await readLinkedinProfile(profile);
    return NextResponse.json({ linkedin: data, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}

// PATCH /api/p/:profile/linkedin — { version, section: { kind, positionId? }, text }: one section edited by hand. 409 when stale.
export async function PATCH(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => null)) as { version?: unknown; section?: unknown; text?: unknown } | null;
  const section = parseSection(body?.section);
  if (!section || typeof body?.version !== "string" || typeof body.text !== "string") {
    return NextResponse.json({ error: "expected { version, section: { kind, positionId? }, text }" }, { status: 400 });
  }
  try {
    const { data, version } = await saveLinkedinSection(profile, body.version, section, body.text);
    return NextResponse.json({ linkedin: data, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
