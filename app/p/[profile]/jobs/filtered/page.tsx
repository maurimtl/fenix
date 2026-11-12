import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { JobStageSelect } from "@/components/job-stage-select";
import { PipelineTabs } from "@/components/pipeline-tabs";
import { listJobs } from "@/lib/jobs/repo";
import { filterReasonText, formatComp } from "@/lib/jobs/format";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";


export const dynamic = "force-dynamic";

export default async function FilteredJobs({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  const jobs = await listJobs(profile, true);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Filtered out</h1>
            <p className="lede">
              Roles that failed the salary or remote rule. If one was misread, move it to Needs a check; later hunts
              leave it there.
            </p>
          </div>
          <PipelineTabs profile={profile} active="filtered" filteredCount={jobs.length} />
        </div>

        {jobs.length === 0 ? (
          <div className="empty">
            <p>Nothing has been filtered out yet.</p>
          </div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Why it was dropped</th>
                <th scope="col">Salary</th>
                <th scope="col">Seen</th>
                <th scope="col"><span className="sr-only">Stage</span></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link href={pagePath(profile, `/jobs/${j.id}`)} className="ledger-title">{j.title}</Link>
                    <div className="card-company">{j.company}</div>
                  </td>
                  <td className="reason">{filterReasonText(j.filterReason)}</td>
                  <td className="money">{formatComp(j)}</td>
                  <td className="muted">{j.firstSeenAt.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</td>
                  <td><JobStageSelect id={j.id} stage={j.stage} closedReason={j.closedReason} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
