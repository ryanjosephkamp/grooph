import { describePatch, type Id, type Op, type RunBundle, type RunNote } from "@grooph/core";
import { useState, type ReactNode } from "react";

import { noteTarget, proposalCopy, targetLabel } from "../../doc/run.js";
import { piece } from "../../piece.js";
import { saveVersion } from "../../store/runs.js";
import { editorHref } from "../open/save.js";

/** One op in a line: `updateEdge e-checks-critic: evidence`. */
function opLine(op: Op): string {
  const target = ["id", "key", "loop", "from", "kind"].map((k) => op[k]).find((v) => typeof v === "string");
  const set = op["set"] && typeof op["set"] === "object" ? Object.keys(op["set"] as object) : [];
  return `${op.op}${target ? ` ${String(target)}` : ""}${set.length > 0 ? `: ${set.join(", ")}` : ""}`;
}

/** `again`: the refusal is the device's and not the patch's, so the button stays for another try. */
type Applied = { ok: true; key: string; version: number; errors: number; warnings: number; brakes: ReactNode } | { ok: false; message: string; again?: true };

/**
 * The run's proposals: changes it wanted and did not make, for the human.
 * "Apply to a copy" applies an op-list patch to a copy of the working copy,
 * saved as a new version to inspect; any other patch is shown and explained,
 * never guessed at. Nothing is applied automatically (spec §11).
 */
export function RunProposals({ bundle, proposals, onNote }: { bundle: RunBundle; proposals: RunNote[]; onNote: (id: Id) => void }) {
  // By place in the list, not by a note's id: two notes of one run can carry the same id.
  const [applied, setApplied] = useState<Record<number, Applied>>({});
  const [busy, setBusy] = useState(false);

  const apply = async (note: RunNote, at: number) => {
    const copy = proposalCopy(bundle, note);
    if (!copy.ok) {
      setApplied((a) => ({ ...a, [at]: { ok: false, message: copy.message } }));
      return;
    }
    setBusy(true);
    try {
      const record = await saveVersion(copy.doc);
      // What the copy loosens that the graph has, said with it (the piece Adopt fetches; nothing is held here). The
      // piece says so when the copy is no valid graph and is not compared; this line is for a piece that did not
      // come, or a comparison that failed.
      const brakes = await piece("brakes", () => import("./brakes.js"))
        .then((b) => b.loosened(bundle.source, copy.doc, copy.graph))
        .catch(() => <p className="field-hint">Its brakes could not be compared with the graph's: the piece that compares them did not load. Open the copy and read its limits before you use it.</p>);
      setApplied((a) => ({
        ...a,
        [at]: {
          ok: true,
          key: record.key,
          brakes,
          version: copy.doc.version,
          errors: copy.issues.filter((i) => i.severity === "error").length,
          warnings: copy.issues.filter((i) => i.severity === "warning").length,
        },
      }));
    } catch {
      // The copy could not be kept on this device: said, and the buttons are given back.
      setApplied((a) => ({ ...a, [at]: { ok: false, again: true, message: "The copy could not be saved on this device. Press Apply to a copy to try again." } }));
    } finally {
      setBusy(false);
    }
  };

  if (proposals.length === 0) return <p className="run-intro">The run proposed nothing.</p>;
  return (
    <div className="run-proposals">
      <p className="run-intro">Changes the run proposed and did not make. Nothing is applied without you.</p>
      <ol className="proposal-list">
        {proposals.map((note, at) => {
          const patch = describePatch(note.proposal!.patch);
          const done = applied[at];
          return (
            <li key={at} className="proposal" data-proposal={note.id}>
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
                <div role="status">
                {done.brakes}
                <p className="adopt-done">
                  Saved a copy of the working copy with {note.id} applied, as version {done.version}, for you to inspect
                  {done.errors > 0 ? `; it has ${done.errors} error${done.errors === 1 ? "" : "s"}, which the editor lists` : done.warnings > 0 ? `; ${done.warnings} warning${done.warnings === 1 ? "" : "s"}` : "; it validates"}. Nothing
                  else changed. <a href={editorHref(done.key)}>Open the copy</a>
                </p>
                </div>
              ) : (
                <>
                  {done ? (
                    <p className="refusal-hint" role="status">
                      {done.message}
                    </p>
                  ) : null}
                  {patch.kind === "ops" && (!done || done.again) ? (
                    <button type="button" className="btn" disabled={busy} onClick={() => void apply(note, at)}>
                      Apply to a copy
                    </button>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
