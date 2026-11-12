import { readInterviewAnswers } from "@/lib/store/interviews";
import { NextResponse } from "next/server";
import { createCv } from "@/lib/store/cvs";
import { apiProfile, noProfile, type ProfileParams } from "@/lib/http";
import { loadCanonical } from "@/lib/resume/load";
import { isUnreadable } from "@/lib/store/paths";
import { getSettings } from "@/lib/store/profiles";
import { tailorFromJD, draftToOverrides } from "@/lib/ai/tailor";
import { defaultTemplateId } from "@/lib/templates/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/p/:profile/tailor { jd, name? } — draft a tailored variant from a job description.
export async function POST(req: Request, { params }: ProfileParams) {
  const profile = await apiProfile((await params).profile);
  if (!profile) return noProfile();
  const body = (await req.json().catch(() => ({}))) as {
    jd?: string;
    name?: string;
  };

  const jd = (body.jd ?? "").trim();
  if (jd.length < 20) {
    return NextResponse.json(
      { error: "Paste a job description (at least a few sentences)." },
      { status: 400 }
    );
  }

  try {
    const canonical = await loadCanonical(profile);
    const [settings, bank] = await Promise.all([getSettings(profile), readInterviewAnswers(profile).catch((e) => {
        // The bank only adds wording; a broken one (check:data names it) shouldn't block a CV.
        if (!isUnreadable(e)) throw e;
        console.error(`tailor: interview answers skipped: ${e instanceof Error ? e.message : e}`);
        return null;
      }),
    ]);
    const draft = await tailorFromJD(canonical, jd, settings.homeCountryName, bank?.landed ?? []);
    // The model can name ids that don't exist; drop them rather than save a CV that points at nothing.
    const known = new Map(canonical.positions.map((p) => [p.id, new Set(p.bullets.map((b) => b.id))]));
    draft.positions = draft.positions
      .filter((p) => known.has(p.positionId))
      .map((p) => {
        const ids = known.get(p.positionId)!;
        return { ...p, bulletIds: p.bulletIds.filter((id) => ids.has(id)), rewrites: p.rewrites.filter((r) => ids.has(r.bulletId)) };
      });
    const overrides = draftToOverrides(draft);

    const cv = await createCv(profile, {
      name: body.name?.trim() || draft.headline || "Tailored variant",
      templateId: await defaultTemplateId(profile),
      overrides,
    });
    return NextResponse.json({ id: cv.data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "tailoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
