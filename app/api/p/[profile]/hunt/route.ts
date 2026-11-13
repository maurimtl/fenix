import { NextResponse } from "next/server";
import { z } from "zod";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { addHuntSeen, readHuntSeen } from "@/lib/store/hunt";
import { getSettings } from "@/lib/store/profiles";

export const dynamic = "force-dynamic";

const MAX_KEYS = 2000;
const bodySchema = z.strictObject({ seen: z.array(z.string().trim().min(1).max(300)).min(1).max(MAX_KEYS) });

// GET /api/p/:profile/hunt — what the hunt scanner needs: the person's hunt settings and the keys already judged.
export async function GET(_req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  try {
    const s = await getSettings(profile);
    const { seen } = await readHuntSeen(profile);
    return NextResponse.json({
      homeCountry: s.homeCountry,
      homeCountryName: s.homeCountryName,
      targetTitles: s.targetTitles,
      queries: s.queries,
      watchlistExtra: s.watchlistExtra,
      dreamCompanies: s.dreamCompanies,
      seen: Object.keys(seen),
    });
  } catch (e) {
    return storeErrorResponse(e);
  }
}

// POST /api/p/:profile/hunt { seen: ["<source>:<id>", …] } — marks roles or posts as judged. Marking twice changes nothing.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `expected { seen: [1 to ${MAX_KEYS} keys of up to 300 characters] }` }, { status: 400 });
  }
  try {
    return NextResponse.json(await addHuntSeen(profile, [...new Set(parsed.data.seen)]));
  } catch (e) {
    return storeErrorResponse(e);
  }
}
