import { addLoop, addNode, connect, followsName, toggleLoopBack, toggleLoopMember, type Graph, type Id, type Position } from "@grooph/core";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ADDABLE_KINDS, KIND_LABEL, type NodeKind } from "../doc/catalog.js";
import { computeIssues, countBySeverity, emptyHighlight, type Highlight } from "../doc/issues.js";
import { NODE_HEIGHT, NODE_WIDTH, resolvePositions } from "../doc/layout.js";
import { DocStore, useDoc, useHistory } from "../doc/store.js";
import { openStore, type GraphRecord } from "../store/db.js";
import { Canvas } from "./canvas/Canvas.js";
import { FIT } from "./canvas/fit.js";
import { EditorContext, type Editor, type Mode, type Panel } from "./editorContext.js";
import { ExportPanel } from "./ExportPanel.js";
import { EdgeInspector } from "./inspector/EdgeInspector.js";
import { GraphInspector } from "./inspector/GraphInspector.js";
import { LoopInspector } from "./inspector/LoopInspector.js";
import { NodeInspector } from "./inspector/NodeInspector.js";
import { IssuesPanel } from "./IssuesPanel.js";
import { keepGraphId } from "../store/library.js";
import { RenameWarning } from "./Library.js";
import { PersistNotice, Toast, type ToastMessage } from "./Notices.js";
import { Sheet } from "./Sheet.js";
import { InsertPanel } from "./templates/InsertPanel.js";
import { SaveTemplatePanel } from "./templates/SaveTemplatePanel.js";

export function EditorScreen({ graphKey, fresh }: { graphKey: string; fresh: boolean }) {
  const [record, setRecord] = useState<GraphRecord | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    openStore()
      .then((store) => store.get(graphKey))
      .then((r) => live && setRecord(r ?? null));
    return () => {
      live = false;
    };
  }, [graphKey]);

  if (record === undefined) return <div className="loading">Opening…</div>;
  if (record === null) {
    return (
      <div className="notfound">
        <p>This graph is not on this device.</p>
        <a className="btn btn-primary" href="#/">
          Back to graphs
        </a>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <EditorView record={record} fresh={fresh} />
    </ReactFlowProvider>
  );
}

/**
 * Saves the document to the device a moment after each change, and on the way
 * out. The record is read through a ref, so what else it carries (when the
 * package was last downloaded) is saved with the document, not overwritten.
 */
function useAutosave(store: DocStore, recordRef: { current: GraphRecord }): { state: "saved" | "saving" | "memory"; flush: () => Promise<void> } {
  const [state, setState] = useState<"saved" | "saving" | "memory">("saved");
  const pending = useRef<number | undefined>(undefined);
  const flush = useCallback(async () => {
    window.clearTimeout(pending.current);
    pending.current = undefined;
    const db = await openStore();
    recordRef.current = { ...recordRef.current, doc: store.get(), updatedAt: Date.now() };
    await db.put(recordRef.current);
    setState(db.persistent ? "saved" : "memory");
  }, [store, recordRef]);

  useEffect(() => {
    void openStore().then((db) => !db.persistent && setState("memory"));
    const unsubscribe = store.subscribe(() => {
      setState((s) => (s === "memory" ? s : "saving"));
      window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => void flush(), 250);
    });
    const onHide = () => {
      if (pending.current !== undefined) void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      if (pending.current !== undefined) void flush();
    };
  }, [store, flush]);
  return { state, flush };
}

