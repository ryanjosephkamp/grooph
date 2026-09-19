import type { Graph, Id, Issue, Node as DocNode } from "@grooph/core";
import { Background, BackgroundVariant, Handle, Position, ReactFlow, type EdgeTypes, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import { memo, useMemo, useState } from "react";

import { KIND_LABEL } from "../../doc/catalog.js";
import { severityById } from "../../doc/issues.js";
import { MINI_BOX, NODE_HEIGHT, NODE_WIDTH, autoLayout, resolvePositions } from "../../doc/layout.js";
import { edgeBends, type Box } from "./bends.js";
import { FIT } from "./fit.js";
import { GraphEdge, type GraphFlowEdge } from "./GraphEdge.js";
import { GraphNode, type GraphFlowNode } from "./GraphNode.js";

type MiniData = { node: DocNode; loopColor?: number };
type MiniFlowNode = Node<MiniData, "mini">;

/** A node small enough that a whole candidate fits a phone card: kind, name, and role with tier. */
const MiniNode = memo(function MiniNode({ data }: NodeProps<MiniFlowNode>) {
  const { node } = data;
  const sub =
    node.kind === "agent"
      ? [typeof node.role === "string" ? node.role : node.role.custom, node.model?.tier].filter(Boolean).join(" · ")
      : KIND_LABEL[node.kind].toLowerCase();
  return (
    <div className={`mnode gnode-${node.kind}${data.loopColor !== undefined ? ` in-loop loop-c${data.loopColor % 4}` : ""}`} data-node-id={node.id}>
      <Handle type="target" position={Position.Top} isConnectable={false} className="ghandle" />
      <span className={`kind-mark kind-${node.kind}`} aria-hidden="true" />
      <span className="mnode-text">
        <span className="mnode-name">{node.name || node.id}</span>
        <span className="mnode-sub">{sub}</span>
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="ghandle" />
    </div>
  );
});

const nodeTypes: NodeTypes = { graph: GraphNode, mini: MiniNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

type Size = { width: number; height: number };

/**
 * A read-only projection of a graph: nothing here writes to any document.
 * `mini` is the compare card's picture (compact nodes, laid out automatically,
 * fitted, inert so a swipe passes through); `full` is the link viewer's canvas
 * (the document's own layout, pan and zoom, nodes tappable for details).
 */
export function ViewCanvas(props: {
  doc: Graph;
  variant: "mini" | "full";
  issues?: Issue[];
  selected?: Id;
  onNodeTap?: (id: Id) => void;
}) {
  const { doc, variant } = props;
  const mini = variant === "mini";
  const [measured, setMeasured] = useState<Record<Id, Size>>({});
  const positions = useMemo(() => (mini ? autoLayout(doc, 2, MINI_BOX) : resolvePositions(doc).positions), [doc, mini]);
  const severity = useMemo(() => severityById(props.issues ?? []), [props.issues]);

  const nodes = useMemo(
    () =>
      doc.nodes.map((node) => {
        const loops = doc.loops.map((l, i) => ({ id: l.id, name: l.name, color: i, members: l.members })).filter((l) => l.members.includes(node.id));
        const base = { id: node.id, position: positions[node.id] ?? { x: 0, y: 0 }, ...(measured[node.id] ? { measured: measured[node.id] } : {}) };
        if (mini) return { ...base, type: "mini" as const, data: { node, loopColor: loops[0]?.color } } satisfies MiniFlowNode;
        return {
          ...base,
          type: "graph" as const,
          data: {
            node,
            severity: severity.get(node.id),
            loops: loops.map(({ members: _m, ...l }) => l),
            selected: node.id === props.selected,
            highlighted: false,
            connectFrom: false,
          },
        } satisfies GraphFlowNode;
      }),
    [doc, positions, measured, mini, severity, props.selected],
  );

  const edges: GraphFlowEdge[] = useMemo(() => {
    const known = new Set(doc.nodes.map((n) => n.id));
    const boxes: Record<Id, Box> = {};
    for (const n of doc.nodes) {
      const p = positions[n.id] ?? { x: 0, y: 0 };
      boxes[n.id] = { x: p.x, y: p.y, w: measured[n.id]?.width ?? (mini ? MINI_BOX.width : NODE_WIDTH), h: measured[n.id]?.height ?? (mini ? MINI_BOX.height : NODE_HEIGHT) };
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
            highlighted: false,
          },
        };
      });
  }, [doc, positions, measured, mini, severity]);

  return (
    <ReactFlow<GraphFlowNode | MiniFlowNode, GraphFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={(changes) => {
        const sizes: Record<Id, Size> = {};
        for (const change of changes) if (change.type === "dimensions" && change.dimensions) sizes[change.id] = change.dimensions;
        if (Object.keys(sizes).length > 0) setMeasured((m) => ({ ...m, ...sizes }));
      }}
      onNodeClick={mini ? undefined : (_, node) => props.onNodeTap?.(node.id)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      panOnDrag={!mini}
      zoomOnPinch={!mini}
      zoomOnScroll={!mini}
      zoomOnDoubleClick={!mini}
      panOnScroll={false}
      preventScrolling={!mini}
      nodeClickDistance={6}
      minZoom={mini ? 0.3 : 0.2}
      maxZoom={mini ? 1.1 : 2}
      fitView
      fitViewOptions={mini ? { padding: 0.08, maxZoom: 1.1 } : { ...FIT, padding: { top: "64px", bottom: "100px", x: "20px" } }}
      proOptions={{ hideAttribution: mini }}
      attributionPosition="top-right"
    >
      {mini ? null : <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />}
    </ReactFlow>
  );
}

/** The height a card gives its picture: the laid-out graph at full size, within reason. */
export function miniHeight(doc: Graph): number {
  const positions = Object.values(autoLayout(doc, 2, MINI_BOX));
  if (positions.length === 0) return 120;
  const rows = Math.max(...positions.map((p) => p.y)) + MINI_BOX.height;
  return Math.max(140, Math.min(400, rows + 36));
}
