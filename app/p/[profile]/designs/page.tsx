import { SiteHeader } from "@/components/site-header";
import { PromptBox } from "@/components/prompt-box";
import { DesignCard } from "@/components/design-card";
import { pageProfile } from "@/lib/http";
import { defaultTemplateId, listTemplates } from "@/lib/templates/registry";
import { promptWho } from "@/lib/start/progress";
import { prompts } from "@/lib/start/prompts";

export const dynamic = "force-dynamic";

export default async function DesignsPage({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  const [templates, current, who] = await Promise.all([listTemplates(profile), defaultTemplateId(profile), promptWho(profile)]);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page page-wide">
        <div className="page-head">
          <div>
            <h1>Designs</h1>
            <p className="lede">
              Each design with your career record. New CV versions start in your default; any CV can switch design in the
              editor.
            </p>
          </div>
        </div>
        <PromptBox text={prompts.design(who)} />
        <div className="design-grid">
          {templates.map((t) => (
            <DesignCard
              key={t.id}
              profile={profile}
              id={t.id}
              name={t.name}
              description={t.description}
              personal={t.personal}
              isDefault={t.id === current}
            />
          ))}
        </div>
      </main>
    </>
  );
}
