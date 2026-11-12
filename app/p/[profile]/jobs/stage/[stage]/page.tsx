import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { BoardControls } from "@/components/board-controls";
import { JobStageSelect } from "@/components/job-stage-select";
import { NoReplyTag } from "@/components/job-card";
import { PipelineTabs } from "@/components/pipeline-tabs";
import { countFiltered, listJobs } from "@/lib/jobs/repo";
import { BOARD_STAGES, CLOSED_REASON_LABEL, STAGE_LABEL, formatComp, remoteLabel } from "@/lib/jobs/format";
import type { JobStage } from "@/lib/jobs/types";
import { getSettings } from "@/lib/store/profiles";
import { pageProfile } from "@/lib/http";
import { filterBoard, parseBoardView, sortColumn, viewHref, type SearchParams } from "@/lib/jobs/board-view";
import { pagePath } from "@/lib/profile-url";

export const dynamic = "force-dynamic";

export default async function StageList({
  params,
  searchParams,
}: {
  params: Promise<{ profile: string; stage: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { profile: slug, stage: raw } = await params;
  const profile = await pageProfile(slug);
  const stage = raw as JobStage;
  if (!BOARD_STAGES.includes(stage)) notFound();
  const now = new Date();
  const view = parseBoardView(await searchParams, now);
  const [jobs, filtered, settings] = await Promise.all([listJobs(profile, false), countFiltered(profile), getSettings(profile)]);
  const inStage = jobs.filter((j) => j.stage === stage);
  const rows = sortColumn(filterBoard(inStage, view), view.sort);
  const base = pagePath(profile, `/jobs/stage/${stage}`);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page page-wide">
        <div className="page-head">
          <div>
            <h1>{STAGE_LABEL[stage]}</h1>
            <p className="lede">
              Every job in this column. <Link href={viewHref(pagePath(profile, "/jobs"), view, {})}>Back to the board</Link>
            </p>
          </div>
          <PipelineTabs profile={profile} active="stage" filteredCount={filtered} />
        </div>
        <BoardControls base={base} view={view} shown={rows.length} total={inStage.length} />
        {rows.length === 0 ? (
          <div className="empty">
            <p>No jobs in {STAGE_LABEL[stage]} for these dates.</p>
          </div>
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Pay</th>
                <th scope="col">Remote</th>
                <th scope="col">Days in stage</th>
                {stage === "CLOSED" && <th scope="col">Reason</th>}
                <th scope="col"><span className="sr-only">Stage</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link href={pagePath(profile, `/jobs/${j.id}`)} className="ledger-title">{j.title}</Link>
                    <div className="card-company">{j.company}</div>
                    <NoReplyTag job={j} now={now} />
                  </td>
                  <td className="money">{formatComp(j)}</td>
                  <td>{remoteLabel(j.remoteVerdict, settings.homeCountryName)}</td>
                  <td className="muted">{Math.floor((now.getTime() - j.stageEnteredAt.getTime()) / 86_400_000)}</td>
                  {stage === "CLOSED" && <td>{j.closedReason ? CLOSED_REASON_LABEL[j.closedReason] : "No reason set"}</td>}
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
