import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PromptBox } from "@/components/prompt-box";
import { prompts } from "@/lib/start/prompts";
import { promptWho } from "@/lib/start/progress";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";
import { readAllStories } from "@/lib/store/stories";

export const dynamic = "force-dynamic";

export default async function StoriesPage({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  const [stories, who] = await Promise.all([readAllStories(profile), promptWho(profile)]);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Stories</h1>
            <p className="lede">
              The context behind your achievements, used when tailoring CVs and answering application questions. Claude
              writes and edits them; you can also edit the files in <code>data/{profile}/stories/</code>.
            </p>
          </div>
        </div>
        <PromptBox text={prompts.stories(who)} />
        {stories.length === 0 ? (
          <p>No stories yet. Claude asks about one result at a time and writes the story with you.</p>
        ) : (
          <ul className="variant-list">
            {stories.map((s) => (
              <li key={s.slug} className="variant-row">
                <Link href={pagePath(profile, `/stories/${s.slug}`)} className="variant-name">
                  {s.data.title}
                </Link>
                <span className="variant-meta">
                  {[s.data.company, s.data.period].filter(Boolean).join(", ")}
                  {s.data.themes.length > 0 && ` · ${s.data.themes.join(", ")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
