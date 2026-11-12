import { NextResponse } from "next/server";
import { searchAnswers } from "@/lib/jobs/answers";
import { apiProfile, noProfile } from "@/lib/http";
import type { ProfileParams } from "@/lib/http";

// GET /api/p/:profile/answers?q=sponsor — past answers across all jobs, newest first.
export async function GET(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  return NextResponse.json({ answers: await searchAnswers(profile, q) });
}
