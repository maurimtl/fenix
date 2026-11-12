import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiProfile, noProfile, storeErrorResponse, type ProfileParams } from "@/lib/http";
import { updateProfileRecord } from "@/lib/store/career";
import { listTemplates } from "@/lib/templates/registry";
import { insideData } from "@/lib/store/cv-folder";

export const dynamic = "force-dynamic";

const bodySchema = z.strictObject({
  defaultTemplate: z.string().min(1).optional(),
  cvFolder: z.string().nullable().optional(),
});

/** `~` expands to the home folder; the result must be absolute. Empty clears the setting. */
function folderPath(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null;
  const expanded = t === "~" ? os.homedir() : t.startsWith("~/") ? path.join(os.homedir(), t.slice(2)) : t;
  if (!path.isAbsolute(expanded)) throw new Error("the CV folder must be a full path, such as ~/Documents/CVs");
  return path.resolve(expanded);
}

// PATCH /api/p/:profile/settings — changes only the named settings, under the profile lock.
export async function PATCH(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "expected { defaultTemplate?, cvFolder? }" }, { status: 400 });
  const body = parsed.data;
  if (body.defaultTemplate !== undefined && !(await listTemplates(profile)).some((t) => t.id === body.defaultTemplate)) {
    return NextResponse.json({ error: `no design named ${body.defaultTemplate}` }, { status: 400 });
  }
  let folder: string | null | undefined;
  try {
    folder = body.cvFolder === undefined ? undefined : body.cvFolder === null ? null : folderPath(body.cvFolder);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (folder && (await insideData(folder))) {
    return NextResponse.json({ error: "the CV folder must be outside Fenix's data folder" }, { status: 400 });
  }
  try {
    const { result } = await updateProfileRecord(profile, undefined, (p) => {
      if (body.defaultTemplate !== undefined) p.settings.defaultTemplate = body.defaultTemplate;
      if (folder === null) delete p.settings.cvFolder;
      else if (folder !== undefined) p.settings.cvFolder = folder;
      return { defaultTemplate: p.settings.defaultTemplate, cvFolder: p.settings.cvFolder ?? null };
    });
    return NextResponse.json(result);
  } catch (e) {
    return storeErrorResponse(e);
  }
}
