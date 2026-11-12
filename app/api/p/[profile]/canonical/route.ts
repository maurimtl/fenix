import { NextResponse } from "next/server";
import { loadCanonical } from "@/lib/resume/load";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/p/:profile/canonical — the full canonical record, with the ids variant overrides reference.
export async function GET(_req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  try {
    return NextResponse.json(await loadCanonical(profile));
  } catch (e) {
    return storeErrorResponse(e);
  }
}
