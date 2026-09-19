import { describePatch, type Id, type Op, type RunBundle, type RunNote } from "@grooph/core";
import { useState } from "react";

import { noteTarget, proposalCopy, targetLabel } from "../../doc/run.js";
import { saveVersion } from "../../store/runs.js";
import { editorHref } from "../open/save.js";

/** One op in a line: `updateEdge e-checks-critic: evidence`. */
function opLine(op: Op): string {
  const target = ["id", "key", "loop", "from", "kind"].map((k) => op[k]).find((v) => typeof v === "string");
  const set = op["set"] && typeof op["set"] === "object" ? Object.keys(op["set"] as object) : [];
  return `${op.op}${target ? ` ${String(target)}` : ""}${set.length > 0 ? `: ${set.join(", ")}` : ""}`;
}

type Applied = { ok: true; key: string; version: number; errors: number; warnings: number } | { ok: false; message: string };

/**
 * The run's proposals: changes it wanted and did not make, for the human.
 * "Apply to a copy" applies an op-list patch to a copy of the working copy,
 * saved as a new version to inspect; any other patch is shown and explained,
 * never guessed at. Nothing is applied automatically (spec §11).
 */
export function RunProposals({ bundle, proposals, onNote }: { bundle: RunBundle; proposals: RunNote[]; onNote: (id: Id) => void }) {
  const [applied, setApplied] = useState<Record<Id, Applied>>({});

  const apply = async (note: RunNote) => {
    const copy = proposalCopy(bundle, note);
    if (!copy.ok) {
      setApplied((a) => ({ ...a, [note.id]: { ok: false, message: copy.message } }));
      return;
    }
    const record = await saveVersion(copy.doc);
    setApplied((a) => ({
      ...a,
      [note.id]: {
        ok: true,
        key: record.key,
        version: copy.doc.version,
        errors: copy.issues.filter((i) => i.severity === "error").length,
        warnings: copy.issues.filter((i) => i.severity === "warning").length,
      },
    }));
  };

  if (proposals.length === 0) return <p className="run-intro">The run proposed nothing.</p>;
  return (
    <div className="run-proposals">
      <p className="run-intro">Changes the run proposed and did not make. Nothing is applied without you.</p>
      <ol className="proposal-list">
        {proposals.map((note) => {
          const patch = describePatch(note.proposal!.patch);
          const done = applied[note.id];
          return (
            <li key={note.id} className="proposal" data-proposal={note.id}>
              <p className="proposal-summary">{note.proposal!.summary}</p>
              <p className="proposal-meta">
                <button type="button" className="link mono" onClick={() => onNote(note.id)}>
                  {note.id}
                </button>{" "}
                · {targetLabel(noteTarget(note), bundle.working)}
              </p>
              {note.text ? <p className="prose proposal-text">{note.text}</p> : null}
              {patch.kind === "ops" ? (
                <>
                  <ul className="op-list" aria-label="Patch">
                    {patch.ops.map((op, i) => (
                      <li key={i} className="mono">
                        {opLine(op)}
                      </li>
                    ))}
                  </ul>
                  <details className="more">
                    <summary>The patch as grooph ops</summary>
                    <pre className="issue-lines">{JSON.stringify(patch.ops, null, 2)}</pre>
                  </details>
                </>
              ) : patch.kind === "other" ? (
                <div className="proposal-other">
                  <p className="field-hint">{patch.why}</p>
                  <pre className="issue-lines">{JSON.stringify(note.proposal!.patch, null, 2)}</pre>
                </div>
              ) : (
                <p className="field-hint">No patch: the summary is the whole proposal.</p>
              )}
              {done?.ok ? (
                <p className="adopt-done" role="status">
                  Saved a copy of the working copy with {note.id} applied, as version {done.version}, for you to inspect
                  {done.errors > 0 ? `; it has ${done.errors} error${done.errors === 1 ? "" : "s"}, which the editor lists` : done.warnings > 0 ? `; ${done.warnings} warning${done.warnings === 1 ? "" : "s"}` : "; it validates"}. Nothing
                  else changed. <a href={editorHref(done.key)}>Open the copy</a>
                </p>
              ) : done ? (
                <p className="refusal-hint" role="status">
                  {done.message}
                </p>
              ) : patch.kind === "ops" ? (
                <button type="button" className="btn" onClick={() => void apply(note)}>
                  Apply to a copy
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
