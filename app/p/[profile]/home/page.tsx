import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PromptBox } from "@/components/prompt-box";
import { pageProfile } from "@/lib/http";
import { pagePath } from "@/lib/profile-url";
import { computeProgress, promptWho, setupPending, type StepKey } from "@/lib/start/progress";
import { computeToday, INTERVIEW_DAYS_AHEAD, type Today, type TodayList } from "@/lib/start/today";
import { isUnreadable } from "@/lib/store/paths";
import { FEATURES } from "@/lib/start/features";

export const dynamic = "force-dynamic";

const shellQuote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`);

const SEE: Partial<Record<StepKey, string>> = {
  career: "/canonical",
  stories: "/stories",
  interviews: "/interviews",
  design: "/designs",
  linkedin: "/linkedin",
  hunt: "/jobs",
};

function TodayGroup({ title, list }: { title: string; list: TodayList }) {
  if (list.lines.length === 0) return null;
  return (
    <div className="today-group">
      <h3>{title}</h3>
      <ul>
        {list.lines.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link> <span className="muted">· {l.detail}</span>
          </li>
        ))}
        {list.more > 0 && <li className="muted">and {list.more} more</li>}
      </ul>
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ profile: string }> }) {
  const profile = await pageProfile((await params).profile);
  // A broken job file must not take Home down: setup and the prompts are how a person gets unstuck.
  const todayOrError = computeToday(profile, new Date()).catch((e: unknown): string => {
    if (!isUnreadable(e)) throw e;
    return e instanceof Error ? e.message : String(e);
  });
  const [steps, todayResult, who] = await Promise.all([computeProgress(profile), todayOrError, promptWho(profile)]);
  const today: Today | null = typeof todayResult === "string" ? null : todayResult;
  const done = steps.filter((s) => s.done).length;
  const pending = setupPending(steps);
  const open = steps.filter((s) => !s.done);
  const nothingDue = today !== null && [today.interviews, today.cvReady, today.found, today.noReply].every((l) => l.lines.length === 0);

  return (
    <>
      <SiteHeader profile={profile} />
      <main className="page start home">
        <h1>Home</h1>

        <section className="home-block" aria-labelledby="h-today">
          <h2 id="h-today">Today</h2>
          {today === null ? (
            <p className="form-error">Can&rsquo;t read the job files: {String(todayResult)}. Run pnpm check:data to see which.</p>
          ) : nothingDue ? (
            <p className="muted">Nothing due today.</p>
          ) : (
            <>
              <TodayGroup title={`Interviews in the next ${INTERVIEW_DAYS_AHEAD} days`} list={today.interviews} />
              <TodayGroup title="CVs ready to send" list={today.cvReady} />
              <TodayGroup title="Jobs waiting on a check" list={today.found} />
              <TodayGroup title="Applications with no reply" list={today.noReply} />
            </>
          )}
        </section>

        <section className="home-block" aria-labelledby="h-setup">
          <h2 id="h-setup">Setup</h2>
          {pending ? (
            <>
              <p className="lede">
                {done} of {steps.length} done. Claude does the work in each step: open Claude Code, then tell it what you want in
                plain words. Each step has a sentence you can copy.
              </p>
              <ol className="start-steps">
                {steps.map((s) => (
                  <li key={s.key} className={`start-step${s.done ? " is-done" : ""}`}>
                    <div className="start-step-head">
                      <span className="start-tick" aria-label={s.done ? "Done" : "Not done"}>{s.done ? "✓" : ""}</span>
                      <h3>{s.label}</h3>
                      <span className="start-tag">{s.required ? "Needed" : "Optional"}</span>
                    </div>
                    <p className="start-detail">
                      {s.error ? <span className="form-error">Can&rsquo;t read this step&rsquo;s files: {s.error}</span> : s.detail}
                      {SEE[s.key] && (
                        <>
                          {" · "}
                          <Link href={pagePath(profile, SEE[s.key]!)}>Open</Link>
                        </>
                      )}
                    </p>
                    {!s.done && <PromptBox text={s.prompt} />}
                  </li>
                ))}
              </ol>
            </>
          ) : open.length === 0 ? (
            <p className="muted">Setup done.</p>
          ) : (
            <details className="home-optional">
              <summary>
                Setup done · still open: {open.map((s) => s.label.toLowerCase()).join(", ")}
              </summary>
              {open.map((s) => (
                <div key={s.key} className="home-optional-step">
                  <h3>{s.label}</h3>
                  <PromptBox text={s.prompt} />
                </div>
              ))}
            </details>
          )}
        </section>

        <section className="home-block" aria-labelledby="h-can">
          <h2 id="h-can">What Fenix can do</h2>
          <div className="start-step start-step-0">
            <h3>Open Claude Code in the Fenix folder</h3>
            <PromptBox text={`cd ${shellQuote(process.cwd())} && claude`} label="In a terminal" />
          </div>
          <ul className="home-features">
            {FEATURES.map((f) => (
              <li key={f.label}>
                <h3>
                  <Link href={pagePath(profile, f.href)}>{f.label}</Link>
                </h3>
                <p className="muted">{f.what}</p>
                <PromptBox text={f.prompt(who)} />
              </li>
            ))}
          </ul>
        </section>

        <section className="home-block" aria-labelledby="h-works">
          <h2 id="h-works">Works better with</h2>
          <ul className="home-works">
            <li>
              <b>Claude in Chrome</b> (needed for finding jobs, applying and reading LinkedIn). Install the Claude extension in
              Chrome and sign in; Claude then browses in your own signed-in Chrome. Before any LinkedIn page or application form,
              Claude checks that the person signed in is you.
            </li>
            <li>
              <b>Exa</b> (optional): a search engine for agents that finds postings plain web search misses. Add its MCP server to
              Claude Code with <code>claude mcp add</code>.
            </li>
            <li>
              <b>Tavily</b> (optional): another agent search engine; the job hunt uses it alongside Exa when both are there. Add it
              the same way.
            </li>
            <li>
              <b>Codex or ChatGPT</b>: everything except finding jobs, filling applications and reading LinkedIn works from the
              same files. Paste job links and fill in forms yourself.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
