import { setPositions, type Id, type Issue, type Position } from "@grooph/core";
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
import { NODE_HEIGHT, NODE_WIDTH, resolvePositions } from "../../doc/layout.js";
import { useDoc } from "../../doc/store.js";
import { useEditor } from "../editorContext.js";
import { edgeBends, labelSpots, type Box } from "./bends.js";
import { UnitNode, useBoxes, type UnitFlowNode } from "./boxes.js";
import { EDITOR_PAD, FIT } from "./fit.js";
import { OpeningView } from "./OpeningView.js";
import { GraphEdge, type GraphFlowEdge } from "./GraphEdge.js";
import { GraphNode, nodeLabel, onNodeKey, type GraphFlowNode } from "./GraphNode.js";

const nodeTypes: NodeTypes = { graph: GraphNode, unit: UnitNode };
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

  // A subgrooph is one box (handoff 0085): `shown` is the document with each closed box as one node. The node a
  // panel is about, and the ones an issue points at, open the boxes around them.
  const reveal = useMemo(() => [...(selectedNode ? [selectedNode] : []), ...highlight.nodes], [selectedNode, highlight]);
  const boxes = useBoxes(doc, positions, measured, { reveal, drag, severity });
  const shown = boxes.shown;

  const nodes: GraphFlowNode[] = useMemo(
    () =>
      shown.nodes.flatMap((node): GraphFlowNode[] => {
        if (boxes.rect(node.id)) return [];
        const loops = doc.loops
          .map((l, i) => ({ id: l.id, name: l.name, color: i, members: l.members }))
          .filter((l) => l.members.includes(node.id))
          .map(({ members: _m, ...l }) => l);
        return [{
          id: node.id,
          type: "graph" as const,
          position: drag[node.id] ?? positions[node.id] ?? { x: 0, y: 0 },
          ariaLabel: nodeLabel(node),
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
        }];
      }),
    [doc, shown, boxes, positions, drag, measured, severity, selectedNode, highlight, mode, picking, focusLoop, focusLoopColor],
  );
  const drawn = useMemo((): (GraphFlowNode | UnitFlowNode)[] => [...boxes.nodes, ...nodes], [boxes, nodes]);

  const curves = useMemo(() => {
    const room: Record<Id, Box> = {};
    for (const n of shown.nodes) {
      const p = drag[n.id] ?? positions[n.id] ?? { x: 0, y: 0 };
      const size = measured[n.id];
      const rect = boxes.rect(n.id);
      room[n.id] = rect ? { ...rect, ...(drag[n.id] ?? {}) } : { x: p.x, y: p.y, w: size?.width ?? NODE_WIDTH, h: size?.height ?? NODE_HEIGHT };
    }
    const bends = edgeBends(shown, room);
    return { bends, spots: labelSpots(shown, room, bends) };
  }, [shown, boxes, positions, drag, measured]);

  const edges: GraphFlowEdge[] = useMemo(() => {
    const known = new Set(shown.nodes.map((n) => n.id));
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
            bend: curves.bends.get(edge.id) ?? 0,
            labelAt: curves.spots.get(edge.id),
            severity: severity.get(edge.id),
            selected: edge.id === selectedEdge,
            highlighted: highlight.edges.has(edge.id),
            picked: picking ? picking.back.includes(edge.id) : undefined,
          },
        };
      });
  }, [doc, shown, curves, severity, selectedEdge, highlight, picking]);

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphFlowNode | UnitFlowNode>[]) => {
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
          // A closed box moved: each of its nodes moves as far, so that it opens where it was put.
          const held = boxes.nodesOf(id);
          const from = boxes.rect(id);
          if (rest[id] && held && from) for (const node of held) moved[node] = { x: (positions[node]?.x ?? 0) + rest[id]!.x - from.x, y: (positions[node]?.y ?? 0) + rest[id]!.y - from.y };
          else if (rest[id]) moved[id] = rest[id]!;
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
    [editor.store, boxes, positions],
  );

  /** A tap on a closed box opens it; on a node, it is the node's. */
  const tap = (id: Id): void => (boxes.nodesOf(id) ? boxes.toggle(id) : boxes.rect(id) ? undefined : onNodeTap(id));
  if (!boxes.ready) return null;
  return (
    <ReactFlow<GraphFlowNode | UnitFlowNode, GraphFlowEdge>
      nodes={drawn}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => tap(node.id)}
      onKeyDown={onNodeKey(tap)}
      onEdgeClick={(_, edge) => editor.onEdgeTap(edge.id)}
      onMove={(event) => {
        // A move with an event behind it is a hand on the canvas; a fit or a pan the app makes has none.
        // (A move, not its start: a click on the empty canvas starts one and moves nothing.)
        if (event) editor.viewMoved.current = true;
      }}
      onPaneClick={() => {
        if (editor.mode.type !== "idle") return;
        editor.setHighlight({ nodes: new Set(), edges: new Set(), loops: new Set(), graph: false });
        editor.setSelection([]);
        if (editor.panel && ["node", "edge", "loop", "add"].includes(editor.panel.type)) editor.openPanel(null);
      }}
      nodesConnectable={false}
      // An edge's label is its control; the line itself is not one more stop for Tab.
      edgesFocusable={false}
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
      fitViewOptions={FIT}
      attributionPosition="top-right"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
      <OpeningView pad={EDITOR_PAD} refit={editor.viewMoved} />
    </ReactFlow>
  );
}
