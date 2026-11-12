import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";
import { resolveFolder } from "@/lib/store/cv-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENER: Partial<Record<NodeJS.Platform, string>> = { darwin: "open", linux: "xdg-open" };

// POST /api/p/:profile/cv-folder/open — shows the person's CV folder in Finder (or the Linux file manager).
// It opens only the folder saved in their settings, never a path from the request.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const folder = await resolveFolder(profile);
  if (!folder) return NextResponse.json({ error: "no CV folder is set" }, { status: 409 });
  if (!(await fs.stat(folder).catch(() => null))?.isDirectory()) {
    return NextResponse.json({ error: `${folder} doesn't exist yet; it's created at the next PDF save` }, { status: 409 });
  }
  const opener = OPENER[process.platform];
  if (!opener) return NextResponse.json({ error: `can't open folders on ${process.platform}` }, { status: 501 });
  try {
    await promisify(execFile)(opener, [folder], { timeout: 5_000 });
  } catch (e) {
    return NextResponse.json({ error: `couldn't open ${folder}: ${(e as Error).message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
