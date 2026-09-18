import { formatIssue, type Issue } from "@grooph/core";
import { useCallback, useEffect, useRef, useState } from "react";

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

const when = (ms: number): string => {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString();
};

/** The graphs on this device. */
export function Library({ open }: { open: (key: string, fresh?: boolean) => void }) {
  const [records, setRecords] = useState<GraphRecord[] | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [importProblem, setImportProblem] = useState<{ name: string; issues: Issue[] } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setRecords(await listGraphs());
    setPersistent((await openStore()).persistent);
  }, []);
  useEffect(() => void refresh(), [refresh]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const result = readGraphFile(await file.text());
    if (!result.doc) {
      setImportProblem({ name: file.name, issues: result.issues });
      return;
    }
    setImportProblem(null);
    const record = await importGraph(result.doc);
    open(record.key);
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

      {importProblem ? (
        <div className="refusal" role="alert">
          <p>
            <strong>Could not import {importProblem.name}.</strong> It is not a graph document grooph can open.
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
          <p className="muted">Start a new one, or import a <span className="mono">.grooph.json</span> file.</p>
        </div>
      ) : (
        <ul className="graph-list" aria-label="Graphs on this device">
          {records.map((r) => (
            <li key={r.key} className="graph-row">
              {renaming?.key === r.key ? (
                <form
                  className="rename"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await renameGraph(r.key, renaming.name);
                    setRenaming(null);
                    await refresh();
                  }}
                >
                  <input
                    className="input"
                    aria-label="Graph name"
                    value={renaming.name}
                    autoFocus
                    onChange={(e) => setRenaming({ key: r.key, name: e.target.value })}
                  />
                  <button type="submit" className="btn btn-primary">
                    Save
                  </button>
                  <button type="button" className="btn" onClick={() => setRenaming(null)}>
                    Cancel
                  </button>
                </form>
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
