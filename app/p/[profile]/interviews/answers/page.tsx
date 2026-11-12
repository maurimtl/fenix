import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { SiteHeader } from "@/components/site-header";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";
import { readInterviewAnswers } from "@/lib/store/interviews";

export const dynamic = "force-dynamic";

export default async function InterviewAnswersPage({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  const bank = await readInterviewAnswers(profile);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page interview">
        <p>
          <Link href={pagePath(profile, "/interviews")}>← Interviews</Link>
        </p>
        <div className="page-head">
          <div>
            <h1>Your interview answers</h1>
            <p className="lede">Your best current answer to each common question, updated after every interview review.</p>
          </div>
        </div>
        {!bank ? (
          <p>None yet. They build up from your interview reviews.</p>
        ) : (
          <>
            {bank.landed.length > 0 && (
              <section>
                <h2>Lines that landed</h2>
                <ul>
                  {bank.landed.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </section>
            )}
            <Markdown text={bank.body} />
          </>
        )}
      </main>
    </>
  );
}
