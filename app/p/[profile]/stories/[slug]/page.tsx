import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";
import { readCareer, findBullet } from "@/lib/store/career";
import { findStory } from "@/lib/store/stories";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ profile: string; slug: string }> }) {
  const { profile: raw, slug } = await params;
  const profile = await pageProfile(raw);
  const [story, career] = await Promise.all([findStory(profile, slug), readCareer(profile)]);
  if (!story) notFound();
  const { data } = story;

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page story">
        <p>
          <Link href={pagePath(profile, "/stories")}>← Stories</Link>
        </p>
        <div className="page-head">
          <div>
            <h1>{data.title}</h1>
            <p className="lede">{[data.role, data.company, data.period].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        {story.body.split(/\n\s*\n/).map((para, i) => (
          <p key={i} className="story-para">
            {para}
          </p>
        ))}
        {data.numbers.length > 0 && (
          <>
            <h2>Numbers and where they come from</h2>
            <ul className="story-numbers">
              {data.numbers.map((n, i) => {
                const b = findBullet(career.data, n.proof);
                return (
                  <li key={i}>
                    <strong>{n.claim}</strong>
                    <span className="variant-meta"> — {b ? `career record: “${b.bullet.text}”` : n.proof}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {data.themes.length > 0 && <p className="variant-meta">Themes: {data.themes.join(", ")}</p>}
      </main>
    </>
  );
}
