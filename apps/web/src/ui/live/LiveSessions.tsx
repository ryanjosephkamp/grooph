import { durationText, isQuiet, mapLive, mapPicture, parseMap, planLine, secondsBetween, type LiveAgent, type LivePlan, type LiveSession, type LiveView, type OperationMap } from "@grooph/core";
import { useEffect, useMemo, useState } from "react";

import { copyText } from "../../doc/exportPackage.js";
import { POLL_MS } from "../run/RunScreens.js";
import "./live.css";

/**
 * The sessions endpoint `grooph watch` serves beside the app. Like the run's,
 * always this origin and this path: nothing in the address can point the app
 * anywhere else.
 */
export const sessionsEndpoint = (): string => new URL("api/live.json", document.baseURI).href;

/** A live view from the endpoint, or undefined when what came back is not one. */
export function parseLiveView(text: string): LiveView | undefined {
  try {
    const json = JSON.parse(text) as Partial<LiveView>;
    if (json === null || typeof json !== "object" || json.groophLive !== 0 || !Array.isArray(json.sessions) || typeof json.at !== "string") return undefined;
    // A map that came with the sessions is checked like any map from outside; one that does not parse is left out.
    const { map: given, ...rest } = json as LiveView;
    const map = given !== undefined ? parseMap(given).map : undefined;
    return map ? { ...rest, map } : rest;
  } catch {
    return undefined;
  }
}

type Live = { view?: LiveView; error?: string; fetchedAt: number; /** nothing here to ask, so nothing is asked */ off?: boolean };

const NO_WATCH = "There is no grooph watch here that serves sessions.";

/**
 * Whether a `grooph watch` can be behind this page. Watch serves plain http, so an https page has one only through
 * a proxy, and a proxy passes on the header watch sends with every answer. The page's own address is asked, which
 * every server has: a site with no watch (the public one) is never asked for an endpoint it can only answer with a 404.
 */
async function watchBehind(): Promise<boolean> {
  if (location.protocol !== "https:") return true;
  try {
    return (await fetch(document.baseURI, { method: "HEAD", cache: "no-store" })).headers.get("referrer-policy") === "no-referrer";
  } catch {
    return false;
  }
}

/** Ask the watch server for the sessions, every two seconds, for as long as the screen is up. */
export function useLiveSessions(enabled = true): Live {
  const [live, setLive] = useState<Live>({ fetchedAt: Date.now() });
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(sessionsEndpoint(), { cache: "no-store" });
        const view = (res.headers.get("content-type") ?? "").includes("application/json") && res.ok ? parseLiveView(await res.text()) : undefined;
        if (view) setLive({ view, fetchedAt: Date.now() });
        else setLive((l) => ({ ...l, error: NO_WATCH }));
      } catch {
        setLive((l) => ({ ...l, error: "grooph watch is not answering. Is it still running?" }));
      }
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    };
    void watchBehind().then((there) => {
      if (stopped) return;
      if (there) void poll();
      else setLive((l) => ({ ...l, error: NO_WATCH, off: true }));
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled]);
  return live;
}

const COMMAND = "grooph watch --sessions";

/** Nothing serves sessions here: what this screen is, and the command that fills it. */
function NoWatch({ live }: { live: Live }) {
  const [said, setSaid] = useState("");
  return (
    <div className="live-none">
      <h2>Your sessions, as they work</h2>
      <p>This screen shows each session the event hook has recorded on your computer, and its subagents as they start and stop.</p>
      <p role="status">{live.error} Run this in your project and open the address it prints:</p>
      <div className="copy-line">
        <code className="copy-line-text">{COMMAND}</code>
        <button type="button" className="btn btn-small" aria-label="Copy the command" onClick={async () => setSaid((await copyText(COMMAND)) ? "Copied." : "Could not copy. Select the line and copy it.")}>
          Copy
        </button>
        <span className="copy-line-said muted" role="status">
          {said}
        </span>
      </div>
      <p className="muted">
        <span className="mono">grooph hooks install</span> starts the recording. {live.off ? "" : "Still asking every two seconds."}
      </p>
    </div>
  );
}

