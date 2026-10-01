import type { Edge as DocEdge, Severity } from "@grooph/core";
import { EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode } from "@xyflow/react";
import { memo, useContext } from "react";

import { EditorContext } from "../editorContext.js";
import { edgeCurve, edgeLabelText, pointAt, type Pt } from "./bends.js";

export type GraphEdgeData = {
  edge: DocEdge;
  /** the edge is a back edge of at least one loop */
  back: boolean;
  /** colour index of the loop it returns work in */
  loopColor?: number;
  /** how far the curve bows at its middle, to the right of travel (see `bends.ts`) */
  bend: number;
  /** where along the curve the label sits, 0 to 1; the middle when absent (see `labelSpots`) */
  labelAt?: number;
  severity?: Severity;
  selected: boolean;
  highlighted: boolean;
  /** in loop-picking mode: whether this edge is a back edge of the loop being picked */
  picked?: boolean;
};

export type GraphFlowEdge = Edge<GraphEdgeData, "graph">;

type Box = { x: number; y: number; w: number; h: number };

const box = (node: InternalNode): Box => ({
  x: node.internals.positionAbsolute.x,
  y: node.internals.positionAbsolute.y,
  w: node.measured.width ?? 0,
  h: node.measured.height ?? 0,
});

/** The drawn path, where its label sits (`at`, a fraction along the curve), and the arrowhead's tip and direction. */
function geometry(a: Box, b: Box, bend: number, at: number): { path: string; label: Pt; tip: Pt; dir: Pt } {
  const curve = edgeCurve(a, b, bend);
  const { start, end, control } = curve;
  const path = control ? `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}` : `M${start.x},${start.y} L${end.x},${end.y}`;
  const from = control ?? start;
  const dlen = Math.hypot(end.x - from.x, end.y - from.y) || 1;
  return { path, label: pointAt(curve, at), tip: end, dir: { x: (end.x - from.x) / dlen, y: (end.y - from.y) / dlen } };
}

/** A loop from a node back to itself, drawn off its right side. */
function selfLoop(a: Box): { path: string; label: Pt; tip: Pt; dir: Pt } {
  const sx = a.x + a.w;
  const sy = a.y + a.h * 0.3;
  const ey = a.y + a.h * 0.7;
  const path = `M${sx},${sy} C${sx + 70},${sy - 30} ${sx + 70},${ey + 30} ${sx + 4},${ey}`;
  return { path, label: { x: sx + 54, y: (sy + ey) / 2 }, tip: { x: sx + 4, y: ey }, dir: { x: -0.9, y: -0.3 } };
}

export const GraphEdge = memo(function GraphEdge({ id, source, target, data }: EdgeProps<GraphFlowEdge>) {
  // Absent on a read-only canvas (a link, a compare card): labels are then only labels.
  const editor = useContext(EditorContext);
  const a = useInternalNode(source);
  const b = useInternalNode(target);
  if (!a || !b || !data || !a.measured.width || !b.measured.width) return null;

  const g = source === target ? selfLoop(box(a)) : geometry(box(a), box(b), data.bend, data.labelAt ?? 0.5);
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

  const text = edgeLabelText(edge);
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
