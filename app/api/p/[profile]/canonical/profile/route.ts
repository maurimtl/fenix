import { NextResponse } from "next/server";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { updateProfileRecord } from "@/lib/store/career";

const FIELDS = ["fullName", "headline", "email", "phone", "location", "summary", "about"] as const;
// These must never be blanked: they render on every résumé.
const REQUIRED = new Set(["fullName", "headline", "email", "summary"]);

// PATCH /api/p/:profile/canonical/profile { ...fields, version? } — update name, contact, headline, summary, about.
export async function PATCH(req: Request, { params }: ProfileParams) {
  const slug = await apiProfile((await params).profile);
  if (!slug) return noProfile();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  for (const f of REQUIRED) {
    if (typeof body[f] === "string" && !(body[f] as string).trim()) {
      return NextResponse.json({ error: `${f} cannot be empty` }, { status: 400 });
    }
  }
  try {
    const { version } = await updateProfileRecord(slug, typeof body.version === "string" ? body.version : undefined, (p) => {
      for (const f of FIELDS) {
        const val = body[f];
        if (typeof val !== "string") continue;
        (p as Record<string, unknown>)[f] = REQUIRED.has(f) ? val : val || null;
      }
    });
    return NextResponse.json({ ok: true, version });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
