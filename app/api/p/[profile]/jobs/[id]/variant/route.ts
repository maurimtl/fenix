import { NextResponse } from "next/server";
import { z } from "zod";
import { overridesSchema } from "@/lib/resume/schema";
import { draftVariant } from "@/lib/jobs/repo";
import { loadCanonical } from "@/lib/resume/load";
import { unknownIds } from "@/lib/resume/unknown-ids";

import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";

type Ctx = ProfileParams<{ id: string }>;

const bodySchema = z.object({ name: z.string().trim().min(1).max(200), overrides: overridesSchema });

// POST /api/p/:profile/jobs/:id/variant { name, overrides } — draft (or redraft) this job's CV and mark it CV_READY.
export async function POST(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", detail: parsed.error.issues }, { status: 400 });
  }
  const unknown = unknownIds(parsed.data.overrides, await loadCanonical(profile));
  if (unknown.length > 0) {
    return NextResponse.json({ error: "overrides reference ids not in canonical", unknown }, { status: 400 });
  }
  const result = await draftVariant(profile, id, parsed.data.name, parsed.data.overrides);
  if (!result) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json(result);
}
