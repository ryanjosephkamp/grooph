import type { Id, RunBundle } from "@grooph/core";
import { useCallback, useMemo, useState } from "react";

import { duration, noteTarget, orderedNotes, runHref, runModel, targetHighlight } from "../../doc/run.js";
import { deleteRun, saveRun } from "../../store/runs.js";
import { ViewCanvas } from "../canvas/ViewCanvas.js";
import { RunChanges } from "./RunChanges.js";
import { RunProposals } from "./RunProposals.js";
import { RunTimeline } from "./RunTimeline.js";
import { StateIcon } from "./StateIcon.js";

/** Where the run came from, which decides what the view may offer to keep. */
export type RunOrigin =
  | { kind: "link" }
  | { kind: "stored"; key: string; savedAt: number }
  | { kind: "live"; updatedAt: number; error?: string; polling: boolean };

type Tab = "timeline" | "changes" | "proposals" | "log";

const STOP_WORDS: Record<string, string> = {
  "bar-passed": "bar passed",
  "max-iterations": "max iterations",
  budget: "budget",
  "diminishing-returns": "diminishing returns",
  "evidence-invalid": "evidence invalid",
  human: "human stop",
};

const ago = (ms: number): string => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 5 ? "just now" : s < 60 ? `${s} s ago` : `${Math.floor(s / 60)} min ago`;
};

/**
 * `#/run` (docs/runs.md §4): one run on its graph. The canvas shows each
 * node's state and each loop's round; below it, the timeline of notes, what
 * the run changed in its working copy (adopt or discard), and its proposals
 * (apply to a copy). Nothing is applied to any graph without a tap, and a
 * run from a link or a watch is stored only when the person saves it.
 */
