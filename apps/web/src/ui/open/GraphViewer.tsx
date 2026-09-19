import { validate, type Graph, type Id, type Issue } from "@grooph/core";
import { useMemo, useState, type ReactNode } from "react";

import { KIND_LABEL } from "../../doc/catalog.js";
import { countBySeverity } from "../../doc/issues.js";
import { ViewCanvas } from "../canvas/ViewCanvas.js";
import { Sheet } from "../Sheet.js";
import { GraphDetails, IssueList, LoopDetails, NodeDetails } from "./Details.js";
import { editorHref, useSaveFromLink } from "./save.js";

type Panel = { type: "node"; id: Id } | { type: "loop"; id: Id } | { type: "graph" } | { type: "issues" } | { type: "about" } | null;

/**
 * A graph from a link, read-only: look at it, tap for details, save it to the
 * device to edit it. There is no export here; export happens from the library.
 *
 * Templates open here too (slice 0007): they pass their own validation list,
 * an `about` panel that the title opens (and that is open on arrival), and
 * their own bar in place of Save.
 */
export function GraphViewer({
  doc,
  back,
  context,
  issues: given,
  about,
  bar,
}: {
  doc: Graph;
  back: { href: string; label: string };
  context?: string;
  issues?: Issue[];
  about?: { title: string; subtitle?: string; body: ReactNode };
  bar?: ReactNode;
}) {
  const issues = useMemo(() => given ?? validate(doc, { forExport: true }), [doc, given]);
  const { errors, warnings } = countBySeverity(issues);
  const [panel, setPanel] = useState<Panel>(about ? { type: "about" } : null);
  const [expanded, setExpanded] = useState(false);
  const { saved, busy, save } = useSaveFromLink();
  const done = saved["graph"];

  const statusClass = errors > 0 ? "status-error" : warnings > 0 ? "status-warning" : "status-ok";
  const statusText = errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "Valid";
  const toggle = (next: Exclude<Panel, null>) => setPanel((p) => (p && p.type === next.type && ("id" in p ? p.id === (next as { id: Id }).id : true) ? null : next));

  const sheet = (() => {
    if (!panel) return null;
    if (panel.type === "node") {
      const node = doc.nodes.find((n) => n.id === panel.id);
      return node ? { title: KIND_LABEL[node.kind], subtitle: node.id, body: <NodeDetails node={node} /> } : null;
    }
    if (panel.type === "loop") {
      const loop = doc.loops.find((l) => l.id === panel.id);
      return loop ? { title: "Loop", subtitle: loop.id, body: <LoopDetails doc={doc} loop={loop} /> } : null;
    }
    if (panel.type === "about") return about ?? null;
    if (panel.type === "graph") return { title: "Graph", subtitle: doc.id, body: <GraphDetails doc={doc} /> };
    return { title: "Validation", subtitle: "as export sees it", body: <IssueList issues={issues} /> };
  })();

  return (
    <div className={`editor viewer${sheet ? " has-sheet" : ""}${expanded && sheet ? " sheet-expanded" : ""}`}>
      <header className="topbar">
        <a className="icon-btn" href={back.href} aria-label={back.label}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </a>
        <button type="button" className="title-btn" onClick={() => toggle(about ? { type: "about" } : { type: "graph" })}>
          <span className="title-name">{doc.name || doc.id}</span>
          <span className="title-sub">{context ?? "from a link"} · read-only</span>
        </button>
        <button type="button" className={`status ${statusClass}`} aria-label={`Validation: ${statusText}`} onClick={() => toggle({ type: "issues" })}>
          {statusText}
        </button>
      </header>

      <main className="stage">
        <ViewCanvas doc={doc} variant="full" issues={issues} selected={panel?.type === "node" ? panel.id : undefined} onNodeTap={(id) => toggle({ type: "node", id })} />

        {doc.loops.length > 0 ? (
          <nav className="loop-legend" aria-label="Loops">
            {doc.loops.map((loop, i) => (
              <button
                key={loop.id}
                type="button"
                className={`loop-pill loop-c${i % 4}${panel?.type === "loop" && panel.id === loop.id ? " is-on" : ""}`}
                onClick={() => toggle({ type: "loop", id: loop.id })}
              >
                <span className={`loop-dot loop-c${i % 4}`} aria-hidden="true" />
                {loop.name || loop.id}
              </button>
            ))}
          </nav>
        ) : null}

        {bar ?? (
        <div className="viewer-bar" role="region" aria-label="Save">
          {done ? (
            <p className="viewer-saved" role="status">
              {done.existed ? "Already on this device." : done.persistent ? "Saved to this device." : "Saved for this visit only; this browser is not keeping data."}{" "}
              <a href={editorHref(done.key)}>Open it to edit</a>
            </p>
          ) : (
            <>
              <span className="viewer-note">Read-only. Nothing is stored until you save it.</span>
              <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void save("graph", doc)}>
                Save to this device
              </button>
            </>
          )}
        </div>
        )}
      </main>

      {sheet ? (
        <Sheet title={sheet.title} subtitle={sheet.subtitle} expanded={expanded} onToggle={() => setExpanded((e) => !e)} onClose={() => setPanel(null)}>
          {sheet.body}
        </Sheet>
      ) : null}
    </div>
  );
}
