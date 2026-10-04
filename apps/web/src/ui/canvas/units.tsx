/**
 * A subgrooph on the canvas (amendment A-018, handoff 0085): one box. Closed, it lies over the place its nodes
 * have and says what it holds: its name, the template and version it came from, how many nodes, which brakes, and
 * the glyph of what is inside. Open, it is a frame around those nodes. It opens in place: no other node moves, and
 * a node keeps the position the document gives it whether its box is open or shut.
 *
 * This is a piece of the app fetched only for a document that has a subgrooph (decision 0021), like a map's other
 * views (`ui/map/views.tsx` says why such a piece imports nothing the app's other pieces share but React). Core's
 * fold is behind a door of its own; the canvas hands in the glyph, which it has. The styles ride in the script.
 */
import type { Graph, Id, OutlineSection, Position, Severity } from "@grooph/core";
import type { ReactNode } from "react";
// Core's own door for a subgrooph's views, by its path: `base.ts` does not reach it (packages/core/src/picture/graph-units.ts).
import { foldUnits, unitGraph, unitLine } from "../../../../../packages/core/src/picture/graph-units.js";

import css from "./units.css?inline";

const sheet = document.createElement("style");
sheet.textContent = css;
document.head.append(sheet);

/** Around the nodes of a box, and above them for its name. */
const PAD = 14;
const HEAD = 34;

export type Rect = { x: number; y: number; w: number; h: number };

export type Face = {
  id: Id;
  name: string;
  open: boolean;
  /** `review-gate@1 · 3 nodes · 1 human gate · 1 loop` */
  line: string;
  about?: string;
  irreversible: string[];
  /** the glyph of what it holds, as core draws it */
  glyph: string;
  /** what a person who cannot see it is told */
  label: string;
};

export type Boxed = {
  /** the graph as the canvas draws it: each closed box one node, under the group's id */
  doc: Graph;
  /** the boxes that are drawn, outermost first, each with the place it takes */
  boxes: { face: Face; rect: Rect }[];
  /** every node inside a box: what moves when a closed box is dragged */
  nodesOf: (box: Id) => Id[];
  /** the boxes that have to open for a node to be seen, outermost first; none when it is in sight */
  hides: (node: Id) => Id[];
};

/**
 * The boxes of a document and the graph the canvas draws with them. `positions` and `size` are the nodes' own, as
 * the canvas has them: a box takes the room its nodes take, with a margin and a line for its name.
 */
export function boxesFor(glyph: (doc: Graph) => string, doc: Graph, open: readonly Id[] | "all", positions: Record<Id, Position>, size: (node: Id) => { w: number; h: number }): Boxed {
  const folded = foldUnits(doc, open);
  const rects = new Map<Id, Rect>();
  // Innermost first: a box that holds another makes room for that one's frame.
  for (const box of [...folded.boxes].reverse()) {
    const within = new Set(box.nodes);
    const held: Rect[] = box.nodes.map((id) => ({ ...(positions[id] ?? { x: 0, y: 0 }), ...size(id) }));
    for (const inner of folded.boxes) if (inner.depth > box.depth && inner.nodes.every((id) => within.has(id)) && rects.has(inner.group.id)) held.push(rects.get(inner.group.id)!);
    const x = Math.min(...held.map((r) => r.x)) - PAD;
    const y = Math.min(...held.map((r) => r.y)) - HEAD;
    rects.set(box.group.id, { x, y, w: Math.max(...held.map((r) => r.x + r.w)) + PAD - x, h: Math.max(...held.map((r) => r.y + r.h)) + PAD - y });
  }
  const byId = new Map(folded.boxes.map((box) => [box.group.id, box]));
  return {
    doc: folded.doc,
    boxes: folded.boxes.map((box) => {
      const said = unitLine(doc, box);
      const name = box.group.name || box.group.id;
      return {
        rect: rects.get(box.group.id)!,
        face: {
          id: box.group.id,
          name,
          open: box.open,
          line: said.line,
          ...(box.group.description ? { about: box.group.description } : {}),
          irreversible: said.irreversible,
          glyph: box.open ? "" : glyph(unitGraph(doc, box)),
          label: `Subgrooph: ${name}, ${said.line.split(" · ").slice(1).join(", ")}. ${box.open ? "Open" : "Closed: Enter opens it"}`,
        },
      };
    }),
    nodesOf: (id) => byId.get(id)?.nodes ?? [],
    hides: (node) => {
      const chain = folded.chain(node).map((group) => group.id);
      const shut = chain.findIndex((id) => !(open === "all" || open.includes(id)));
      return shut < 0 ? [] : chain.slice(shut);
    },
  };
}

/**
 * A subgrooph in the outline: one box, shut until it is opened, that holds the sections of its nodes. What it says
 * shut is what the canvas's box says: its name, where it came from, how many nodes.
 */
export function OutlineUnit({ section, count, open, onToggle, children }: { section: OutlineSection; count: number; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  const from = section.items.find((item) => item.label === "Placed from")?.text;
  return (
    <details className="outline-unit" data-outline-id={section.id} open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <span className="outline-kind">Subgrooph</span>
        <span className="outline-unit-name">{section.title}</span>
        <span className="outline-unit-line">
          {count} {count === 1 ? "node" : "nodes"}
          {from ? `, placed from ${from}` : ""}
        </span>
      </summary>
      {children}
    </details>
  );
}

/** A box as it is drawn: closed, a card as large as the room its nodes take; open, a frame with its name and a way to close it. */
export function UnitFace({ face, severity, onToggle }: { face: Face; severity?: Severity; onToggle: () => void }) {
  if (face.open) {
    return (
      <div className="unit unit-open" data-unit-id={face.id} data-open="">
        <div className="unit-head">
          <span className="unit-name">{face.name}</span>
          <span className="unit-from">{face.line.split(" · ")[0]}</span>
          <button
            type="button"
            className="unit-close nodrag nopan"
            aria-label={`Close ${face.name}`}
            aria-expanded="true"
            onClick={(event) => {
              // The button is inside the frame's node: the canvas would take the same click for a tap on that node.
              event.stopPropagation();
              onToggle();
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="unit unit-closed" data-unit-id={face.id}>
      <div className="unit-kind">
        <span className="unit-mark" aria-hidden="true" />
        Subgrooph
      </div>
      <div className="unit-name">{face.name}</div>
      <div className="unit-line">{face.line}</div>
      {face.about ? <div className="unit-about">{face.about}</div> : null}
      {face.irreversible.length > 0 ? <div className="unit-warn">irreversible inside: {face.irreversible.join(", ")}</div> : null}
      <div className="unit-glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: face.glyph }} />
      <div className="unit-hint">Open</div>
      {severity ? <span className={`gnode-issue issue-dot-${severity}`} role="img" aria-label={`has ${severity}s inside`} /> : null}
    </div>
  );
}
