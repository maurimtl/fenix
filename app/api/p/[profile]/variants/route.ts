import { NextResponse } from "next/server";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { createCvLocked, findCv } from "@/lib/store/cvs";
import { withProfileLock } from "@/lib/store/lock";
import { commitProfile } from "@/lib/store/history";
import { StoreError } from "@/lib/store/paths";
import { defaultTemplateId } from "@/lib/templates/registry";

// POST /api/p/:profile/variants — create a blank CV version, or duplicate one via { sourceId }.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => ({}))) as { name?: string; sourceId?: string };
  try {
    const cv = await withProfileLock(profile, async () => {
      let made;
      if (body.sourceId) {
        const src = await findCv(profile, body.sourceId);
        if (!src) throw new StoreError("not_found", "source not found");
        made = await createCvLocked(profile, {
          name: body.name ?? `${src.data.name} (copy)`,
          templateId: src.data.templateId,
          overrides: src.data.overrides,
        });
      } else {
        made = await createCvLocked(profile, { name: body.name ?? "Untitled variant", templateId: await defaultTemplateId(profile), overrides: {} });
      }
      await commitProfile(profile, `CV ${made.data.name} created`, [made.file]);
      return made;
    });
    return NextResponse.json({ id: cv.data.id });
  } catch (e) {
    return storeErrorResponse(e);
  }
}
