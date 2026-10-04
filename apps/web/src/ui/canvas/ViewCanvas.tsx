import type { Graph, Id, Issue, RunSummary } from "@grooph/core";
import { Background, BackgroundVariant, ReactFlow, useReactFlow, type EdgeTypes, type NodeTypes } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { stateLabel } from "../../doc/run.js";
import { severityById } from "../../doc/issues.js";
import { NODE_HEIGHT, NODE_WIDTH, resolvePositions } from "../../doc/layout.js";
import { edgeBends, labelSpots, type Box } from "./bends.js";
import { UnitNode, useBoxes, type UnitFlowNode } from "./boxes.js";
import { RUN_PAD, VIEWER_PAD, fitOptions, glide } from "./fit.js";
import { OpeningView } from "./OpeningView.js";
import { GraphEdge, type GraphFlowEdge } from "./GraphEdge.js";
import { GraphNode, nodeLabel, onNodeKey, type GraphFlowNode } from "./GraphNode.js";

const nodeTypes: NodeTypes = { graph: GraphNode, unit: UnitNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

type Size = { width: number; height: number };

/** What a run view lights up: a note's node, edge or loop. */
export type Highlight = { nodes: Id[]; edges: Id[]; loop?: Id };

/**
 * A read-only projection of a graph: nothing here writes to any document.
 * The link viewer's canvas (the document's own layout, pan and zoom, nodes
 * tappable for details). The compare card's compact picture that lived here
 * is the glyph since slice 0015.
 *
 * With `run`, each node carries its run state (icon and label as well as
 * color) and `highlight` lights up the object a timeline note is about.
 */
export function ViewCanvas(props: {
  doc: Graph;
  variant: "full";
  issues?: Issue[];
  selected?: Id;
  onNodeTap?: (id: Id) => void;
  run?: RunSummary;
  highlight?: Highlight;
}) {
  const { doc } = props;
  // The link viewer keeps room for its bottom bar; the run view has none, and its canvas is shorter.
  const pad = props.run ? RUN_PAD : VIEWER_PAD;
  const [measured, setMeasured] = useState<Record<Id, Size>>({});
  /** Whether the person has panned or zoomed: until then the view is the app's, and follows the room a panel leaves. */
  const moved = useRef(false);
  const positions = useMemo(() => resolvePositions(doc).positions, [doc]);
  const severity = useMemo(() => severityById(props.issues ?? []), [props.issues]);

  // A subgrooph is one box (handoff 0085): `shown` is the document with each closed box as one node. A run's
  // canvas shows every node's state, so its boxes are open; a node a note is about opens the boxes around it.
  const boxes = useBoxes(doc, positions, measured, { ...(props.run ? { all: true } : {}), reveal: [...(props.selected ? [props.selected] : []), ...(props.highlight?.nodes ?? [])], severity });
  const shown = boxes.shown;

  const nodes = useMemo(
    () =>
      shown.nodes.flatMap((node): GraphFlowNode[] => {
        if (boxes.rect(node.id)) return [];
        const loops = doc.loops.map((l, i) => ({ id: l.id, name: l.name, color: i, members: l.members })).filter((l) => l.members.includes(node.id));
        const base = { id: node.id, position: positions[node.id] ?? { x: 0, y: 0 }, ariaLabel: nodeLabel(node), ...(measured[node.id] ? { measured: measured[node.id] } : {}) };
        const run = props.run?.nodes[node.id];
        const loopIndex = props.highlight?.loop !== undefined ? doc.loops.findIndex((l) => l.id === props.highlight!.loop) : -1;
        return [{
          ...base,
          type: "graph" as const,
          data: {
            node,
            severity: severity.get(node.id),
            loops: loops.map(({ members: _m, ...l }) => l),
            selected: node.id === props.selected,
            highlighted: loopIndex < 0 && (props.highlight?.nodes.includes(node.id) ?? false),
            connectFrom: false,
            ...(loopIndex >= 0 && doc.loops[loopIndex]!.members.includes(node.id) ? { loopColor: loopIndex } : {}),
            ...(run ? { run: { state: run.state, label: stateLabel(run.state, run.lastOutcome), runs: run.runs } } : {}),
          },
        } satisfies GraphFlowNode];
      }),
    [doc, shown, boxes, positions, measured, severity, props.selected, props.run, props.highlight],
  );
  const drawn = useMemo((): (GraphFlowNode | UnitFlowNode)[] => [...boxes.nodes, ...nodes], [boxes, nodes]);

  const edges: GraphFlowEdge[] = useMemo(() => {
    const known = new Set(shown.nodes.map((n) => n.id));
    const room: Record<Id, Box> = {};
    for (const n of shown.nodes) {
      const p = positions[n.id] ?? { x: 0, y: 0 };
      room[n.id] = boxes.rect(n.id) ?? { x: p.x, y: p.y, w: measured[n.id]?.width ?? NODE_WIDTH, h: measured[n.id]?.height ?? NODE_HEIGHT };
    }
    const bends = edgeBends(shown, room);
    const spots = labelSpots(shown, room, bends);
    return shown.edges
      .filter((e) => known.has(e.from) && known.has(e.to))
      .map((edge) => {
        const loopIndex = doc.loops.findIndex((l) => l.back.includes(edge.id));
        return {
          id: edge.id,
          source: edge.from,
          target: edge.to,
          type: "graph" as const,
          data: {
            edge,
            back: loopIndex >= 0,
            loopColor: loopIndex >= 0 ? loopIndex : undefined,
            bend: bends.get(edge.id) ?? 0,
            labelAt: spots.get(edge.id),
            severity: severity.get(edge.id),
            selected: false,
            highlighted: props.highlight?.edges.includes(edge.id) ?? false,
          },
        };
      });
  }, [doc, shown, boxes, positions, measured, severity, props.highlight]);

  /** A tap on a closed box opens it; on a node, it is the node's. */
  const tap = (id: Id): void => (boxes.nodesOf(id) ? boxes.toggle(id) : boxes.rect(id) ? undefined : props.onNodeTap?.(id));
  if (!boxes.ready) return null;
  return (
    <ReactFlow<GraphFlowNode | UnitFlowNode, GraphFlowEdge>
      nodes={drawn}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={(changes) => {
        const sizes: Record<Id, Size> = {};
        for (const change of changes) if (change.type === "dimensions" && change.dimensions) sizes[change.id] = change.dimensions;
        if (Object.keys(sizes).length > 0) setMeasured((m) => ({ ...m, ...sizes }));
      }}
      onNodeClick={(_, node) => tap(node.id)}
      onKeyDown={onNodeKey(tap)}
      edgesFocusable={false}
      onMove={(event) => {
        // A move, not its start: a click on a node that cannot be dragged starts a pan and moves nothing.
        if (event) moved.current = true;
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      panOnScroll={false}
      nodeClickDistance={6}
      minZoom={0.2}
      maxZoom={2}
      fitView
      fitViewOptions={fitOptions(pad)}
      attributionPosition="top-right"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
      <OpeningView pad={pad} control refit={moved} />
      {props.highlight ? <FocusOn ids={props.highlight.nodes} /> : null}
    </ReactFlow>
  );
}

/** Bring highlighted nodes into view: pan, and zoom out if they do not fit, never in. */
function FocusOn({ ids }: { ids: Id[] }) {
  const flow = useReactFlow();
  const key = ids.join(" ");
  useEffect(() => {
    if (key === "") return;
    const zoom = flow.getZoom();
    void flow.fitView({ nodes: key.split(" ").map((id) => ({ id })), padding: 0.5, maxZoom: zoom, duration: glide() });
  }, [key, flow]);
  return null;
}