function EditorView({ record, fresh }: { record: GraphRecord; fresh: boolean }) {
  const store = useMemo(() => new DocStore(record.doc), [record]);
  const doc = useDoc(store);
  const history = useHistory(store);
  const recordRef = useRef(record);
  const { state: saveState, flush } = useAutosave(store, recordRef);
  const [exportedAs, setExportedAs] = useState<Id | undefined>(record.exported?.id);
  const flow = useReactFlow();
  const stageRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Id[]>([]);
  const [toast, setToast] = useState<(ToastMessage & { after: Graph }) | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  const [panel, setPanel] = useState<Panel>(fresh ? { type: "graph" } : null);
  const [mode, setMode] = useState<Mode>({ type: "idle" });
  const [highlight, setHighlight] = useState<Highlight>(emptyHighlight);
  const [expanded, setExpanded] = useState(false);
  const [justAdded, setJustAdded] = useState<Id | null>(null);

  // While connecting or picking, the sheet folds to its header and the canvas
  // gets the room; show the whole graph so every target is on screen.
  const modeActive = mode.type !== "idle";
  useEffect(() => {
    if (!modeActive) return;
    requestAnimationFrame(() => requestAnimationFrame(() => void flow.fitView({ ...FIT, duration: 200 })));
  }, [modeActive, flow]);

  const issues = useMemo(() => computeIssues(doc), [doc]);
  const { errors, warnings } = countBySeverity(issues);

  const reveal = useCallback(
    (ids: Id[]) => {
      // Two frames: one for the document to render, one for the nodes to be measured.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          void flow.fitView({ ...FIT, nodes: ids.map((id) => ({ id })), duration: 250 });
        }),
      );
    },
    [flow],
  );

  /** Pan (never zoom) so a node is clear of the sheet and the toolbar, after the sheet has opened. */
  const ensureVisible = useCallback(
    (id: Id) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const stage = stageRef.current?.getBoundingClientRect();
          const el = stageRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
          if (!stage || !el) return;
          const r = el.getBoundingClientRect();
          // The floating toolbar covers the foot of the canvas; docked above the sheet, it covers nothing.
          const bar = toolbarRef.current?.getBoundingClientRect();
          const floor = bar && bar.height > 0 && bar.top < stage.bottom && bar.bottom > stage.top ? Math.min(bar.top, stage.bottom) - 8 : stage.bottom - 8;
          const clear = r.top >= stage.top + 56 && r.bottom <= floor && r.left >= stage.left && r.right <= stage.right;
          if (clear) return;
          const node = flow.getInternalNode(id);
          if (!node) return;
          const { x, y } = node.internals.positionAbsolute;
          const w = node.measured.width ?? NODE_WIDTH;
          const h = node.measured.height ?? NODE_HEIGHT;
          void flow.setCenter(x + w / 2, y + h / 2, { zoom: flow.getZoom(), duration: 200 });
        }),
      );
    },
    [flow],
  );

  const openPanel = useCallback((next: Panel) => {
    setPanel(next);
    if (next === null || !["node", "edge", "loop"].includes(next.type)) setExpanded(false);
    setMode((m) => (m.type === "pick" && !(next?.type === "loop" && next.id === m.loopId) ? { type: "idle" } : m));
  }, []);

  const onEdgeTap = useCallback(
    (edgeId: Id) => {
      if (mode.type === "pick") {
        store.update((d) => toggleLoopBack(d, mode.loopId, edgeId));
        return;
      }
      setMode({ type: "idle" });
      openPanel({ type: "edge", id: edgeId });
    },
    [mode, store, openPanel],
  );

  const onNodeTap = useCallback(
    (nodeId: Id) => {
      if (mode.type === "pick") {
        store.update((d) => toggleLoopMember(d, mode.loopId, nodeId));
        return;
      }
      if (mode.type === "connect") {
        if (mode.from === undefined) setMode({ type: "connect", from: nodeId });
        else if (mode.from === nodeId) setMode({ type: "connect" });
        else {
          const from = mode.from;
          const { id } = store.updateWith((d) => connect(d, from, nodeId));
          setMode({ type: "idle" });
          openPanel({ type: "edge", id });
          // A layout-free graph re-lays itself out around the new edge; follow its ends.
          reveal([from, nodeId]);
        }
        return;
      }
      openPanel({ type: "node", id: nodeId });
      setSelection([nodeId]);
      ensureVisible(nodeId);
    },
    [mode, store, openPanel, ensureVisible, reveal],
  );

  /** Where a new node goes: below the selected node, else the middle of the view; never on top of another. */
  const placeFor = useCallback((): Position | undefined => {
    const current = store.get();
    if (!current.layout) return undefined;
    const { positions } = resolvePositions(current);
    let at: Position;
    const anchor = panel?.type === "node" ? positions[panel.id] : undefined;
    if (anchor) at = { x: anchor.x, y: anchor.y + NODE_HEIGHT + 64 };
    else {
      const rect = stageRef.current?.getBoundingClientRect();
      const c = rect ? flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) : { x: 0, y: 0 };
      at = { x: c.x - NODE_WIDTH / 2, y: c.y - NODE_HEIGHT / 2 };
    }
    const taken = Object.values(positions);
    while (taken.some((p) => Math.abs(p.x - at.x) < NODE_WIDTH * 0.6 && Math.abs(p.y - at.y) < NODE_HEIGHT * 0.8)) {
      at = { x: at.x, y: at.y + NODE_HEIGHT + 24 };
    }
    return at;
  }, [store, panel, flow]);

  const add = (kind: NodeKind) => {
    const { id } = store.updateWith((d) => addNode(d, kind, { at: placeFor() }));
    setMode({ type: "idle" });
    openPanel({ type: "node", id });
    setJustAdded(id);
    reveal([id]);
  };

  const startLoop = () => {
    const members = panel?.type === "node" ? [panel.id] : [];
    const { id } = store.updateWith((d) => addLoop(d, members));
    setPanel({ type: "loop", id });
    setMode({ type: "pick", loopId: id });
  };

  const undo = useCallback(() => {
    store.undo();
    setToast(null);
  }, [store]);
  const redo = useCallback(() => {
    store.redo();
    setToast(null);
  }, [store]);

  // Cmd/Ctrl+Z undoes, Shift+Cmd/Ctrl+Z (or Ctrl+Y) redoes: the document's edits, in text fields too.
  // Forms whose fields are not the document yet (Insert, Save as template) keep the browser's own undo of the text typed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("[data-own-undo]")) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y" && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // An undo or redo can take away what the sheet shows, or the loop being picked: close them rather than show nothing.
  useEffect(() => {
    if (panel && (panel.type === "node" || panel.type === "edge" || panel.type === "loop")) {
      const list = panel.type === "node" ? doc.nodes : panel.type === "edge" ? doc.edges : doc.loops;
      if (!list.some((item) => item.id === panel.id)) openPanel(null);
    }
    if (mode.type === "pick" && !doc.loops.some((l) => l.id === mode.loopId)) setMode({ type: "idle" });
    if (mode.type === "connect" && mode.from !== undefined && !doc.nodes.some((n) => n.id === mode.from)) setMode({ type: "connect" });
  }, [doc, panel, mode, openPanel]);

  // The toast's Undo takes back the deletion only while it is still the last edit.
  useEffect(() => {
    if (toast && doc !== toast.after) setToast(null);
  }, [doc, toast]);

  const deleted = useCallback(
    (what: string) => {
      const after = store.get();
      setToast({ id: Date.now(), text: `Deleted ${what}`, after, undo: () => store.get() === after && store.undo() });
    },
    [store],
  );

  const markExported = useCallback(() => {
    const id = store.get().id;
    recordRef.current = { ...recordRef.current, exported: { id, at: Date.now() } };
    setExportedAs(id);
    void flush();
  }, [store, flush]);

  const editor: Editor = {
    store,
    panel,
    openPanel,
    mode,
    setMode,
    highlight,
    setHighlight,
    reveal,
    onEdgeTap,
    selection,
    setSelection,
    deleted,
    exportedAs,
    markExported,
  };
  // Renaming changed an id that a downloaded package was named after (criterion 9).
  const renamedAfterExport = exportedAs !== undefined && doc.id !== exportedAs && followsName(doc.id, doc.name);

  const sheet = sheetFor(panel, doc, issues, fresh, justAdded, renamedAfterExport ? (
    <RenameWarning exportedAs={exportedAs!} nextId={doc.id} onKeep={() => store.update((d) => keepGraphId(d, exportedAs!))} />
  ) : null);
  const statusClass = errors > 0 ? "status-error" : warnings > 0 ? "status-warning" : "status-ok";
  const statusText = errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "Valid";

  return (
    <EditorContext.Provider value={editor}>
      <div className={`editor${panel ? " has-sheet" : ""}${expanded && !modeActive ? " sheet-expanded" : ""}${modeActive ? " mode-active" : ""}`}>
        <header className="topbar">
          <a className="icon-btn" href="#/" aria-label="All graphs">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </a>
          <button
            type="button"
            className={`title-btn${highlight.graph ? " is-highlighted" : ""}`}
            onClick={() => openPanel(panel?.type === "graph" ? null : { type: "graph" })}
          >
            <span className="title-name">{doc.name || "Untitled"}</span>
            <span className="title-sub">
              {doc.target?.harness ?? "no target"} · {saveState === "memory" ? "not saved on this device" : saveState === "saving" ? "saving…" : "saved"}
            </span>
          </button>
          <button
            type="button"
            className={`status ${statusClass}`}
            aria-label={`Validation: ${statusText}`}
            onClick={() => openPanel(panel?.type === "issues" ? null : { type: "issues" })}
          >
            {statusText}
          </button>
          <button type="button" className="btn btn-primary topbar-export" onClick={() => openPanel(panel?.type === "export" ? null : { type: "export" })}>
            Export
          </button>
        </header>

        <PersistNotice className="editor-notice" />

        <main className="stage" ref={stageRef}>
          <Canvas issues={issues} onNodeTap={onNodeTap} />

          {doc.loops.length > 0 ? (
            <nav className="loop-legend" aria-label="Loops">
              {doc.loops.map((loop, i) => (
                <button
                  key={loop.id}
                  type="button"
                  className={`loop-pill loop-c${i % 4}${panel?.type === "loop" && panel.id === loop.id ? " is-on" : ""}`}
                  onClick={() => openPanel({ type: "loop", id: loop.id })}
                >
                  <span className={`loop-dot loop-c${i % 4}`} aria-hidden="true" />
                  {loop.name || loop.id}
                </button>
              ))}
            </nav>
          ) : null}

          {mode.type !== "idle" ? <ModeBanner mode={mode} doc={doc} onDone={() => setMode({ type: "idle" })} /> : null}


          <Toast toast={toast} onDone={hideToast} />

          {doc.nodes.length === 0 ? (
            <div className="empty-canvas">
              <p>An empty graph.</p>
              <p className="muted">Add a node to start: an agent, a human gate, a check, or a stop.</p>
            </div>
          ) : null}

          <div className="toolbar" role="toolbar" aria-label="Canvas" ref={toolbarRef}>
            <button type="button" className="tool" onClick={() => openPanel(panel?.type === "add" ? null : { type: "add" })} aria-pressed={panel?.type === "add"}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
            </button>
            <button
              type="button"
              className="tool"
              aria-pressed={mode.type === "connect"}
              disabled={doc.nodes.length < 2}
              onClick={() =>
                setMode(mode.type === "connect" ? { type: "idle" } : { type: "connect", from: panel?.type === "node" ? panel.id : undefined })
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="6" cy="7" r="2.5" />
                <circle cx="18" cy="17" r="2.5" />
                <path d="M8 8.5 16 15.5" />
              </svg>
              Connect
            </button>
            <button type="button" className="tool" disabled={doc.nodes.length === 0} aria-pressed={mode.type === "pick"} onClick={startLoop}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 8a6 6 0 1 1-1 7" />
                <path d="M3 13.5 6 15l2-3" />
              </svg>
              Loop
            </button>
            <button type="button" className="tool" disabled={doc.nodes.length === 0} onClick={() => void flow.fitView({ ...FIT, duration: 250 })}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
              </svg>
              Fit
            </button>
            <button type="button" className="tool" disabled={!history.canUndo} onClick={undo} aria-keyshortcuts="Control+Z Meta+Z">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
              </svg>
              Undo
            </button>
            <button type="button" className="tool" disabled={!history.canRedo} onClick={redo} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 14 5-5-5-5" />
                <path d="M20 9H10a6 6 0 0 0 0 12h3" />
              </svg>
              Redo
            </button>
          </div>
        </main>

        {sheet ? (
          <Sheet
            title={sheet.title}
            subtitle={sheet.subtitle}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            onClose={() => {
              openPanel(null);
              setMode({ type: "idle" });
            }}
          >
            {panel?.type === "add" ? <AddMenu onAdd={add} onInsert={() => openPanel({ type: "insert" })} /> : sheet.body}
          </Sheet>
        ) : null}
      </div>
    </EditorContext.Provider>
  );
}

