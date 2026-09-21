import type { Graph, Id, Issue, RunSummary } from "@grooph/core";
import { Background, BackgroundVariant, ReactFlow, useReactFlow, type EdgeTypes, type NodeTypes } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";

import { stateLabel } from "../../doc/run.js";
import { severityById } from "../../doc/issues.js";
import { NODE_HEIGHT, NODE_WIDTH, resolvePositions } from "../../doc/layout.js";
import { edgeBends, type Box } from "./bends.js";
import { FIT } from "./fit.js";
import { GraphEdge, type GraphFlowEdge } from "./GraphEdge.js";
import { GraphNode, type GraphFlowNode } from "./GraphNode.js";

const nodeTypes: NodeTypes = { graph: GraphNode };
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
 * colour) and `highlight` lights up the object a timeline note is about.
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
  const [measured, setMeasured] = useState<Record<Id, Size>>({});
  const positions = useMemo(() => resolvePositions(doc).positions, [doc]);
  const severity = useMemo(() => severityById(props.issues ?? []), [props.issues]);

  const nodes = useMemo(
    () =>
      doc.nodes.map((node) => {
        const loops = doc.loops.map((l, i) => ({ id: l.id, name: l.name, color: i, members: l.members })).filter((l) => l.members.includes(node.id));
        const base = { id: node.id, position: positions[node.id] ?? { x: 0, y: 0 }, ...(measured[node.id] ? { measured: measured[node.id] } : {}) };
        const run = props.run?.nodes[node.id];
        const loopIndex = props.highlight?.loop !== undefined ? doc.loops.findIndex((l) => l.id === props.highlight!.loop) : -1;
        return {
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
        } satisfies GraphFlowNode;
      }),
    [doc, positions, measured, severity, props.selected, props.run, props.highlight],
  );

  const edges: GraphFlowEdge[] = useMemo(() => {
    const known = new Set(doc.nodes.map((n) => n.id));
    const boxes: Record<Id, Box> = {};
    for (const n of doc.nodes) {
      const p = positions[n.id] ?? { x: 0, y: 0 };
      boxes[n.id] = { x: p.x, y: p.y, w: measured[n.id]?.width ?? NODE_WIDTH, h: measured[n.id]?.height ?? NODE_HEIGHT };
    }
    const bends = edgeBends(doc, boxes);
    return doc.edges
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
            severity: severity.get(edge.id),
            selected: false,
            highlighted: props.highlight?.edges.includes(edge.id) ?? false,
          },
        };
      });
  }, [doc, positions, measured, severity, props.highlight]);

  return (
    <ReactFlow<GraphFlowNode, GraphFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={(changes) => {
        const sizes: Record<Id, Size> = {};
        for (const change of changes) if (change.type === "dimensions" && change.dimensions) sizes[change.id] = change.dimensions;
        if (Object.keys(sizes).length > 0) setMeasured((m) => ({ ...m, ...sizes }));
      }}
      onNodeClick={(_, node) => props.onNodeTap?.(node.id)}
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
      // The link viewer keeps room for its bottom bar; the run view has none, and its canvas is shorter.
      fitViewOptions={{ ...FIT, padding: props.run ? { top: "56px", bottom: "12px", x: "12px" } : { top: "64px", bottom: "100px", x: "20px" } }}
      attributionPosition="top-right"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
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
    void flow.fitView({ nodes: key.split(" ").map((id) => ({ id })), padding: 0.5, maxZoom: zoom, duration: 250 });
  }, [key, flow]);
  return null;
}
