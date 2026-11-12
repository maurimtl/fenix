import { NextResponse } from "next/server";
import { jobPatchSchema } from "@/lib/jobs/schema";
import { patchJob } from "@/lib/jobs/repo";

import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";

type Ctx = ProfileParams<{ id: string }>;

// PATCH /api/p/:profile/jobs/:id { stage?, notes? } — a stage set here belongs to the person; hunt re-runs won't move it.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const parsed = jobPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid patch", detail: parsed.error.issues }, { status: 400 });
  }
  if (!(await patchJob(profile, id, parsed.data))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
