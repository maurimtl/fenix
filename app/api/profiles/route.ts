import { NextResponse } from "next/server";
import { createProfile, listProfiles } from "@/lib/store/profiles";
import { storeErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/profiles — every person in data/, with job counts.
export async function GET() {
  return NextResponse.json({ profiles: await listProfiles() });
}

// POST /api/profiles { name } — 201 with the new slug, 409 when that slug already exists.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof body?.name !== "string") return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    const slug = await createProfile(body.name);
    return NextResponse.json({ slug }, { status: 201 });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
