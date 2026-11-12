import { NextResponse } from "next/server";
import { jobInputSchema } from "@/lib/jobs/schema";
import { jobsAtCompany, knownSourceIds, upsertJob } from "@/lib/jobs/repo";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";

const MAX_LOOKUP_IDS = 200;

// POST /api/jobs — upsert one job by (source, sourceJobId); the server assigns the stage.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const parsed = jobInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid job", detail: parsed.error.issues }, { status: 400 });
  }
  try {
    return NextResponse.json(await upsertJob(profile, parsed.data));
  } catch (e) {
    return storeErrorResponse(e);
  }
}

// GET /api/p/:profile/jobs?source=linkedin&ids=a,b,c — which of these ids are already stored.
// GET /api/p/:profile/jobs?company=amplitude — jobs already stored for that company, from any source.
export async function GET(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const query = new URL(req.url).searchParams;
  const company = query.get("company")?.trim();
  if (company) return NextResponse.json({ jobs: await jobsAtCompany(profile, company.slice(0, 100)) });
  const source = query.get("source");
  const ids = (query.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!source || ids.length === 0) {
    return NextResponse.json({ error: "source and ids are required" }, { status: 400 });
  }
  if (ids.length > MAX_LOOKUP_IDS) {
    return NextResponse.json({ error: `at most ${MAX_LOOKUP_IDS} ids` }, { status: 400 });
  }
  return NextResponse.json({ known: await knownSourceIds(profile, source, ids) });
}
