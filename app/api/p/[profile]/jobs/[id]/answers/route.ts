import { NextResponse } from "next/server";
import { answersPutSchema } from "@/lib/jobs/schema";
import { jobAnswers, saveAnswers } from "@/lib/jobs/answers";

import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";

type Ctx = ProfileParams<{ id: string }>;

export async function GET(_req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  return NextResponse.json({ answers: await jobAnswers(profile, id) });
}

// PUT /api/p/:profile/jobs/:id/answers { answers: [{ question, answer }] } — upserts per question.
export async function PUT(req: Request, { params }: Ctx) {
  const { id, profile: slug } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const parsed = answersPutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid answers", detail: parsed.error.issues }, { status: 400 });
  }
  const saved = await saveAnswers(profile, id, parsed.data.answers);
  if (!saved) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ saved: saved.length });
}
