import {
  formatIssue,
  followsName,
  runStateLine,
  setGraphName,
  summarizeRun,
  type Graph,
  type IssueLike,
} from "@grooph/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { openRouteFor } from "../doc/share.js";
import { runHref } from "../doc/run.js";
import { openStore, type GraphRecord, type RunRecord } from "../store/db.js";
import {
  createGraph,
  deleteGraph,
  duplicateGraph,
  importGraph,
  listGraphs,
  renameGraph,
} from "../store/library.js";
import type { TemplateRefusal } from "../doc/templates.js";
import { listRuns } from "../store/runs.js";
import { saveUserTemplate } from "../store/templates.js";
import { Glyph, hasLongGlyph } from "./Glyph.js";
import { Landing } from "./landing/Landing.js";
import { PersistNotice } from "./Notices.js";
import { piece } from "../piece.js";
import { templateHref } from "./templates/TemplatesScreen.js";

const when = (ms: number): string => {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString();
};

/**
 * What opens a document a person hands over, from a file or from a paste, is a piece of its own (./Import.tsx),
 * fetched when someone picks a file or opens the paste box. What is here is the door to it.
 */
type Door = typeof import("./Import.js");
/** Through `piece` (../piece.ts), so a fetch that failed is asked for again, in a way every engine honors. */
const door = (): Promise<Door> => piece("Import", () => import("./Import.js"));

/** On the front page the controls sit below the fold: bring what an import said into view. */
const inView = (el: HTMLElement | null): void => el?.scrollIntoView({ block: "nearest" });

