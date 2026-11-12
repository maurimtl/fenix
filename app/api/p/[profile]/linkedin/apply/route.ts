import { NextResponse } from "next/server";
import { parseSection } from "@/lib/linkedin/sections";
import { applyDraftSection } from "@/lib/store/linkedin";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/p/:profile/linkedin/apply — { version, section, text }: the person pasted this draft section (text = what the
// page showed) into LinkedIn,
// so it becomes the live record. Only linkedin/profile.yaml changes.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => null)) as { version?: unknown; section?: unknown; text?: unknown } | null;
  const section = parseSection(body?.section);
  if (!section || typeof body?.version !== "string" || typeof body.text !== "string") {
    return NextResponse.json({ error: "expected { version, section: { kind, positionId? }, text }" }, { status: 400 });
  }
  try {
    const { data, version } = await applyDraftSection(profile, body.version, section, body.text);
    return NextResponse.json({ linkedin: data, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
