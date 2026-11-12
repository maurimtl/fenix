import Link from "next/link";
import type { Job } from "@/lib/store/jobs";
import { CompGauge } from "@/components/comp-gauge";
import { JobStageSelect } from "@/components/job-stage-select";
import { CLOSED_REASON_LABEL, REMOTE_TONE, checkLabel, compConfirmed, formatComp, noReplyDays, remoteLabel, stageDateLabel, usdRange } from "@/lib/jobs/format";
import type { Settings } from "@/lib/store/schemas";
import { pagePath } from "@/lib/profile-url";

/** "No reply in N days" on an application that has waited past NO_REPLY_DAYS. */
export function NoReplyTag({ job, now }: { job: Pick<Job, "stage" | "stageEnteredAt" | "stageDateKnown">; now: Date }) {
  const days = noReplyDays(job, now);
  return days === null ? null : <span className="no-reply">No reply in {days} days</span>;
}

export function JobCard({ job, settings, profile, now }: { job: Job; settings: Settings; profile: string; now: Date }) {
  const { minUsd, maxUsd } = usdRange(job);
  return (
    <article className="card">
      <Link href={pagePath(profile, `/jobs/${job.id}`)} className="card-title">
        {job.title}
      </Link>
      <div className="card-company">{job.company}</div>
      <div className="card-date">{stageDateLabel(job.stage, job.stageEnteredAt, job.stageDateKnown, now)}</div>
      <NoReplyTag job={job} now={now} />

      <div className="card-comp">
        <span className="money">{formatComp(job)}</span>
        {job.fitScore != null && <span className="fit">Fit {job.fitScore}</span>}
      </div>
      <CompGauge minUsd={minUsd} maxUsd={maxUsd} confirmed={compConfirmed(job.compSource)} floorUsd={settings.floorUsd} />

      {job.stage === "CLOSED" && (
        <div className={`closed-reason closed-${job.closedReason ?? "none"}`}>
          {job.closedReason ? CLOSED_REASON_LABEL[job.closedReason] : "No reason set"}
        </div>
      )}
      {job.postingClosedAt && (
        <div className="posting-closed" title={job.postingClosedEvidence ?? undefined}>
          Posting closed
        </div>
      )}
      <div className={`signal signal-${REMOTE_TONE[job.remoteVerdict]}`}>{remoteLabel(job.remoteVerdict, settings.homeCountryName)}</div>
      {job.needsCheck.length > 0 && (
        <ul className="checks">
          {job.needsCheck.map((c) => (
            <li key={c}>{checkLabel(c)}</li>
          ))}
        </ul>
      )}
      <JobStageSelect id={job.id} stage={job.stage} closedReason={job.closedReason} />
    </article>
  );
}
