import { readBackground } from "@/lib/store/banner";
import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/p/:profile/banner/backgrounds/:file — one stored background. readBackground accepts only plain *.png names.
export async function GET(_req: Request, { params }: ProfileParams<{ file: string }>) {
  const { profile: slug, file } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  const png = await readBackground(profile, file);
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=31536000, immutable" } });
}
