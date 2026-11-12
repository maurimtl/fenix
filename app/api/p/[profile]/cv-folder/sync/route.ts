import { NextResponse } from "next/server";
import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";
import { syncFolder } from "@/lib/store/cv-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/p/:profile/cv-folder/sync — copies every live CV version's PDF into the CV folder.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const r = await syncFolder(profile);
  if (!r.folder) return NextResponse.json({ error: "no CV folder is set" }, { status: 409 });
  return NextResponse.json(r);
}
