import type { Graph, Id, Issue } from "@grooph/core";
import { useMemo, useState, type ReactNode } from "react";

import { KIND_LABEL } from "../../doc/catalog.js";
import { LookMenu } from "../canvas/LookMenu.js";
import { computeIssues, countBySeverity, packageNeeds } from "../../doc/issues.js";
import { isDesktop } from "../canvas/fit.js";
import { ViewCanvas } from "../canvas/ViewCanvas.js";
import { Sheet } from "../Sheet.js";
import { Keep } from "../Keep.js";
import { PackageNeeds } from "../PackageNeeds.js";
import { Outline, OutlineButton } from "../Outline.js";
import { GraphDetails, IssueList, LoopDetails, NodeDetails } from "./Details.js";
import { editorHref, useSaveFromLink } from "./save.js";

type Panel = { type: "node"; id: Id } | { type: "loop"; id: Id } | { type: "graph" } | { type: "issues" } | { type: "about" } | { type: "outline" } | null;

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
  // The graph's own findings. What only a package for a harness asks for is said apart, under them (amendment
  // A-020: a graph is a plan first, and a plan needs no harness and no goal).
  const issues = useMemo(() => given ?? computeIssues(doc), [doc, given]);
  const { errors, warnings } = countBySeverity(issues);
  const [panel, setPanel] = useState<Panel>(about ? { type: "about" } : null);
  const [expanded, setExpanded] = useState(false);
  // On a desktop the outline is a rail of its own on the other side of the canvas, open beside a node's details.
  const [rail, setRail] = useState(false);
  const { saved, busy, save } = useSaveFromLink();
  const done = saved["graph"];

  const statusClass = errors > 0 ? "status-error" : warnings > 0 ? "status-warning" : "status-ok";
  const statusText = errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "Valid";
  const toggle = (next: Exclude<Panel, null>) => setPanel((p) => (p && p.type === next.type && ("id" in p ? p.id === (next as { id: Id }).id : true) ? null : next));

  const outlineOn = rail || panel?.type === "outline";
  const toggleOutline = () => {
    if (outlineOn) {
      setRail(false);
      if (panel?.type === "outline") {
        setExpanded(false);
        setPanel(null);
      }
    } else if (isDesktop()) setRail(true);
    else {
      setExpanded(true);
      setPanel({ type: "outline" });
    }
  };

  const sheet = (() => {
    // The outline has a sheet of its own (a rail, on a desktop), drawn before the canvas.
    if (!panel || panel.type === "outline") return null;
    if (panel.type === "node") {
      const node = doc.nodes.find((n) => n.id === panel.id);
      return node ? { title: KIND_LABEL[node.kind], subtitle: node.id, body: <NodeDetails node={node} /> } : null;
    }
    if (panel.type === "loop") {
      const loop = doc.loops.find((l) => l.id === panel.id);
      return loop ? { title: "Loop", subtitle: loop.id, body: <LoopDetails doc={doc} loop={loop} /> } : null;
    }
    if (panel.type === "about") return about ?? null;
    if (panel.type === "graph") {
      return {
        title: "Graph",
        subtitle: doc.id,
        body: (
          <>
            <GraphDetails doc={doc} />
            <div className="inspector">
              <Keep doc={doc} />
            </div>
          </>
        ),
      };
    }
    // A template is not exported until it is filled in, and its own page says so: nothing more is said of it here.
    return { title: "Validation", subtitle: "the graph's own findings", body: <IssueList issues={issues} whole={doc.template === undefined} needs={doc.template === undefined && packageNeeds(doc).length > 0 ? <PackageNeeds doc={doc} /> : undefined} /> };
  })();

  return (
    <div
      className={`editor viewer${sheet || outlineOn ? " has-sheet" : ""}${expanded && (sheet || panel?.type === "outline") ? " sheet-expanded" : ""}${outlineOn ? " has-rail" : ""}${
        sheet ? " has-side" : ""
      }`}
    >
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
        <OutlineButton on={outlineOn} onClick={toggleOutline} />
        <button type="button" className={`status ${statusClass}`} aria-label={`Validation: ${statusText}`} onClick={() => toggle({ type: "issues" })}>
          {statusText}
        </button>
      </header>

      {outlineOn ? (
        <Sheet rail title="Outline" subtitle="the whole graph, to read" expanded={expanded} onToggle={() => setExpanded((e) => !e)} onClose={toggleOutline}>
          <Outline doc={doc} current={panel && "id" in panel ? panel.id : undefined} />
        </Sheet>
      ) : null}

      <main className="stage">
        <ViewCanvas doc={doc} variant="full" issues={issues} selected={panel?.type === "node" ? panel.id : undefined} onNodeTap={(id) => toggle({ type: "node", id })} />
        <LookMenu />

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
