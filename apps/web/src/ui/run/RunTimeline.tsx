import type { Id, RunBundle, RunNote } from "@grooph/core";
import { useState } from "react";

import { duration, noteTarget, outcomeState, targetLabel } from "../../doc/run.js";
import { editorHref } from "../open/save.js";
import { pinNote, type Pinned } from "../../store/runs.js";
import { StateIcon } from "./StateIcon.js";

const time = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : iso;
};

/** The note's headline: its text, or what its amendment or proposal says. */
const headline = (note: RunNote): string => note.text ?? note.amendment?.summary ?? note.proposal?.summary ?? "";

/**
 * The run's notes in order (newest first while it is live). Tapping one
 * lights up its node, edge or loop on the canvas and opens its details,
 * where it can be pinned to the graph.
 */
export function RunTimeline(props: {
  bundle: RunBundle;
  notes: RunNote[];
  newestFirst: boolean;
  selected: Id | null;
  onSelect: (id: Id) => void;
  onShow: (tab: "changes" | "proposals") => void;
}) {
  const { bundle } = props;
  return (
    <div className="timeline">
      <p className="run-intro">{props.newestFirst ? "Newest first, while the run is live." : "In the order the run wrote them."} Tap a note to find it on the graph.</p>
      <ol className="tl-list">
        {props.notes.map((note) => {
          const on = props.selected === note.id;
          const target = noteTarget(note);
          const state = outcomeState(note.outcome);
          return (
            <li key={note.id} className={`tl-item${on ? " is-on" : ""}`} data-note-id={note.id}>
              <button type="button" className="tl-note" aria-expanded={on} onClick={() => props.onSelect(note.id)}>
                <span className="tl-head">
                  {state ? <StateIcon state={state} /> : <span className="tl-dot" aria-hidden="true" />}
                  <span className="tl-where">{targetLabel(target, bundle.working)}</span>
                  {note.round !== undefined ? <span className="tl-round">round {note.round}</span> : null}
                  {note.outcome ? (
                    <span className={`tl-outcome outcome-${state ?? "passed"}`}>
                      {note.outcome}
                      {note.verdict && note.verdict !== note.outcome ? ` · ${note.verdict}` : ""}
                    </span>
                  ) : null}
                  <span className="tl-id mono">{note.id}</span>
                </span>
                {note.amendment || note.proposal ? (
                  <span className="tl-marks">
                    {note.amendment ? <span className="mark mark-amendment">Amendment</span> : null}
                    {note.proposal ? <span className="mark mark-proposal">Proposal</span> : null}
                  </span>
                ) : null}
                {headline(note) ? <span className="tl-text">{headline(note)}</span> : null}
              </button>
              {on ? <NoteDetails bundle={bundle} note={note} onShow={props.onShow} /> : null}
            </li>
          );
        })}
      </ol>
      {bundle.issues && bundle.issues.length > 0 ? (
        <div className="warnings tl-unread">
          <p>
            <strong>
              {bundle.issues.length} line{bundle.issues.length === 1 ? "" : "s"} of notes.jsonl could not be read.
            </strong>{" "}
            The notes around {bundle.issues.length === 1 ? "it" : "them"} are shown; a line cut short while the lead was writing it looks like this.
          </p>
          <ul className="plain-list">
            {bundle.issues.map((issue) => (
              <li key={issue.line}>
                line {issue.line}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function NoteDetails({ bundle, note, onShow }: { bundle: RunBundle; note: RunNote; onShow: (tab: "changes" | "proposals") => void }) {
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const [busy, setBusy] = useState(false);
  const took = duration(note.started, note.ended);
  const rows: [string, string | string[] | undefined][] = [
    ["When", [time(note.started), time(note.ended)].filter(Boolean).join(" → ") + (took ? ` (${took})` : "") || undefined],
    ["Evidence", note.evidence],
    ["Gaps", note.gaps],
    ["Cost", note.cost ? `${note.cost.amount} ${note.cost.measure}` : undefined],
    ["Amendment", note.amendment ? note.amendment.summary : undefined],
    ["Why", note.amendment?.reason],
    ["Proposal", note.proposal?.summary],
    ["Note", note.text && (note.amendment || note.proposal) ? note.text : undefined],
  ];
  return (
    <div className="tl-details">
      <dl className="readonly">
        {rows
          .filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
          .map(([label, value]) => (
            <div key={label} className="readonly-row">
              <dt>{label}</dt>
              <dd>
                {Array.isArray(value) ? (
                  <ul className="plain-list">
                    {value.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="prose">{value}</p>
                )}
              </dd>
            </div>
          ))}
      </dl>
      <div className="tl-actions">
        {pinned ? (
          <p className="tl-pinned" role="status">
            {pinned.already
              ? `Already pinned to ${pinned.record.doc.name}.`
              : pinned.created
                ? `Saved ${pinned.record.doc.name} to this device with ${pinned.id} pinned to it.`
                : `Pinned ${pinned.id} to ${pinned.record.doc.name} on this device.`}{" "}
            <a href={editorHref(pinned.record.key)}>Open the graph</a>
          </p>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setPinned(await pinNote(bundle, note));
              } finally {
                setBusy(false);
              }
            }}
          >
            Pin to graph
          </button>
        )}
        {note.amendment ? (
          <button type="button" className="btn btn-quiet" onClick={() => onShow("changes")}>
            See what changed
          </button>
        ) : null}
        {note.proposal ? (
          <button type="button" className="btn btn-quiet" onClick={() => onShow("proposals")}>
            See the proposal
          </button>
        ) : null}
      </div>
    </div>
  );
}
