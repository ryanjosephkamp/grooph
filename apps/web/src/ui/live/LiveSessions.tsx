import { durationText, secondsBetween, type LiveAgent, type LiveSession, type LiveView } from "@grooph/core";
import { useEffect, useMemo, useState } from "react";

import { POLL_MS } from "../run/RunScreens.js";

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
    return json !== null && typeof json === "object" && json.groophLive === 0 && Array.isArray(json.sessions) && typeof json.at === "string" ? (json as LiveView) : undefined;
  } catch {
    return undefined;
  }
}

type Live = { view?: LiveView; error?: string; fetchedAt: number };

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
        else setLive((l) => ({ ...l, error: "There is no grooph watch here that serves sessions. Open the address grooph watch prints on your computer." }));
      } catch {
        setLive((l) => ({ ...l, error: "grooph watch is not answering. Is it still running?" }));
      }
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled]);
  return live;
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

function AgentRow({ agent, now, depth }: { agent: LiveAgent; now: string; depth: number }) {
  const running = agent.state === "running";
  const { name, of } = typeParts(agent.type);
  const time = running ? `running ${durationText(secondsBetween(agent.started, now))}` : `done in ${durationText(secondsBetween(agent.started, agent.ended ?? agent.lastAt))}`;
  const facts = [
    time,
    agent.stops > 1 ? `resumed ${agent.stops - 1}×` : undefined,
    agent.tools > 0 ? `${agent.tools} tool call${agent.tools === 1 ? "" : "s"}${agent.lastTool ? `, last ${agent.lastTool}` : ""}` : undefined,
    agent.model,
  ].filter(Boolean);
  return (
    <li className={`live-agent${running ? " is-running" : ""}`} data-agent-id={agent.id} data-agent-state={agent.state} style={{ marginLeft: depth * 18 }}>
      <span className="live-mark" role="img" aria-label={running ? "running" : "done"}>
        {running ? null : (
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

function SessionCard({ session, now }: { session: LiveSession; now: string }) {
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
    <section className={`live-session live-${session.state}`} data-session-id={session.id} data-session-state={session.state} aria-label={`${HARNESS[session.harness] ?? session.harness} session ${short(session.id)}`}>
      <header className="live-session-head">
        <div className="live-session-title">
          <span className={`live-harness live-harness-${session.harness === "codex" ? "codex" : "claude"}`}>{HARNESS[session.harness] ?? session.harness}</span>
          <span className={`status live-state live-state-${session.state}`}>
            {session.state === "working" ? <span className="live-dot is-on" aria-hidden="true" /> : null}
            {STATE[session.state]}
          </span>
        </div>
        <p className="live-session-sub">{sub}</p>
        <p className="live-session-facts">
          {session.agents.length === 0 ? "No subagents yet" : `${running} running · ${session.agents.length - running} done`}
          {session.tools > 0 ? ` · ${session.tools} tool call${session.tools === 1 ? "" : "s"} of its own` : ""}
          {session.state === "ended" ? ` · ran ${durationText(secondsBetween(session.started, session.ended ?? session.lastAt))}` : ` · last seen ${seen < 5 ? "just now" : `${durationText(seen)} ago`}`}
        </p>
      </header>
      {rows.length > 0 ? (
        <ul className="live-agents" aria-label="Subagents">
          {rows.map(({ agent, depth }) => (
            <AgentRow key={agent.id} agent={agent} now={now} depth={depth} />
          ))}
        </ul>
      ) : null}
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
  const working = sessions.filter((s) => s.state === "working").length;
  const runningAgents = sessions.reduce((n, s) => n + s.agents.filter((a) => a.state === "running").length, 0);

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
          {working > 0 ? `${runningAgents} running` : "Quiet"}
        </span>
      </header>

      <main className="live-main">
        {live.error ? (
          <p className="run-origin is-problem" role="status">
            {live.error} {live.view ? "Showing what it last sent; still asking." : "Still asking every two seconds."}
          </p>
        ) : null}
        {!live.view && !live.error ? <p className="muted live-empty">Asking the server this page came from for its sessions.</p> : null}
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
        <p className="field-hint live-foot">This shows that something ran, when and for how long. What an agent said is not recorded.</p>
      </main>
    </div>
  );
}
