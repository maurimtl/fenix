import { SiteHeader } from "@/components/site-header";
import { PromptBox } from "@/components/prompt-box";
import { prompts } from "@/lib/start/prompts";
import { promptWho } from "@/lib/start/progress";
import { LinkedinEditor, type LinkedinRow } from "@/components/linkedin-editor";
import { pageProfile } from "@/lib/http";
import { LINKEDIN_LIMITS } from "@/lib/linkedin/format";
import { readCareer } from "@/lib/store/career";
import { readLinkedinDraft, readLinkedinProfile } from "@/lib/store/linkedin";
import { linkedinProfileSchema } from "@/lib/store/schemas";
import { StoreError } from "@/lib/store/paths";

export const dynamic = "force-dynamic";

export default async function LinkedinPage({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  const [liveRes, draftRes] = await Promise.allSettled([readLinkedinProfile(profile), readLinkedinDraft(profile)]);
  for (const r of [liveRes, draftRes]) if (r.status === "rejected" && !(r.reason instanceof StoreError)) throw r.reason;
  const live = liveRes.status === "fulfilled" ? liveRes.value : null;
  const draft = draftRes.status === "fulfilled" ? draftRes.value : null;
  const problems = [liveRes, draftRes].flatMap((r) => (r.status === "rejected" ? [(r.reason as Error).message] : []));
  const career = (await readCareer(profile)).data;

  // Roles in career-record order: every one that is recorded live or proposed in the draft.
  const roleIds = new Set([...(live?.data.roles ?? []), ...(draft?.roles ?? [])].map((r) => r.positionId));
  const rows: LinkedinRow[] = [
    { key: "headline", title: "Headline", limit: LINKEDIN_LIMITS.headline, section: { kind: "headline" }, draft: draft?.headline ?? null },
    { key: "about", title: "About", limit: LINKEDIN_LIMITS.about, section: { kind: "about" }, draft: draft?.about ?? null },
  ];
  for (const c of career.companies)
    for (const p of c.positions)
      if (roleIds.has(p.id))
        rows.push({
          key: p.id,
          title: `${p.title}, ${c.name}`,
          limit: LINKEDIN_LIMITS.role,
          section: { kind: "role", positionId: p.id },
          draft: draft?.roles.find((r) => r.positionId === p.id)?.text ?? null,
        });

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page">
        <div className="page-head">
          <div>
            <h1>LinkedIn profile</h1>
            <p className="lede">
              What is on your LinkedIn profile now, and any proposed rewrite next to it. Copy a part and paste it into LinkedIn yourself (the copy keeps bullets
              and blank lines), then mark it applied.
            </p>
          </div>
        </div>
        <PromptBox text={prompts.linkedin(await promptWho(profile))} />
        {problems.length > 0 && <p className="banner banner-fail">{problems.join(" ")} Run pnpm check:data to see every problem.</p>}
        {draft && <p className="variant-meta">Proposed text drafted {draft.generatedAt.slice(0, 10)}.</p>}
        {/* A broken live record still shows the draft, read-only, until check:data's problem is fixed. */}
        <LinkedinEditor
          initial={live?.data ?? linkedinProfileSchema.parse({})}
          initialVersion={live?.version ?? ""}
          rows={rows}
          readOnly={!live}
        />
      </main>
    </>
  );
}
