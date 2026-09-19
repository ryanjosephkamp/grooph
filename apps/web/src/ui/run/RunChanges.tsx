import { formatIssue, type ChangedField, type Id } from "@grooph/core";
import { useState } from "react";

import { listChange, type RunModel } from "../../doc/run.js";
import { saveVersion } from "../../store/runs.js";
import { editorHref } from "../open/save.js";

const show = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value, null, 2));

function FieldChange({ field }: { field: ChangedField }) {
  const list = listChange(field.before, field.after);
  if (list && !list.reordered) {
    return (
      <div className="field-change">
        <span className="field-key mono">{field.key}</span>
        <ul className="field-diff">
          {list.removed.map((item, i) => (
            <li key={`d${i}`} className="del">
              <span className="sign" aria-label="removed">−</span>
              <del>{item}</del>
            </li>
          ))}
          {list.added.map((item, i) => (
            <li key={`a${i}`} className="ins">
              <span className="sign" aria-label="added">+</span>
              <ins>{item}</ins>
            </li>
          ))}
        </ul>
        {list.kept > 0 ? <p className="field-kept">{list.kept} unchanged</p> : null}
      </div>
    );
  }
  return (
    <div className="field-change">
      <span className="field-key mono">{field.key}</span>
      {list?.reordered ? <p className="field-kept">the same items in another order</p> : null}
      {field.before !== undefined ? (
        <div className="field-diff del">
          <span className="sign" aria-label="before">−</span>
          <del className="prose">{show(field.before)}</del>
        </div>
      ) : null}
      {field.after !== undefined ? (
        <div className="field-diff ins">
          <span className="sign" aria-label="after">+</span>
          <ins className="prose">{show(field.after)}</ins>
        </div>
      ) : null}
    </div>
  );
}

type Decision = { kind: "adopted"; key: string; version: number } | { kind: "discarded" };

/**
 * What the run changed: the working copy against the source, change by
 * change, each tied to the amendment note that explains it. Adopt saves the
 * working copy as the next version, as a new graph in the library; Discard
 * changes nothing and says so (docs/runs.md §4, spec §11, A-008).
 */
export function RunChanges({ model, onNote }: { model: RunModel; onNote: (id: Id) => void }) {
  const { bundle, diff, why, adoption, moved } = model;
  const { source, working } = bundle;
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const amendments = new Map(model.summary.amendments.map((n) => [n.id, n]));
  const next = source.version + 1;

  const adopt = async () => {
    if (!adoption.ok) return;
    setBusy(true);
    try {
      const record = await saveVersion(adoption.doc);
      setDecision({ kind: "adopted", key: record.key, version: adoption.doc.version });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="run-changes">
      <p className="run-intro">
        The run's working copy against the source it started from, {source.name || source.id} version {source.version}. Layout and notes aside.
      </p>
      {moved ? (
        <div className="warnings" role="note">
          <p>
            This run worked on version {working.version}, but the source it came with is version {source.version}: the source changed after the run started, so
            these are the differences from the source as it is now, not only what the run did.
          </p>
        </div>
      ) : null}

      {diff.changes.length === 0 ? (
        <p className="all-clear">No changes: the run followed the graph as it was.</p>
      ) : (
        <ol className="change-list">
          {diff.changes.map((change, i) => {
            const ids = why[i]!;
            return (
              <li key={i} className="change" data-change-at={change.at}>
                <p className="change-line">{change.line}</p>
                {change.fields.map((field) => (
                  <FieldChange key={field.key} field={field} />
                ))}
                {ids.length > 0 ? (
                  <p className="change-why">
                    <span className="change-why-label">Why:</span>{" "}
                    {ids.map((id) => (
                      <span key={id} className="change-why-note">
                        <button type="button" className="link mono" onClick={() => onNote(id)}>
                          {id}
                        </button>{" "}
                        {amendments.get(id)?.amendment?.reason}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="change-why is-unexplained">No amendment note explains this change. A run should record every change it makes; ask the lead why.</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {diff.changes.length > 0 && !diff.exact ? (
        <p className="field-hint">Not every change here is a grooph op; adopting takes the working copy itself, whatever the list can express.</p>
      ) : null}

      <div className="adopt" aria-label="Adopt or discard">
        {decision?.kind === "adopted" ? (
          <p className="adopt-done" role="status">
            Saved version {decision.version} of {source.name || source.id} to this device as a new graph. The source stays as it was.{" "}
            <a href={editorHref(decision.key)}>Open version {decision.version}</a>
          </p>
        ) : decision?.kind === "discarded" ? (
          <p className="adopt-done" role="status">
            Discarded. Nothing on this device changed, and the source stays at version {source.version}.{" "}
            <button type="button" className="link" onClick={() => setDecision(null)}>
              Undo
            </button>
          </p>
        ) : !adoption.ok ? (
          <div className="refusal">
            <p>
              <strong>This working copy cannot be adopted.</strong> {adoption.message}
            </p>
            <pre className="issue-lines">{adoption.issues.map(formatIssue).join("\n")}</pre>
            <button type="button" className="btn" onClick={() => setDecision({ kind: "discarded" })}>
              Discard
            </button>
          </div>
        ) : moved ? (
          <div className="refusal">
            <p>
              <strong>Not adoptable here.</strong> Adopting a run of version {working.version} over version {source.version} would undo what changed in between.
              Compare them by hand, or adopt a run of version {source.version}.
            </p>
          </div>
        ) : diff.changes.length === 0 ? (
          <p className="field-hint">Nothing to adopt: the working copy is the source.</p>
        ) : (
          <>
            <p className="field-hint">
              Adopt saves the working copy as version {next} of {source.name || source.id}, a new graph on this device; the source stays as it is. Discard leaves
              everything as it was.
            </p>
            <div className="actions-row">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void adopt()}>
                Adopt as version {next}
              </button>
              <button type="button" className="btn" onClick={() => setDecision({ kind: "discarded" })}>
                Discard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
