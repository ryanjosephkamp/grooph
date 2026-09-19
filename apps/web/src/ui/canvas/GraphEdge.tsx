import type { Edge as DocEdge, Severity } from "@grooph/core";
import { EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode } from "@xyflow/react";
import { memo, useContext } from "react";

import { EditorContext } from "../editorContext.js";

export type GraphEdgeData = {
  edge: DocEdge;
  /** the edge is a back edge of at least one loop */
  back: boolean;
  /** colour index of the loop it returns work in */
  loopColor?: number;
  /** how far the curve bows at its middle, to the right of travel (see `bends.ts`) */
  bend: number;
  severity?: Severity;
  selected: boolean;
  highlighted: boolean;
  /** in loop-picking mode: whether this edge is a back edge of the loop being picked */
  picked?: boolean;
};

export type GraphFlowEdge = Edge<GraphEdgeData, "graph">;

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

const box = (node: InternalNode): Box => ({
  x: node.internals.positionAbsolute.x,
  y: node.internals.positionAbsolute.y,
  w: node.measured.width ?? 0,
  h: node.measured.height ?? 0,
});

const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Where the ray from the box's centre towards `toward` leaves the box, pushed out by `gap`. */
function border(b: Box, toward: Pt, gap: number): Pt {
  const c = center(b);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const t = Math.min(dx === 0 ? Infinity : b.w / 2 / Math.abs(dx), dy === 0 ? Infinity : b.h / 2 / Math.abs(dy));
  const len = Math.hypot(dx, dy);
  return { x: c.x + dx * t + (dx / len) * gap, y: c.y + dy * t + (dy / len) * gap };
}

/** Edges float between node borders, straight or as a quadratic curve bowing `bend` pixels at its middle. */
function geometry(a: Box, b: Box, bend: number): { path: string; label: Pt; tip: Pt; dir: Pt } {
  const ca = center(a);
  const cb = center(b);
  const dist = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
  const ux = (cb.x - ca.x) / dist;
  const uy = (cb.y - ca.y) / dist;
  // right-hand normal in screen coordinates (y grows downward)
  const nx = -uy;
  const ny = ux;
  const control = { x: (ca.x + cb.x) / 2 + nx * bend * 2, y: (ca.y + cb.y) / 2 + ny * bend * 2 };
  const start = border(a, bend === 0 ? cb : control, 2);
  const end = border(b, bend === 0 ? ca : control, 4);
  const path = bend === 0 ? `M${start.x},${start.y} L${end.x},${end.y}` : `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`;
  const label =
    bend === 0
      ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      : { x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y };
  const from = bend === 0 ? start : control;
  const dlen = Math.hypot(end.x - from.x, end.y - from.y) || 1;
  return { path, label, tip: end, dir: { x: (end.x - from.x) / dlen, y: (end.y - from.y) / dlen } };
}

/** A loop from a node back to itself, drawn off its right side. */
function selfLoop(a: Box): { path: string; label: Pt; tip: Pt; dir: Pt } {
  const sx = a.x + a.w;
  const sy = a.y + a.h * 0.3;
  const ey = a.y + a.h * 0.7;
  const path = `M${sx},${sy} C${sx + 70},${sy - 30} ${sx + 70},${ey + 30} ${sx + 4},${ey}`;
  return { path, label: { x: sx + 54, y: (sy + ey) / 2 }, tip: { x: sx + 4, y: ey }, dir: { x: -0.9, y: -0.3 } };
}

function whenLabel(edge: DocEdge): string {
  const when = edge.when ?? "always";
  return typeof when === "string" ? when : `verdict: ${when.verdict || "…"}`;
}

export const GraphEdge = memo(function GraphEdge({ id, source, target, data }: EdgeProps<GraphFlowEdge>) {
  // Absent on a read-only canvas (a link, a compare card): labels are then only labels.
  const editor = useContext(EditorContext);
  const a = useInternalNode(source);
  const b = useInternalNode(target);
  if (!a || !b || !data || !a.measured.width || !b.measured.width) return null;

  const g = source === target ? selfLoop(box(a)) : geometry(box(a), box(b), data.bend);
  const { edge } = data;
  const size = 9;
  const px = -g.dir.y;
  const py = g.dir.x;
  const arrow = `M${g.tip.x},${g.tip.y} L${g.tip.x - g.dir.x * size + px * size * 0.55},${g.tip.y - g.dir.y * size + py * size * 0.55} L${
    g.tip.x - g.dir.x * size - px * size * 0.55
  },${g.tip.y - g.dir.y * size - py * size * 0.55} Z`;

  const classes = [
    "gedge",
    data.back && "is-back",
    data.loopColor !== undefined && `loop-c${data.loopColor % 4}`,
    data.selected && "is-selected",
    data.highlighted && "is-highlighted",
    data.picked === true && "is-picked",
    data.picked === false && "is-unpicked",
    data.severity && `has-${data.severity}`,
  ]
    .filter(Boolean)
    .join(" ");

  const text = whenLabel(edge);
  const quiet = text === "always" && !edge.approval && !data.selected && !data.highlighted && data.picked === undefined;

  return (
    <g className={classes}>
      <path d={g.path} className="gedge-hit" fill="none" strokeWidth={26} stroke="transparent" />
      <path d={g.path} className="gedge-line" fill="none" />
      <path d={arrow} className="gedge-arrow" />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`gedge-label nodrag nopan${quiet ? " is-quiet" : ""}${data.selected ? " is-selected" : ""}${
            data.picked === true ? " is-picked" : ""
          }${data.back ? " is-back" : ""}${data.loopColor !== undefined ? ` loop-c${data.loopColor % 4}` : ""}`}
          style={{ transform: `translate(-50%, -50%) translate(${g.label.x}px, ${g.label.y}px)` }}
          aria-label={`Edge ${edge.from} to ${edge.to}, ${text}${edge.approval ? ", needs approval" : ""}`}
          data-edge-id={id}
          tabIndex={editor ? undefined : -1}
          onClick={(e) => {
            e.stopPropagation();
            editor?.onEdgeTap(id);
          }}
        >
          {quiet ? "" : text}
          {edge.approval ? <span className="gedge-approval">approval</span> : null}
        </button>
      </EdgeLabelRenderer>
    </g>
  );
});