function sheetFor(panel: Panel, doc: Graph, issues: ReturnType<typeof computeIssues>, fresh: boolean, justAdded: Id | null, renameWarning: ReactNode) {
  if (!panel) return null;
  switch (panel.type) {
    case "node": {
      const node = doc.nodes.find((n) => n.id === panel.id);
      return { title: node ? KIND_LABEL[node.kind] : "Node", subtitle: node?.id, body: <NodeInspector id={panel.id} key="node" focusName={justAdded === panel.id} /> };
    }
    case "edge": {
      const edge = doc.edges.find((e) => e.id === panel.id);
      return { title: "Edge", subtitle: edge?.id, body: <EdgeInspector id={panel.id} key="edge" /> };
    }
    case "loop":
      return { title: "Loop", subtitle: panel.id, body: <LoopInspector id={panel.id} key="loop" /> };
    case "graph":
      return { title: "Graph", subtitle: doc.id, body: <GraphInspector autoFocusName={fresh && doc.nodes.length === 0} renameWarning={renameWarning} /> };
    case "issues":
      return { title: "Validation", subtitle: "as export sees it", body: <IssuesPanel issues={issues} /> };
    case "export":
      return { title: "Export", subtitle: doc.target?.harness ?? "no target", body: <ExportPanel /> };
    case "add":
      return { title: "Add a node", subtitle: undefined, body: null };
    case "insert":
      return { title: "Insert a template", subtitle: "into this graph", body: <InsertPanel key="insert" /> };
    case "save-template":
      return { title: "Save as template", subtitle: "to Yours, on this device", body: <SaveTemplatePanel key="save-template" /> };
  }
}

