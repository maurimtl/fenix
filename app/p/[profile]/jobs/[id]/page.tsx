import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PromptBox } from "@/components/prompt-box";
import { prompts } from "@/lib/start/prompts";
import { promptWho } from "@/lib/start/progress";
import { interviewsForJob } from "@/lib/store/interviews";
import { CompGauge } from "@/components/comp-gauge";
import { JobStageSelect } from "@/components/job-stage-select";
import { getJob } from "@/lib/jobs/repo";
import { jobAnswers } from "@/lib/jobs/answers";
import {
  REMOTE_TONE,
  checkLabel,
  compConfirmed,
  filterReasonText,
  formatComp,
  remoteLabel,
  usdRange,
} from "@/lib/jobs/format";
import { getSettings } from "@/lib/store/profiles";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";


export const dynamic = "force-dynamic";

const PRE_APPLY = new Set(["FOUND", "SHORTLISTED", "CV_READY"]);
const INTERVIEW_STAGES = new Set(["APPLIED", "INTERVIEWING"]);

export default async function JobDetail({ params }: { params: Promise<{ profile: string; id: string }> }) {
  const { id, profile: slug } = await params;
  const profile = await pageProfile(slug);
  const [job, answers, settings, who, rounds] = await Promise.all([
    getJob(profile, id),
    jobAnswers(profile, id),
    getSettings(profile),
    promptWho(profile),
    interviewsForJob(profile, id),
  ]);
  if (!job) notFound();
  const { minUsd, maxUsd } = usdRange(job);
  const back = job.stage === "FILTERED_OUT" ? { href: pagePath(profile, "/jobs/filtered"), label: "Filtered out" } : { href: pagePath(profile, "/jobs"), label: "Pipeline" };

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page">
        <Link href={back.href} className="crumb">← {back.label}</Link>

        <div className="dossier-head">
          <div>
            <h1>{job.title}</h1>
            <p className="dossier-company">
              {job.company}
              {job.locationText && <span className="muted">, {job.locationText}</span>}
            </p>
          </div>
          <JobStageSelect id={job.id} stage={job.stage} closedReason={job.closedReason} />
        </div>

        <div className="dossier">
          <div className="dossier-main">
            {PRE_APPLY.has(job.stage) && <PromptBox text={prompts.apply(who, job.company, job.title)} />}
            {INTERVIEW_STAGES.has(job.stage) && <PromptBox text={prompts.brief(who, job.company)} />}
            {rounds.length > 0 && (
              <section className="job-interviews">
                <h2>Interviews</h2>
                <ul>
                  {rounds.map((r) => (
                    <li key={r.slug}>
                      <Link href={pagePath(profile, `/interviews/${r.slug}`)}>
                        Round {r.data.round}, {r.data.date}
                      </Link>
                      <span className="muted"> · {r.data.status === "reviewed" ? "reviewed" : "brief ready"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {job.postingClosedAt && (
              <p className="banner banner-fail">
                Posting closed (checked {job.postingClosedAt.toLocaleDateString("en-CA")}): {job.postingClosedEvidence}
              </p>
            )}
            {job.filterReason && <p className="banner banner-fail">Filtered out: {filterReasonText(job.filterReason)}</p>}
            {job.needsCheck.length > 0 && (
              <p className="banner banner-check">{job.needsCheck.map(checkLabel).join(". ")}.</p>
            )}

            {job.whyGood && (
              <section className="block">
                <h2>
                  Why it fits{job.fitScore != null && <span className="fit-badge">{job.fitScore}</span>}
                </h2>
                <p className="prose">{job.whyGood}</p>
              </section>
            )}
            {job.redFlags && (
              <section className="block">
                <h2>Watch out for</h2>
                <p className="prose">{job.redFlags}</p>
              </section>
            )}
            {job.notes && (
              <section className="block">
                <h2>Your notes</h2>
                <p className="prose">{job.notes}</p>
              </section>
            )}
            {answers.length > 0 && (
              <section className="block">
                <h2>Application answers</h2>
                <dl className="answers">
                  {answers.map((a) => (
                    <div key={a.id}>
                      <dt>{a.question}</dt>
                      <dd className="prose">{a.answer || "(left blank)"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {job.jdText && (
              <section className="block">
                <h2>Job description</h2>
                <p className="muted small">Saved {job.firstSeenAt.toLocaleDateString("en-CA", { month: "long", day: "numeric" })}, in case the posting comes down.</p>
                <pre className="jd">{job.jdText}</pre>
              </section>
            )}
          </div>

          <aside className="dossier-side">
            <section className="fact">
              <h2>Salary</h2>
              <p className="money money-lg">{formatComp(job)}</p>
              <CompGauge minUsd={minUsd} maxUsd={maxUsd} confirmed={compConfirmed(job.compSource)} floorUsd={settings.floorUsd} large />
              {job.compEvidence && <blockquote>{job.compEvidence}</blockquote>}
            </section>

            <section className="fact">
              <h2>Remote</h2>
              <p className={`signal signal-${REMOTE_TONE[job.remoteVerdict]}`}>{remoteLabel(job.remoteVerdict, settings.homeCountryName)}</p>
              {job.remoteEvidence && <blockquote>{job.remoteEvidence}</blockquote>}
              {job.remoteEvidenceUrl && (
                <a href={job.remoteEvidenceUrl} target="_blank" rel="noreferrer" className="small">Where this came from</a>
              )}
            </section>

            <section className="fact">
              <h2>Apply</h2>
              <ul className="links">
                {job.variant ? (
                  <li><Link href={pagePath(profile, `/cv/${job.variant.id}`)}>Open the tailored CV</Link></li>
                ) : (
                  <li className="muted">No tailored CV yet</li>
                )}
                <li><a href={job.url} target="_blank" rel="noreferrer">View the posting on LinkedIn</a></li>
                {job.companyUrl && <li><a href={job.companyUrl} target="_blank" rel="noreferrer">Company careers page</a></li>}
              </ul>
              {(job.easyApply != null || job.applicants != null) && (
                <p className="muted small">
                  {job.easyApply != null && (job.easyApply ? "Easy Apply on LinkedIn. " : "Applies on the company site. ")}
                  {job.applicants != null && `${job.applicants} applicants so far.`}
                </p>
              )}
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
