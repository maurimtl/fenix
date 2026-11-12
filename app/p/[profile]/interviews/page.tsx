import Link from "next/link";
import { PromptBox } from "@/components/prompt-box";
import { SiteHeader } from "@/components/site-header";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";
import { promptWho } from "@/lib/start/progress";
import { prompts } from "@/lib/start/prompts";
import { readAllInterviews, readInterviewAnswers } from "@/lib/store/interviews";

export const dynamic = "force-dynamic";

const STATUS = { brief: "Brief ready", reviewed: "Reviewed" } as const;

export default async function InterviewsPage({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  const [rounds, bank, who] = await Promise.all([readAllInterviews(profile), readInterviewAnswers(profile), promptWho(profile)]);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Interviews</h1>
            <p className="lede">
              A brief before each round and a review after it, from the recording. What you said is kept, so the next brief stays
              consistent and your CVs and LinkedIn use the lines that landed.
            </p>
          </div>
        </div>
        <PromptBox text={prompts.interviews(who)} />
        <p>
          <Link href={pagePath(profile, "/interviews/answers")}>Your interview answers</Link>
          <span className="variant-meta"> · {bank ? `${bank.landed.length} lines that landed` : "none yet"}</span>
        </p>
        {rounds.length === 0 ? (
          <p>No interviews yet.</p>
        ) : (
          <ul className="variant-list">
            {rounds.map((r) => (
              <li key={r.slug} className="variant-row">
                <Link href={pagePath(profile, `/interviews/${r.slug}`)} className="variant-name">
                  {r.data.company}, round {r.data.round}
                </Link>
                <span className="variant-meta">
                  {r.data.date} · {STATUS[r.data.status]}
                  {r.data.with.length > 0 && ` · with ${r.data.with.map((w) => w.name).join(", ")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