const KIND_HINT: Record<(typeof ADDABLE_KINDS)[number], string> = {
  agent: "A worker with a role, a brief and outputs.",
  "human-gate": "The run stops and asks a person.",
  check: "A command, tests or a metric that passes or fails.",
  stop: "Where the run ends.",
};

function AddMenu({ onAdd, onInsert }: { onAdd: (kind: NodeKind) => void; onInsert: () => void }) {
  return (
    <div className="add-menu">
      {ADDABLE_KINDS.map((kind) => (
        <button key={kind} type="button" className={`add-kind add-${kind}`} onClick={() => onAdd(kind)}>
          <span className="add-kind-name">
            <span className={`kind-mark kind-${kind}`} aria-hidden="true" />
            {KIND_LABEL[kind]}
          </span>
          <span className="add-kind-hint">{KIND_HINT[kind]}</span>
        </button>
      ))}
      <button type="button" className="add-kind add-template" onClick={onInsert}>
        <span className="add-kind-name">
          <span className="kind-mark kind-template" aria-hidden="true" />
          Insert a template
        </span>
        <span className="add-kind-hint">A fragment or a whole pattern, from Templates.</span>
      </button>
    </div>
  );
}

function ModeBanner({ mode, doc, onDone }: { mode: Mode; doc: Graph; onDone: () => void }) {
  const name = (id: Id | undefined) => doc.nodes.find((n) => n.id === id)?.name ?? id;
  let text: string;
  if (mode.type === "connect") text = mode.from ? `From ${name(mode.from)}: tap the node the edge goes to.` : "Tap the node the edge starts from.";
  else if (mode.type === "pick") {
    const loop = doc.loops.find((l) => l.id === mode.loopId);
    text = `Picking ${loop?.name ?? "loop"}: tap nodes to add members, tap an edge label to mark a back edge.`;
  } else return null;
  return (
    <div className="mode-banner" role="status">
      <span>{text}</span>
      <button type="button" className="btn btn-small" onClick={onDone}>
        {mode.type === "pick" ? "Done" : "Cancel"}
      </button>
    </div>
  );
}
