import { promises as fs, constants } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { CvFolderBar } from "@/components/cv-folder-bar";
import { resolveFolder } from "@/lib/store/cv-folder";
import { readAllCvs, toVariant } from "@/lib/store/cvs";
import {
  NewVariantButton,
  RowActions,
  TailorForm,
} from "@/components/variant-buttons";
import { SiteHeader } from "@/components/site-header";
import { PromptBox } from "@/components/prompt-box";
import { prompts } from "@/lib/start/prompts";
import { promptWho } from "@/lib/start/progress";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";

export const dynamic = "force-dynamic";

/** Why copies can't land in the folder right now, or null. A missing folder is fine: it's created at the next save. */
async function folderProblem(folder: string | null): Promise<string | null> {
  if (!folder) return null;
  const st = await fs.stat(folder).catch(() => null);
  if (st && !st.isDirectory()) return `${folder} is a file, not a folder, so PDFs can't be copied there.`;
  // The save creates missing folders, so what matters is the nearest folder that already exists.
  let target = folder;
  while (!(await fs.stat(target).catch(() => null)) && path.dirname(target) !== target) target = path.dirname(target);
  const ok = await fs.access(target, constants.W_OK).then(() => true, () => false);
  return ok ? null : `Fenix can't write to ${target}, so PDFs aren't being copied.`;
}

export default async function VariantsPage({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  const [who, folder] = await Promise.all([promptWho(profile), resolveFolder(profile)]);
  const warning = await folderProblem(folder);
  const variants = (await readAllCvs(profile)).map(toVariant).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <>
    <SiteHeader profile={profile} />
    <main className="page">
      <div className="page-head">
        <div>
          <h1>CVs</h1>
          <p className="lede">One tailored version of your résumé per application. Your career record stays untouched.</p>
        </div>
        <NewVariantButton />
      </div>
      <PromptBox text={prompts.cvForJob(who)} />
      {/* Keyed on the folder so the field shows the stored path (with ~ written out) after a save. */}
      <CvFolderBar key={folder ?? ""} profile={profile} folder={folder} warning={warning} />

      <TailorForm />

      <h2 className="variants-heading">Your CVs</h2>
      {variants.length === 0 ? (
        <p>
          No variants yet. Create one with <strong>+ New variant</strong>, or{" "}
          <Link href={pagePath(profile, "/cv/base")}>preview your canonical résumé</Link>.
        </p>
      ) : (
        <ul className="variant-list">
          {variants.map((v) => (
            <li key={v.id} className="variant-row">
              <Link href={pagePath(profile, `/cv/${v.id}`)} className="variant-name">
                {v.name}
              </Link>
              <span className="variant-meta">
                edited {v.updatedAt.toLocaleDateString("en-CA")}
              </span>
              <RowActions id={v.id} name={v.name} />
            </li>
          ))}
        </ul>
      )}
    </main>
    </>
  );
}
