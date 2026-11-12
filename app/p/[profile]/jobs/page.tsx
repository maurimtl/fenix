import { SiteHeader } from "@/components/site-header";
import { PromptBox } from "@/components/prompt-box";
import { prompts } from "@/lib/start/prompts";
import { promptWho } from "@/lib/start/progress";
import { BoardControls } from "@/components/board-controls";
import { JobCard } from "@/components/job-card";
import { PipelineTabs } from "@/components/pipeline-tabs";
import { countFiltered, listJobs } from "@/lib/jobs/repo";
import Link from "next/link";
import { BOARD_STAGES, CLOSED_REASON_LABEL, LANE_CAP, STAGE_LABEL, stageHint, usdK } from "@/lib/jobs/format";
import { getSettings } from "@/lib/store/profiles";
import { pageProfile } from "@/lib/http";
import { filterBoard, parseBoardView, sortColumn, viewHref, type SearchParams } from "@/lib/jobs/board-view";
import { pagePath } from "@/lib/profile-url";

export const dynamic = "force-dynamic";

function summary(counts: Record<string, number>) {
  const parts = [
    counts.SHORTLISTED && `${counts.SHORTLISTED} shortlisted`,
    counts.CV_READY && `${counts.CV_READY} with a CV ready to send`,
    counts.FOUND && `${counts.FOUND} waiting on a check`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")}.` : "Nothing waiting on you.";
}

export default async function JobsBoard({
  params,
  searchParams,
}: {
  params: Promise<{ profile: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const profile = await pageProfile((await params).profile);
  const now = new Date();
  const view = parseBoardView(await searchParams, now);
  const [jobs, filtered, settings, who] = await Promise.all([listJobs(profile, false), countFiltered(profile), getSettings(profile), promptWho(profile)]);
  const shown = filterBoard(jobs, view);
  const summaryCounts = Object.fromEntries(BOARD_STAGES.map((s) => [s, jobs.filter((j) => j.stage === s).length]));
  const counts = Object.fromEntries(BOARD_STAGES.map((s) => [s, shown.filter((j) => j.stage === s).length]));

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page page-wide">
        <div className="page-head">
          <div>
            <h1>Pipeline</h1>
            {jobs.length > 0 && <p className="lede">{summary(summaryCounts)}</p>}
          </div>
          <PipelineTabs profile={profile} active="board" filteredCount={filtered} />
        </div>

        {jobs.length === 0 ? (
          <div className="empty">
            <h2>No jobs yet</h2>
            <p>
              Claude reads LinkedIn in your Chrome, plus job boards and the companies you follow, and saves every role that
              clears {usdK(settings.floorUsd)} and hires remotely in {settings.homeCountryName} here.
            </p>
            <PromptBox text={prompts.hunt(who)} />
          </div>
        ) : (
          <>
          <PromptBox text={prompts.hunt(who)} />
          <BoardControls base={pagePath(profile, "/jobs")} view={view} shown={shown.length} total={jobs.length} />
          <div
            className="board"
            style={{
              gridTemplateColumns: BOARD_STAGES.map((s) => (counts[s] ? "minmax(232px, 1fr)" : "128px")).join(" "),
            }}
          >
            {BOARD_STAGES.map((stage) => {
              const col = sortColumn(shown.filter((j) => j.stage === stage), view.sort);
              return (
                <section key={stage} className={`lane${col.length === 0 ? " lane-empty" : ""}`} aria-label={STAGE_LABEL[stage]}>
                  <header className="lane-head">
                    <h2>{STAGE_LABEL[stage]}</h2>
                    <span className="lane-count">{col.length}</span>
                  </header>
                  {stageHint(stage, settings) && <p className="lane-hint">{stageHint(stage, settings)}</p>}
                  {stage === "CLOSED" && col.length > 0 && <p className="lane-hint">{closedBreakdown(col)}</p>}
                  {col.slice(0, LANE_CAP).map((j) => (
                    <JobCard key={j.id} job={j} settings={settings} profile={profile} now={now} />
                  ))}
                  {col.length > LANE_CAP && (
                    <Link className="lane-more" href={viewHref(pagePath(profile, `/jobs/stage/${stage}`), view, {})}>
                      See all {col.length}
                    </Link>
                  )}
                </section>
              );
            })}
          </div>
          </>
        )}
      </main>
    </>
  );
}

function closedBreakdown(jobs: { closedReason: keyof typeof CLOSED_REASON_LABEL | null }[]): string {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const label = j.closedReason ? CLOSED_REASON_LABEL[j.closedReason].toLowerCase() : "no reason";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, n]) => `${n} ${label}`).join(" · ");
}
