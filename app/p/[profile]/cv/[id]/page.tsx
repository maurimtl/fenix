import Link from "next/link";
import { notFound } from "next/navigation";
import { findCv } from "@/lib/store/cvs";
import { unbackedInCv } from "@/lib/store/claims";
import { defaultTemplateId, listTemplates } from "@/lib/templates/registry";
import { loadCanonical, loadResumeDoc } from "@/lib/resume/load";
import { VariantEditor } from "@/components/variant-editor";
import { prompts } from "@/lib/start/prompts";
import { promptWho } from "@/lib/start/progress";
import { pageProfile } from "@/lib/http";
import { apiPath, pagePath } from "@/lib/profile-url";

export const dynamic = "force-dynamic";

export default async function CvPage({
  params,
}: {
  params: Promise<{ profile: string; id: string }>;
}) {
  const { id, profile: slug } = await params;
  const profile = await pageProfile(slug);

  // `base` = read-only canonical preview.
  if (id === "base") {
    const doc = await loadResumeDoc(profile, "base");
    if (!doc) notFound();
    return (
      <>
        <div className="preview-toolbar">
          <Link href={pagePath(profile, "/variants")} className="btn">
            ← CVs
          </Link>
          <strong>{doc.fullName}</strong>
          <span style={{ color: "var(--muted)" }}>Canonical (base) — read-only</span>
          <span className="spacer" />
          <a className="btn btn-primary" href={apiPath(profile, "/cv/base/pdf?dl=1")}>
            Download PDF
          </a>
        </div>
        <iframe className="pdf-frame" title="Résumé preview" src={apiPath(profile, "/cv/base/pdf")} />
      </>
    );
  }

  // Real variant → editor.
  const [canonical, cv, templates] = await Promise.all([
    loadCanonical(profile),
    findCv(profile, id),
    listTemplates(profile),
  ]);
  if (!cv) notFound();
  const variant = cv.data;
  const unbacked = (await unbackedInCv(profile, variant)).map((n) => n.token);

  return (
    <VariantEditor
      canonical={canonical}
      variant={{
        id: variant.id,
        name: variant.name,
        templateId: variant.templateId,
        overrides: variant.overrides,
        version: cv.version,
      }}
      templates={templates.map(({ id, name, personal, features }) => ({ id, name, personal, features }))}
      defaultTemplate={await defaultTemplateId(profile)}
      unbacked={[...new Set(unbacked)]}
      designPrompt={prompts.design(await promptWho(profile))}
    />
  );
}
