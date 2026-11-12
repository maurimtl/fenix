import { NextResponse } from "next/server";
import { readBanner, saveBanner, type BannerPatch } from "@/lib/store/banner";
import { hasOpenAiKey, priceLabel } from "@/lib/banner/openai";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = ["valueLine", "roleLine", "textScale", "textCenterY", "cropY", "background", "styleNote"] as const;

// GET /api/p/:profile/banner — the banner settings, their version, and whether backgrounds can be generated.
export async function GET(_req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  try {
    const { data, version } = await readBanner(profile);
    return NextResponse.json({ banner: data, version, hasKey: hasOpenAiKey(), price: priceLabel() });
  } catch (e) {
    return storeErrorResponse(e);
  }
}

// PATCH /api/p/:profile/banner — { version, commit?, ...fields }. A stale version answers 409; values are schema-checked (400).
export async function PATCH(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.version !== "string") return NextResponse.json({ error: "version is required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const k of FIELDS) if (k in body) patch[k] = body[k];
  try {
    const { data, version } = await saveBanner(profile, body.version, patch as BannerPatch, { commit: body.commit === true });
    return NextResponse.json({ banner: data, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
