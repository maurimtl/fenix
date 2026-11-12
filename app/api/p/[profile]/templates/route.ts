import { NextResponse } from "next/server";
import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";
import { defaultTemplateId, listTemplates } from "@/lib/templates/registry";

export const dynamic = "force-dynamic";

// GET /api/p/:profile/templates — built-in templates plus this person's own, and which one is their default.
export async function GET(_req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const [templates, defaultId] = await Promise.all([listTemplates(profile), defaultTemplateId(profile)]);
  return NextResponse.json({ templates, default: defaultId });
}
