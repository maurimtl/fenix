import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { StoreError } from "@/lib/store/paths";
import { designPreview } from "@/lib/templates/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/p/:profile/designs/:id/preview — page 1 of the person's career record in that design, as a PNG.
export async function GET(_req: Request, { params }: ProfileParams<{ id: string }>) {
  const { profile: slug, id } = await params;
  const profile = await apiProfile(slug);
  if (!profile) return noProfile();
  try {
    const png = await designPreview(profile, id);
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof StoreError) return storeErrorResponse(e);
    return new Response(`Couldn't render this design: ${(e as Error).message}`, { status: 500, headers: { "content-type": "text/plain" } });
  }
}
