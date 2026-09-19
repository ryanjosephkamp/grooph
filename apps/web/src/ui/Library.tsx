import { ShareError, formatIssue, isProposalSetLike, parseProposalSet, followsName, setGraphName, type Graph, type IssueLike } from "@grooph/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { openRouteFor } from "../doc/share.js";
import { openStore, type GraphRecord } from "../store/db.js";
import {
  createGraph,
  deleteGraph,
  duplicateGraph,
  importGraph,
  listGraphs,
  readGraphFile,
  renameGraph,
} from "../store/library.js";
import { templateRefusal, type TemplateRefusal } from "../doc/templates.js";
import { saveUserTemplate } from "../store/templates.js";
import { PersistNotice } from "./Notices.js";
import { templateHref } from "./templates/TemplatesScreen.js";

const when = (ms: number): string => {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString();
};

const isProposalSet = (text: string): boolean => {
  try {
    return isProposalSetLike(JSON.parse(text));
  } catch {
    return false;
  }
};

/** The graphs on this device. */
export function Library({ open }: { open: (key: string, fresh?: boolean) => void }) {
  const [records, setRecords] = useState<GraphRecord[] | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [importProblem, setImportProblem] = useState<{ name: string; issues: IssueLike[]; what?: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [templateOffer, setTemplateOffer] = useState<{ name: string; doc: Graph; exists?: Graph; refusal: TemplateRefusal | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setRecords(await listGraphs());
    setPersistent((await openStore()).persistent);
  }, []);
  useEffect(() => void refresh(), [refresh]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (isProposalSet(text)) {
      // A proposal set (grooph share --out) opens in the compare view, like its link; nothing is stored yet.
      const parsed = parseProposalSet(JSON.parse(text));
      try {
        if (!parsed.set) throw new ShareError("not a proposal set", parsed.issues);
        location.hash = openRouteFor(parsed.set);
      } catch (err) {
        if (!(err instanceof ShareError)) throw err;
        setImportProblem({ name: file.name, issues: err.issues, what: "It is a proposal set grooph cannot show. Make a self-contained copy with grooph share --out, which carries every graph." });
      }
      return;
    }
    const result = readGraphFile(text);
    if (!result.doc) {
      setImportProblem({ name: file.name, issues: result.issues });
      return;
    }
    setImportProblem(null);
    if (result.doc.template) {
      // A template file (from Download template, or a registry): offer it to "Yours" rather than opening it as a graph,
      // unless it carries errors, which grooph template add refuses too.
      setTemplateOffer({ name: file.name, doc: result.doc, refusal: templateRefusal(result.doc) });
      return;
    }
    const record = await importGraph(result.doc);
    open(record.key);
  };

  const addTemplate = async (doc: Graph, replace: boolean) => {
    const saved = await saveUserTemplate(doc, { replace });
    if ("exists" in saved) {
      setTemplateOffer((offer) => offer && { ...offer, exists: saved.exists });
      return;
    }
    setTemplateOffer(null);
    location.hash = templateHref("yours", saved.saved.id);
  };

  return (
    <div className="library">
      <header className="library-head">
        <div>
          <h1 className="wordmark">grooph</h1>
          <p className="muted">Loop graphs for coding agents. Draw, validate, export.</p>
        </div>
      </header>

      <div className="library-actions">
        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={async () => {
            const record = await createGraph();
            open(record.key, true);
          }}
        >
          New graph
        </button>
        <a className="btn btn-large" href="#/templates">
          Templates
        </a>
        <label className="btn btn-large file-btn">
          Import .grooph.json
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {!persistent ? (
        <p className="notice" role="status">
          This browser is not letting grooph store anything, so graphs last until the tab closes. Download them from Export to keep them.
        </p>
      ) : null}

      <PersistNotice />

      {templateOffer ? (
        <div className="offer" role="alert">
          <p>
            <strong>{templateOffer.name} is a template:</strong> {templateOffer.doc.template!.title}
            {templateOffer.doc.template!.kind === "fragment" ? " (a fragment)" : ""}.{" "}
            {templateOffer.refusal
              ? "It carries errors, so it cannot go into Yours; grooph template add refuses it too. Open it as a graph to fix it."
              : "Add it to Yours to use it from Templates."}
          </p>
          {templateOffer.refusal ? <pre className="issue-lines">{templateOffer.refusal.issues.map(formatIssue).join("\n")}</pre> : null}
          {templateOffer.exists ? (
            <p className="field-hint">
              Yours already has a template with the id <span className="mono">{templateOffer.doc.id}</span> (version {templateOffer.exists.version}). Replacing it
              makes version {Math.max(templateOffer.exists.version, templateOffer.doc.version) + 1}.
            </p>
          ) : null}
          <div className="offer-actions">
            {templateOffer.refusal ? null : templateOffer.exists ? (
              <button type="button" className="btn btn-primary" onClick={() => void addTemplate(templateOffer.doc, true)}>
                Replace yours
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => void addTemplate(templateOffer.doc, false)}>
                Add to Yours
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const record = await importGraph(templateOffer.doc);
                setTemplateOffer(null);
                open(record.key);
              }}
            >
              Open it as a graph
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setTemplateOffer(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {importProblem ? (
        <div className="refusal" role="alert">
          <p>
            <strong>Could not import {importProblem.name}.</strong> {importProblem.what ?? "It is not a graph document grooph can open."}
          </p>
          <pre className="issue-lines">{importProblem.issues.map(formatIssue).join("\n")}</pre>
          <button type="button" className="btn btn-small" onClick={() => setImportProblem(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {records === null ? null : records.length === 0 ? (
        <div className="library-empty">
          <p>No graphs on this device yet.</p>
          <p className="muted">
            Start a new one, or import a <span className="mono">.grooph.json</span> graph or a <span className="mono">.grooph-proposals.json</span> set.
          </p>
        </div>
      ) : (
        <ul className="graph-list" aria-label="Graphs on this device">
          {records.map((r) => (
            <li key={r.key} className="graph-row">
              {renaming?.key === r.key ? (
                <RenameForm
                  record={r}
                  name={renaming.name}
                  onName={(name) => setRenaming({ key: r.key, name })}
                  onCancel={() => setRenaming(null)}
                  onSave={async (keepId) => {
                    await renameGraph(r.key, renaming.name, { keepId });
                    setRenaming(null);
                    await refresh();
                  }}
                />
              ) : (
                <>
                  <button type="button" className="graph-open" onClick={() => open(r.key)}>
                    <span className="graph-name">{r.doc.name || "Untitled"}</span>
                    <span className="graph-meta">
                      <span className="mono">{r.doc.id}</span> · {r.doc.nodes.length} node{r.doc.nodes.length === 1 ? "" : "s"} ·{" "}
                      {r.doc.loops.length} loop{r.doc.loops.length === 1 ? "" : "s"} · {when(r.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Actions for ${r.doc.name}`}
                    aria-expanded={menu === r.key}
                    onClick={() => {
                      setMenu(menu === r.key ? null : r.key);
                      setConfirmDelete(null);
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="19" cy="12" r="1.6" />
                    </svg>
                  </button>
                </>
              )}
              {menu === r.key && renaming?.key !== r.key ? (
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setRenaming({ key: r.key, name: r.doc.name });
                      setMenu(null);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await duplicateGraph(r.key);
                      setMenu(null);
                      await refresh();
                    }}
                  >
                    Duplicate
                  </button>
                  {confirmDelete === r.key ? (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={async () => {
                        await deleteGraph(r.key);
                        setMenu(null);
                        setConfirmDelete(null);
                        await refresh();
                      }}
                    >
                      Delete for good
                    </button>
                  ) : (
                    <button type="button" className="btn btn-danger-text" onClick={() => setConfirmDelete(r.key)}>
                      Delete
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <footer className="library-foot muted">
        Graphs live in this browser on this device. Nothing is sent anywhere.{" "}
        <a href="https://github.com/ryanjosephkamp/grooph" rel="noopener">
          Source
        </a>
      </footer>
    </div>
  );
}

/**
 * Rename from the list. When the graph's package has been downloaded from
 * this device and the new name would change its id, say that the package
 * folder name changes with it, and offer to keep the old id (criterion 9).
 */
function RenameForm(props: { record: GraphRecord; name: string; onName: (name: string) => void; onSave: (keepId?: string) => void; onCancel: () => void }) {
  const { record } = props;
  const nextId = setGraphName(record.doc, props.name).id;
  const exportedAs = record.exported?.id;
  const warn = exportedAs !== undefined && nextId !== exportedAs && followsName(nextId, props.name);
  return (
    <form
      className="rename"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave();
      }}
    >
      <div className="rename-row">
        <input className="input" aria-label="Graph name" value={props.name} autoFocus onChange={(e) => props.onName(e.target.value)} />
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" className="btn" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
      {warn ? <RenameWarning exportedAs={exportedAs} nextId={nextId} onKeep={() => props.onSave(exportedAs)} /> : null}
    </form>
  );
}

export function RenameWarning({ exportedAs, nextId, onKeep }: { exportedAs: string; nextId: string; onKeep: () => void }) {
  return (
    <div className="rename-warning" role="alert">
      <p>
        This graph was exported from this device as <span className="mono">.grooph/{exportedAs}/</span>. With this name its id becomes{" "}
        <span className="mono">{nextId}</span>, so the next export writes a new package folder, <span className="mono">.grooph/{nextId}/</span>, beside the old
        one.
      </p>
      <button type="button" className="btn" onClick={onKeep}>
        Keep the old id
      </button>
    </div>
  );
}
