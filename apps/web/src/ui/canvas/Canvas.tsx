import type { Id, Issue } from "@grooph/core";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type NodeChange,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { severityById } from "../../doc/issues.js";
import { resolvePositions } from "../../doc/layout.js";
import { setPositions, type Position } from "../../doc/ops.js";
import { useDoc } from "../../doc/store.js";
import { useEditor } from "../editorContext.js";
import { GraphEdge, type GraphFlowEdge } from "./GraphEdge.js";
import { GraphNode, type GraphFlowNode } from "./GraphNode.js";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

type Size = { width: number; height: number };

/**
 * The canvas: a projection of the document. Positions come from `layout`, or
 * from automatic layout when the document has none (amendment A-005); a drag
 * writes positions back, and nothing else does.
 */
export function Canvas({ issues, onNodeTap }: { issues: Issue[]; onNodeTap: (id: Id) => void }) {
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const [drag, setDragState] = useState<Record<Id, Position>>({});
  const dragRef = useRef(drag);
  const setDrag = (next: Record<Id, Position>) => {
    dragRef.current = next;
    setDragState(next);
  };
  const [measured, setMeasured] = useState<Record<Id, Size>>({});

  const { positions } = useMemo(() => resolvePositions(doc), [doc]);
  const severity = useMemo(() => severityById(issues), [issues]);

  const { panel, mode, highlight } = editor;
  const selectedNode = panel?.type === "node" ? panel.id : undefined;
  const selectedEdge = panel?.type === "edge" ? panel.id : undefined;
  const focusLoop =
    mode.type === "pick" ? doc.loops.find((l) => l.id === mode.loopId) : panel?.type === "loop" ? doc.loops.find((l) => l.id === panel.id) : undefined;
  const focusLoopColor = focusLoop ? doc.loops.indexOf(focusLoop) : undefined;
  const picking = mode.type === "pick" ? focusLoop : undefined;

  const nodes: GraphFlowNode[] = useMemo(
    () =>
      doc.nodes.map((node) => {
        const loops = doc.loops
          .map((l, i) => ({ id: l.id, name: l.name, color: i, members: l.members }))
          .filter((l) => l.members.includes(node.id))
          .map(({ members: _m, ...l }) => l);
        return {
          id: node.id,
          type: "graph" as const,
          position: drag[node.id] ?? positions[node.id] ?? { x: 0, y: 0 },
          ...(measured[node.id] ? { measured: measured[node.id] } : {}),
          data: {
            node,
            severity: severity.get(node.id),
            loops,
            selected: node.id === selectedNode,
            highlighted: highlight.nodes.has(node.id),
            connectFrom: mode.type === "connect" && mode.from === node.id,
            picked: picking ? picking.members.includes(node.id) : undefined,
            loopColor: focusLoop?.members.includes(node.id) ? focusLoopColor : undefined,
          },
        };
      }),
    [doc, positions, drag, measured, severity, selectedNode, highlight, mode, picking, focusLoop, focusLoopColor],
  );

  const edges: GraphFlowEdge[] = useMemo(() => {
    const known = new Set(doc.nodes.map((n) => n.id));
    const pairCount = new Map<string, number>();
    return doc.edges
      .filter((e) => known.has(e.from) && known.has(e.to))
      .map((edge) => {
        const pair = [edge.from, edge.to].sort().join("|");
        const rank = pairCount.get(pair) ?? 0;
        pairCount.set(pair, rank + 1);
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
            rank,
            severity: severity.get(edge.id),
            selected: edge.id === selectedEdge,
            highlighted: highlight.edges.has(edge.id),
            picked: picking ? picking.back.includes(edge.id) : undefined,
          },
        };
      });
  }, [doc, severity, selectedEdge, highlight, picking]);

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphFlowNode>[]) => {
      const sizes: Record<Id, Size> = {};
      const moving: Record<Id, Position> = {};
      const dropped: Id[] = [];
      for (const change of changes) {
        if (change.type === "dimensions" && change.dimensions) sizes[change.id] = change.dimensions;
        if (change.type === "position") {
          if (change.dragging && change.position) moving[change.id] = change.position;
          else if (change.dragging === false) dropped.push(change.id);
        }
      }
      if (Object.keys(sizes).length > 0) setMeasured((m) => ({ ...m, ...sizes }));
      if (Object.keys(moving).length > 0) setDrag({ ...dragRef.current, ...moving });
      if (dropped.length > 0) {
        const moved: Record<Id, Position> = {};
        const rest = { ...dragRef.current };
        for (const id of dropped) {
          if (rest[id]) moved[id] = rest[id]!;
          delete rest[id];
        }
        if (Object.keys(moved).length > 0) {
          // A move writes the layout. When some nodes were only auto-placed,
          // the whole picture is saved at once so nothing jumps afterwards.
          editor.store.update((d) => {
            const resolved = resolvePositions(d);
            return setPositions(d, resolved.unplaced.length > 0 ? { ...resolved.positions, ...moved } : moved);
          });
        }
        setDrag(rest);
      }
    },
    [editor.store],
  );

  return (
    <ReactFlow<GraphFlowNode, GraphFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onNodeTap(node.id)}
      onEdgeClick={(_, edge) => editor.onEdgeTap(edge.id)}
      onPaneClick={() => {
        if (editor.mode.type !== "idle") return;
        editor.setHighlight({ nodes: new Set(), edges: new Set(), loops: new Set(), graph: false });
        if (editor.panel && ["node", "edge", "loop", "add"].includes(editor.panel.type)) editor.openPanel(null);
      }}
      nodesConnectable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      nodeDragThreshold={6}
      nodeClickDistance={6}
      paneClickDistance={6}
      minZoom={0.2}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      attributionPosition="top-right"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
    </ReactFlow>
  );
}