export function RunView({ bundle, origin, back = { href: "#/", label: "All graphs" } }: { bundle: RunBundle; origin: RunOrigin; back?: { href: string; label: string } }) {
  const model = useMemo(() => runModel(bundle), [bundle]);
  const { summary } = model;
  const doc = bundle.working;
  const [tab, setTab] = useState<Tab>("timeline");
  const [selected, setSelected] = useState<Id | null>(null);
  const [kept, setKept] = useState<{ key: string; replaced: boolean } | null>(null);
  const [removing, setRemoving] = useState<"ask" | "done" | null>(null);

  const live = origin.kind === "live";
  const notes = orderedNotes(summary, live);
  const note = selected ? bundle.notes.find((n) => n.id === selected) : undefined;
  const highlight = useMemo(() => (note ? targetHighlight(noteTarget(note), doc) : undefined), [note, doc]);

  const showNote = useCallback((id: Id) => {
    setTab("timeline");
    setSelected(id);
    requestAnimationFrame(() => document.querySelector(`[data-note-id="${id}"]`)?.scrollIntoView({ block: "nearest" }));
  }, []);

  const onNodeTap = (id: Id) => {
    const last = [...bundle.notes].reverse().find((n) => n.at === `node:${id}`);
    if (last) showNote(last.id);
  };

  const stateText = summary.state === "ended" ? `Ended${summary.outcome ? ` · ${summary.outcome}` : ""}` : summary.state === "halted" ? "Halted" : "Running";
  const stateClass = summary.state === "running" ? "run-status-running" : summary.state === "halted" ? "status-warning" : summary.outcome === "pass" ? "status-ok" : summary.outcome === "fail" ? "status-error" : "run-status-ended";
  const loopsIndexed = doc.loops.map((loop, i) => ({ loop, i, run: summary.loops[loop.id] }));
  const cost = Object.entries(summary.cost).map(([measure, amount]) => `${amount} ${measure}`);
  const took = duration(summary.started, summary.ended);
  const facts = [
    took ? `${took} start to end` : undefined,
    cost.length > 0 ? `cost noted: ${cost.join(", ")}` : undefined,
    `${bundle.notes.length} note${bundle.notes.length === 1 ? "" : "s"}`,
  ].filter(Boolean);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "timeline", label: "Timeline", count: bundle.notes.length },
    { id: "changes", label: "Changes", count: model.diff.changes.length },
    { id: "proposals", label: "Proposals", count: summary.proposals.length },
    ...(bundle.progress ? [{ id: "log" as const, label: "Log" }] : []),
  ];

  const keep = async () => {
    const { record, replaced } = await saveRun(bundle);
    setKept({ key: record.key, replaced });
  };

  return (
    <div className="run-view">
      <header className="topbar">
        <a className="icon-btn" href={back.href} aria-label={back.label}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </a>
        <div className="title-btn run-title">
          <span className="title-name">{doc.name || doc.id}</span>
          <span className="title-sub">
            Run <span className="mono">{bundle.run}</span> · {origin.kind === "link" ? "from a link" : origin.kind === "live" ? "live" : "on this device"}
          </span>
        </div>
        <span className={`status run-status ${stateClass}`} role="img" aria-label={`Run state: ${stateText}`} data-run-state={summary.state}>
          <StateIcon state={summary.state === "ended" ? (summary.outcome === "fail" ? "failed" : "passed") : summary.state} />
          {stateText}
        </span>
      </header>

      <main className="stage run-stage">
        <ViewCanvas doc={doc} variant="full" issues={model.issues} run={summary} {...(highlight ? { highlight } : {})} onNodeTap={onNodeTap} />
        {loopsIndexed.length > 0 ? (
          <nav className="loop-legend" aria-label="Loops">
            {loopsIndexed.map(({ loop, i, run }) => {
              const on = highlight?.loop === loop.id;
              const stop = run?.lastStop?.fired ? STOP_WORDS[run.lastStop.fired] : undefined;
              return (
                <button
                  key={loop.id}
                  type="button"
                  className={`loop-pill loop-c${i % 4}${on ? " is-on" : ""}`}
                  data-loop-id={loop.id}
                  onClick={() => {
                    const last = run?.lastStop?.note ?? [...bundle.notes].reverse().find((n) => n.at === `loop:${loop.id}`)?.id;
                    if (last) showNote(last);
                  }}
                >
                  <span className={`loop-dot loop-c${i % 4}`} aria-hidden="true" />
                  {loop.name || loop.id}
                  <span className="loop-round">{run?.round === null || run === undefined ? "not entered" : `round ${run.round}`}</span>
                  {stop ? <span className="loop-stop">· {stop}</span> : null}
                </button>
              );
            })}
          </nav>
        ) : null}
      </main>

      <section className="run-panel" aria-label="Run details">
        <div className="run-facts">
          <p className="run-line">{facts.join(" · ")}</p>
          {origin.kind === "live" ? (
            <p className={`run-origin${origin.error ? " is-problem" : ""}`} role="status">
              <span className={`live-dot${origin.polling && !origin.error ? " is-on" : ""}`} aria-hidden="true" />
              {origin.error
                ? `${origin.error} Showing what it last sent, from ${ago(origin.updatedAt)}; still trying.`
                : origin.polling
                  ? `Live from grooph watch · updated ${ago(origin.updatedAt)}`
                  : `The run ended; grooph watch sent its last state ${ago(origin.updatedAt)}.`}
            </p>
          ) : null}
          {origin.kind === "stored" ? (
            <div className="run-origin">
              {removing === "done" ? (
                <span role="status">Removed from this device. The graph and its versions stay.</span>
              ) : (
                <>
                  <span>Kept on this device since {new Date(origin.savedAt).toLocaleDateString()}.</span>
                  {removing === "ask" ? (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={async () => {
                        await deleteRun(origin.key);
                        setRemoving("done");
                      }}
                    >
                      Remove for good
                    </button>
                  ) : (
                    <button type="button" className="btn btn-small btn-quiet" onClick={() => setRemoving("ask")}>
                      Remove
                    </button>
                  )}
                </>
              )}
            </div>
          ) : kept ? (
            <p className="run-origin" role="status">
              {kept.replaced ? "Updated the copy of this run on this device." : "Saved this run to this device; your graphs list it under its graph."}{" "}
              <a href={runHref(kept.key)}>Open the saved run</a>
            </p>
          ) : (
            <div className="run-origin">
              <span>Not stored on this device until you save it.</span>
              <button type="button" className="btn btn-small" onClick={() => void keep()}>
                {origin.kind === "live" ? "Save a copy" : "Save run"}
              </button>
            </div>
          )}
        </div>

        <div className="run-tabs" role="tablist" aria-label="Run">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`run-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`run-panel-${t.id}`}
              className={`run-tab${tab === t.id ? " is-on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.count !== undefined ? <span className="run-tab-count">{t.count}</span> : null}
            </button>
          ))}
        </div>

        {/* Keyed by tab, so each tab opens at its top rather than where the last one was scrolled. */}
        <div key={tab} className="run-body" role="tabpanel" id={`run-panel-${tab}`} aria-labelledby={`run-tab-${tab}`}>
          {tab === "timeline" ? (
            <RunTimeline
              bundle={bundle}
              notes={notes}
              newestFirst={notes !== summary.timeline}
              selected={selected}
              onSelect={(id) => setSelected((s) => (s === id ? null : id))}
              onShow={(t) => setTab(t)}
            />
          ) : tab === "changes" ? (
            <RunChanges model={model} onNote={showNote} />
          ) : tab === "proposals" ? (
            <RunProposals bundle={bundle} proposals={summary.proposals} onNote={showNote} />
          ) : (
            <pre className="run-log">{bundle.progress}</pre>
          )}
        </div>
      </section>
    </div>
  );
}