/** A run's line in the list: its id, state and when it started. */
function RunRows({ runs }: { runs: RunRecord[] }) {
  return (
    <ul className="run-rows" aria-label="Runs">
      {runs.map((r) => {
        const summary = summarizeRun(r.bundle.notes, r.bundle.working);
        return (
          <li key={r.key}>
            <a className="run-row" href={runHref(r.key)}>
              <span className="run-row-name">
                Run <span className="mono">{r.run}</span>
              </span>
              <span className="run-row-meta">{runStateLine(summary)}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** The graphs on this device. */
export function Library({ open }: { open: (key: string, fresh?: boolean) => void }) {
  const [records, setRecords] = useState<GraphRecord[] | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [persistent, setPersistent] = useState(true);
  const [importProblem, setImportProblem] = useState<{ name: string; issues: IssueLike[]; what?: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [templateOffer, setTemplateOffer] = useState<{ name: string; doc: Graph; exists?: Graph; refusal: TemplateRefusal | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [PasteBox, setPasteBox] = useState<Door["PasteBox"] | null>(null);

  const refresh = useCallback(async () => {
    setRecords(await listGraphs());
    setRuns(await listRuns());
    setPersistent((await openStore()).persistent);
  }, []);
  useEffect(() => void refresh(), [refresh]);

  // The door, and what is said when the piece cannot be fetched: a first visit that lost its connection before the
  // worker held the file. The next try asks for it afresh.
  const host = { open, route: openRouteFor, problem: setImportProblem, offer: setTemplateOffer, close: () => setPasteBox(null) };
  const through = (name: string, then: (door: Door) => unknown): void =>
    void door().then(then, () => setImportProblem({ name, issues: [], what: "The part of grooph that opens it could not be fetched. It needs a connection the first time: try again when you have one." }));
  const onFile = (file: File | undefined): void => {
    if (file) through(file.name, async (door) => door.importText(await file.text(), file, host));
  };
  // A paste on this screen that is not into a field: a document or a link in it is opened, anything else is left
  // alone, and nothing is said. The text is read now, while the event holds it.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const text = event.clipboardData?.getData("text/plain");
      if (text && event.target instanceof Element && !event.target.closest("input, textarea, select")) {
        void door().then((door) => door.openPasted(text, host, true), () => undefined);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const addTemplate = async (doc: Graph, replace: boolean) => {
    const saved = await saveUserTemplate(doc, { replace });
    if ("exists" in saved) {
      setTemplateOffer((offer) => offer && { ...offer, exists: saved.exists });
      return;
    }
    setTemplateOffer(null);
    location.hash = templateHref("yours", saved.saved.id);
  };

  const controls = (
    <>
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
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="btn btn-large" onClick={() => through("what you paste", (door) => setPasteBox((shown: Door["PasteBox"] | null) => (shown ? null : door.PasteBox)))}>
          Paste a document
        </button>
      </div>

      {PasteBox ? <PasteBox host={host} /> : null}

      {!persistent ? (
        <p className="notice" role="status">
          This browser is not letting grooph store anything, so graphs last until the tab closes. Download them from Export to keep them.
        </p>
      ) : null}

      <PersistNotice />

      {templateOffer ? (
        <div className="offer" role="alert" ref={inView}>
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
        <div className="refusal" role="alert" ref={inView}>
          <p>
            <strong>Could not import {importProblem.name}.</strong> {importProblem.what ?? "It is not a graph document grooph can open."}
          </p>
          <pre className="issue-lines">{importProblem.issues.map(formatIssue).join("\n")}</pre>
          <button type="button" className="btn btn-small" onClick={() => setImportProblem(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );

  // Not read yet: nothing, rather than one page and then the other.
  if (records === null) return null;

  // Nothing of the person's own here: the front page, with the library's controls in it (handoff 0055).
  if (records.length === 0 && runs.length === 0) {
    return (
      <Landing
        device={
          <>
            <div className="library-empty land-empty">
              <p>No graphs on this device yet.</p>
              <p className="muted">
                Start one here, or import a <span className="mono">.grooph.json</span> graph, a <span className="mono">.grooph-proposals.json</span> set, a{" "}
                <span className="mono">.grooph-run.json</span> run or a <span className="mono">.grooph-map.json</span> operation map.
              </p>
            </div>
            {controls}
          </>
        }
      />
    );
  }

  return (
    <div className="library">
      <header className="library-head">
        <div>
          <h1 className="wordmark">grooph</h1>
          <p className="muted">Loop graphs for coding agents. Draw, validate, export.</p>
        </div>
        <a className="library-about" href="#/about">
          What is grooph?
        </a>
      </header>

      {controls}

      {records.length === 0 ? (
        <div className="library-empty">
          <p>No graphs on this device yet.</p>
          <p className="muted">
            Start a new one, or import a <span className="mono">.grooph.json</span> graph, a <span className="mono">.grooph-proposals.json</span> set, a{" "}
            <span className="mono">.grooph-run.json</span> run or a <span className="mono">.grooph-map.json</span> operation map.
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
                  <button type="button" className={`graph-open${hasLongGlyph(r.doc) ? " has-long-glyph" : ""}`} onClick={() => open(r.key)}>
                    <Glyph doc={r.doc} className="graph-glyph" decorative />
                    <span className="graph-text">
                      <span className="graph-name">{r.doc.name || "Untitled"}</span>
                      <span className="graph-meta">
                        <span className="mono">{r.doc.id}</span> · {r.doc.nodes.length} node{r.doc.nodes.length === 1 ? "" : "s"} ·{" "}
                        {r.doc.loops.length} loop{r.doc.loops.length === 1 ? "" : "s"} · {when(r.updatedAt)}
                      </span>
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
              {runs.some((run) => run.graphId === r.doc.id) ? <RunRows runs={runs.filter((run) => run.graphId === r.doc.id)} /> : null}
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

      {runs.some((run) => !records.some((r) => r.doc.id === run.graphId)) ? (
        <section className="orphan-runs" aria-label="Runs of graphs not on this device">
          <h2 className="list-title">Runs of graphs not on this device</h2>
          <RunRows runs={runs.filter((run) => !records.some((r) => r.doc.id === run.graphId))} />
        </section>
      ) : null}

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
