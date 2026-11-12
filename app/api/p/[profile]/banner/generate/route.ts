import { NextResponse } from "next/server";
import { addBackground, readBanner } from "@/lib/store/banner";
import { generateBackground, ImageApiError } from "@/lib/banner/openai";
import { backgroundPrompt } from "@/lib/banner/prompt";
import { stripColorChunks } from "@/lib/banner/png";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 200;

// POST /api/p/:profile/banner/generate — one paid OpenAI image, stored and selected. The call runs outside the
// profile lock (it can take minutes); only the store write takes it.
export async function POST(_req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  try {
    const { data } = await readBanner(profile);
    const { png, ...meta } = await generateBackground(profile, backgroundPrompt(data.styleNote));
    const saved = await addBackground(profile, stripColorChunks(png), meta);
    return NextResponse.json({ banner: saved.data, version: saved.version, file: saved.file });
  } catch (e) {
    if (e instanceof ImageApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return storeErrorResponse(e);
  }
}
