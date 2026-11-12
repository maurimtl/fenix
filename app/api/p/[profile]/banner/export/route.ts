import { readBanner, saveExport } from "@/lib/store/banner";
import { readProfile } from "@/lib/store/profiles";
import { bannerHtmlForExport, renderBannerPng } from "@/lib/banner/render";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/p/:profile/banner/export — render the saved banner, keep a copy in data/<person>/linkedin/banner.png, download it.
export async function POST(_req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  try {
    const [{ data }, person] = await Promise.all([readBanner(profile), readProfile(profile)]);
    const png = await renderBannerPng(await bannerHtmlForExport(profile, data));
    await saveExport(profile, png);
    const name = `${person.fullName} - LinkedIn banner.png`;
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="LinkedIn banner.png"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
