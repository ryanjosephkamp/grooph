import type { Node as DocNode, Severity } from "@grooph/core";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { KIND_LABEL } from "../../doc/catalog.js";

export type GraphNodeData = {
  node: DocNode;
  severity?: Severity;
  loops: { id: string; name: string; color: number }[];
  selected: boolean;
  highlighted: boolean;
  connectFrom: boolean;
  /** in loop-picking mode: whether this node is a member of the loop being picked */
  picked?: boolean;
  /** the loop the sheet shows, if this node is one of its members */
  loopColor?: number;
};

export type GraphFlowNode = Node<GraphNodeData, "graph">;

function subtitle(node: DocNode): string {
  switch (node.kind) {
    case "agent": {
      const role = typeof node.role === "string" ? node.role : node.role.custom || "custom";
      return [role, node.model?.tier, node.effort].filter(Boolean).join(" · ");
    }
    case "human-gate":
      return node.options?.length ? node.options.join(" / ") : "asks a human";
    case "check":
      return node.check.kind + (node.check.run ? ` · ${node.check.run}` : "");
    case "merge":
      return node.merges.length ? `merges ${node.merges.join(", ")}` : "merge";
    case "stop":
      return node.outcome ?? "ends the run";
  }
}

export const GraphNode = memo(function GraphNode({ data }: NodeProps<GraphFlowNode>) {
  const { node } = data;
  const classes = [
    "gnode",
    `gnode-${node.kind}`,
    data.selected && "is-selected",
    data.highlighted && "is-highlighted",
    data.connectFrom && "is-source",
    data.picked === true && "is-picked",
    data.picked === false && "is-unpicked",
    data.loopColor !== undefined && `in-loop loop-c${data.loopColor % 4}`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} data-node-id={node.id}>
      <Handle type="target" position={Position.Top} isConnectable={false} className="ghandle" />
      <div className="gnode-kind">
        <span className={`kind-mark kind-${node.kind}`} aria-hidden="true" />
        {KIND_LABEL[node.kind]}
      </div>
      <div className="gnode-name">{node.name || <span className="muted">unnamed</span>}</div>
      <div className="gnode-sub">{subtitle(node)}</div>
      {data.loops.length > 0 ? (
        <div className="gnode-loops" aria-label={`In loop ${data.loops.map((l) => l.name).join(", ")}`}>
          {data.loops.map((l) => (
            <span key={l.id} className={`loop-dot loop-c${l.color % 4}`} title={l.name} />
          ))}
        </div>
      ) : null}
      {data.severity ? (
        <span className={`gnode-issue issue-dot-${data.severity}`} role="img" aria-label={`has ${data.severity}s`} />
      ) : null}
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="ghandle" />
    </div>
  );
});
