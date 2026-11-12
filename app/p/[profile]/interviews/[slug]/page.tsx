import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { SiteHeader } from "@/components/site-header";
import { pageProfile } from "@/lib/http";
import { getJob } from "@/lib/jobs/repo";
import { pagePath } from "@/lib/profile-url";
import { findInterview, readTranscript } from "@/lib/store/interviews";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ profile: string; slug: string }> }) {
  const { profile: raw, slug } = await params;
  const profile = await pageProfile(raw);
  const round = await findInterview(profile, slug);
  if (!round) notFound();
  const { data } = round;
  const [job, transcript] = await Promise.all([getJob(profile, data.job), readTranscript(profile, slug)]);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page interview">
        <p>
          <Link href={pagePath(profile, "/interviews")}>← Interviews</Link>
        </p>
        <div className="page-head">
          <div>
            <h1>
              {data.company}, round {data.round}
            </h1>
            <p className="lede">
              {data.date}
              {data.with.length > 0 && ` · with ${data.with.map((w) => (w.role ? `${w.name} (${w.role})` : w.name)).join(", ")}`}
              {job && (
                <>
                  {" · "}
                  <Link href={pagePath(profile, `/jobs/${job.id}`)}>{job.title}</Link>
                </>
              )}
            </p>
          </div>
        </div>
        <Markdown text={round.body} />
        {transcript && (
          <details className="transcript">
            <summary>Transcript{data.transcript ? ` (from ${data.transcript.source})` : ""}</summary>
            <pre>{transcript}</pre>
          </details>
        )}
      </main>
    </>
  );
}