const HARNESS: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex" };
const STATE: Record<LiveSession["state"], string> = { working: "Working", waiting: "Waiting", ended: "Ended" };
const short = (id: string): string => (id.length > 10 ? id.slice(-8) : id);
const folder = (cwd: string | undefined): string | undefined => cwd?.split("/").filter(Boolean).pop();

/** A package's subagent is named `<graph-id>--<node-id>`: show the node, and say which graph. */
function typeParts(type: string): { name: string; of?: string } {
  const cut = type.indexOf("--");
  return cut > 0 ? { name: type.slice(cut + 2), of: type.slice(0, cut) } : { name: type };
}

function AgentRow({ agent, now, depth, quiet }: { agent: LiveAgent; now: string; depth: number; quiet: boolean }) {
  // In a session gone quiet, a subagent with no stop on record is not known to be running.
  const running = agent.state === "running" && !quiet;
  const { name, of } = typeParts(agent.type);
  const time =
    agent.state === "running"
      ? quiet
        ? `not seen to finish, started ${durationText(secondsBetween(agent.started, now))} ago`
        : `running ${durationText(secondsBetween(agent.started, now))}`
      : `done in ${durationText(secondsBetween(agent.started, agent.ended ?? agent.lastAt))}`;
  const facts = [
    time,
    agent.stops > 1 ? `resumed ${agent.stops - 1}×` : undefined,
    agent.tools > 0 ? `${agent.tools} tool call${agent.tools === 1 ? "" : "s"}${agent.lastTool ? `, last ${agent.lastTool}` : ""}` : undefined,
    agent.model,
  ].filter(Boolean);
  return (
    <li className={`live-agent${running ? " is-running" : ""}`} data-agent-id={agent.id} data-agent-state={agent.state} style={{ marginLeft: depth * 18 }}>
      <span className="live-mark" role="img" aria-label={running ? "running" : agent.state === "running" ? "not seen to finish" : "done"}>
        {running || agent.state === "running" ? null : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      <span className="live-agent-text">
        <span className="live-agent-name">
          {name}
          {of ? <span className="badge badge-quiet">{of}</span> : null}
          <span className="live-id mono">{short(agent.id)}</span>
        </span>
        <span className="live-agent-facts">{facts.join(" · ")}</span>
      </span>
    </li>
  );
}

/** What the lead said it would start, each line ticked off against what the hook saw start. */
function PlanBlock({ plan, quiet }: { plan: LivePlan; quiet: boolean }) {
  return (
    <div className="live-plan" data-plan>
      <p className="live-plan-head">
        <span className="badge badge-quiet">plan</span> {plan.title ?? "Declared subagents"}
        <span className="live-plan-sum">{planLine(plan, quiet)}</span>
      </p>
      <ul className="live-plan-list">
        {plan.agents.map((a, i) => {
          const wanted = a.count ?? 1;
          const state = a.running > 0 ? "running" : a.started >= wanted ? "started" : a.started > 0 ? "partly" : "waiting";
          return (
            <li key={`${a.type}-${i}`} data-plan-state={state}>
              <span className="live-plan-type">
                {wanted > 1 ? `${wanted} × ` : ""}
                {typeParts(a.type).name}
              </span>
              <span className="live-plan-state">{state === "running" ? `${a.running} ${quiet ? "not seen to finish" : "running"}` : state === "started" ? "started" : state === "partly" ? `${a.started} of ${wanted} started` : "not started"}</span>
              {a.purpose ? <span className="live-plan-purpose">{a.purpose}</span> : null}
            </li>
          );
        })}
      </ul>
      {plan.unplanned.length > 0 ? <p className="live-plan-extra">Started without being in the plan: {plan.unplanned.map((t) => typeParts(t).name).join(", ")}</p> : null}
    </div>
  );
}

function SessionCard({ session, now }: { session: LiveSession; now: string }) {
  const quiet = isQuiet(session, now);
  const ids = new Set(session.agents.map((a) => a.id));
  const rows: { agent: LiveAgent; depth: number }[] = [];
  // A subagent sits under the agent that started it, where the harness said which that was.
  const walk = (parent: string | undefined, depth: number): void => {
    for (const a of session.agents) {
      const top = a.parent === undefined || !ids.has(a.parent);
      if (parent === undefined ? !top : a.parent !== parent) continue;
      rows.push({ agent: a, depth });
      walk(a.id, depth + 1);
    }
  };
  walk(undefined, 0);
  const running = session.agents.filter((a) => a.state === "running").length;
  const sub = [folder(session.cwd), session.model, `session ${short(session.id)}`].filter(Boolean).join(" · ");
  const seen = secondsBetween(session.lastAt, now);
  return (
    <section className={`live-session live-${quiet ? "quiet" : session.state}`} data-session-id={session.id} data-session-state={session.state} data-quiet={quiet || undefined} aria-label={`${HARNESS[session.harness] ?? session.harness} session ${short(session.id)}`}>
      <header className="live-session-head">
        <div className="live-session-title">
          <span className={`live-harness live-harness-${session.harness === "codex" ? "codex" : "claude"}`}>{HARNESS[session.harness] ?? session.harness}</span>
          {/* Each state has its colour, its mark (drawn by live.css before the words) and its words. */}
          <span className={`status live-state live-state-${quiet ? "quiet" : session.state}`}>
            {/* A record is as fresh as its last line. Past half an hour of silence it is not called working. */}
            {quiet ? `Last seen ${durationText(seen)} ago` : STATE[session.state]}
          </span>
        </div>
        <p className="live-session-sub">{sub}</p>
        <p className="live-session-facts">
          {session.agents.length === 0 ? "No subagents yet" : quiet && running > 0 ? `${running} not seen to finish · ${session.agents.length - running} done` : `${running} running · ${session.agents.length - running} done`}
          {session.tools > 0 ? ` · ${session.tools} tool call${session.tools === 1 ? "" : "s"} of its own` : ""}
          {session.state === "ended" ? ` · ran ${durationText(secondsBetween(session.started, session.ended ?? session.lastAt))}` : quiet ? ` · ${session.state} then` : ` · last seen ${seen < 5 ? "just now" : `${durationText(seen)} ago`}`}
        </p>
      </header>
      {session.plans && session.plans.length > 0 ? <PlanBlock plan={session.plans[session.plans.length - 1]!} quiet={quiet} /> : null}
      {rows.length > 0 ? (
        <ul className="live-agents" aria-label="Subagents">
          {rows.map(({ agent, depth }) => (
            <AgentRow key={agent.id} agent={agent} now={now} depth={depth} quiet={quiet} />
          ))}
        </ul>
      ) : null}
      {session.notes && session.notes.length > 0 ? (
        <ul className="live-notes" aria-label="Notes from the lead">
          {session.notes.slice(-3).map((n) => (
            <li key={n.t}>{n.text}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The operation map the sessions belong on, with what the hooks saw drawn on each of its sessions. */
function LiveMap({ map, view }: { map: OperationMap; view: LiveView }) {
  const svg = useMemo(() => mapPicture(map, { live: mapLive(view.sessions, map, view.at), at: view.at }), [map, view]);
  return (
    <section className="live-map" aria-label={`Operation map: ${map.name}`}>
      <div className="map-picture" dangerouslySetInnerHTML={{ __html: svg }} />
    </section>
  );
}

/**
 * `#/live` (docs/subagents.md §6): every session the event hook has recorded,
 * each with its subagents as they start and stop, from one harness or several.
 * It shows what a hook saw: that something ran, when, and for how long. What
 * an agent said is not in the events and so is not here.
 */
export function LiveSessions() {
  const live = useLiveSessions();
  // A clock that ticks between answers, kept in step with the server's: running times count up by the second.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = useMemo(() => (live.view ? new Date(Date.parse(live.view.at) + (Date.now() - live.fetchedAt)).toISOString() : new Date().toISOString()), [live, tick]);

  const sessions = live.view?.sessions ?? [];
  // Working first, then waiting, then ended; inside each, the most recently seen first.
  const order = { working: 0, waiting: 1, ended: 2 } as const;
  const sorted = [...sessions].sort((a, b) => order[a.state] - order[b.state] || (a.lastAt < b.lastAt ? 1 : -1));
  const groups = new Map<string, LiveSession[]>();
  for (const s of sorted) groups.set(s.source ?? "", [...(groups.get(s.source ?? "") ?? []), s]);
  // The header counts by the same clock as the cards: a session goes quiet in both at once.
  const working = sessions.filter((s) => s.state === "working" && !isQuiet(s, now)).length;
  const runningAgents = sessions.reduce((n, s) => n + (isQuiet(s, now) ? 0 : s.agents.filter((a) => a.state === "running").length), 0);
  // How many sessions are in each state: the page at a glance, and the key to the marks on the cards.
  const counts = { working: 0, waiting: 0, quiet: 0, ended: 0 };
  for (const s of sessions) counts[isQuiet(s, now) ? "quiet" : s.state] += 1;

  return (
    <div className="live-view">
      <header className="topbar">
        <a className="icon-btn" href="#/" aria-label="All graphs">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </a>
        <div className="title-btn run-title">
          <span className="title-name">Sessions</span>
          <span className="title-sub">what the event hook has seen · live</span>
        </div>
        <span className={`status ${working > 0 ? "run-status-running" : "run-status-ended"}`} role="status" aria-label={`${working} working, ${runningAgents} subagents running`}>
          {working > 0 ? `${runningAgents} running` : live.view ? "Quiet" : "Not connected"}
        </span>
      </header>

      <main className="live-main">
        {live.error && live.view ? (
          <p className="run-origin is-problem" role="status">
            {live.error} Showing what it last sent; still asking.
          </p>
        ) : null}
        {live.view ? null : live.error ? <NoWatch live={live} /> : <p className="muted live-empty">Asking the server this page came from for its sessions.</p>}
        <div className={`live-body${live.view?.map ? " has-map" : ""}`}>
          {live.view?.map ? <LiveMap map={live.view.map} view={live.view} /> : null}
          <div className="live-list">
            {sessions.length > 1 ? (
              <p className="live-sum" aria-label="Sessions by state">
                {(Object.keys(counts) as (keyof typeof counts)[]).map((state) =>
                  counts[state] > 0 ? (
                    <span key={state} className={`live-state-${state}`}>
                      {counts[state]} {state === "quiet" ? "gone quiet" : state}
                    </span>
                  ) : null,
                )}
              </p>
            ) : null}
            {live.view && sessions.length === 0 ? (
              <div className="live-empty">
                <p>No sessions recorded yet.</p>
                <p className="muted">
                  A hook writes one line when a session or a subagent starts or stops. Install it in the project with <span className="mono">grooph hooks install</span>, start a session, and it appears here.
                </p>
              </div>
            ) : null}
            {[...groups.entries()].map(([source, list]) => (
              <div key={source} className="live-group">
                {source !== "" ? <h2 className="live-source">{source}</h2> : null}
                {list.map((s) => (
                  <SessionCard key={`${s.harness}/${s.id}`} session={s} now={now} />
                ))}
              </div>
            ))}
            {live.view?.issues && live.view.issues.length > 0 ? (
              <p className="field-hint">
                {live.view.issues.length} line{live.view.issues.length === 1 ? "" : "s"} of the events could not be read (the first: {live.view.issues[0]!.source}, line {live.view.issues[0]!.line}).
              </p>
            ) : null}
            {live.view ? <p className="field-hint live-foot">This shows that something ran, when and for how long. What an agent said is not recorded, except a plan or a note its lead chose to leave.</p> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
