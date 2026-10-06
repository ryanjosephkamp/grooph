import { glyph, isPersonStep, type Node as DocNode, type NodeRunState, type Severity } from "@grooph/core";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo, type CSSProperties } from "react";

import { kindLabel } from "../../doc/catalog.js";
import { StateIcon } from "../run/StateIcon.js";
import { unitsNow } from "./boxes.js";

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
  /** in a run view: this node's state in the run (docs/runs.md §4) */
  run?: { state: NodeRunState; label: string; runs: number };
};

export type GraphFlowNode = Node<GraphNodeData, "graph">;

/** What a node is called to someone who cannot see it: its kind and its name. */
export const nodeLabel = (node: DocNode): string => `${kindLabel(node)}: ${node.name || node.id}`;

/** Enter on the node the keyboard is on is a tap on it, so Tab reaches a node and opens it (handoff 0061). */
export const onNodeKey =
  (tap: ((id: string) => void) | undefined) =>
  (e: { key: string; target: EventTarget }): void => {
    const id = e.key === "Enter" && e.target instanceof HTMLElement && e.target.classList.contains("react-flow__node") ? e.target.dataset["id"] : undefined;
    if (id !== undefined) tap?.(id);
  };

function subtitle(node: DocNode): string {
  switch (node.kind) {
    case "agent": {
      const role = typeof node.role === "string" ? node.role : node.role.custom || "custom";
      // A person's step shows its role alone, as core's picture does: a person is on no tier and at no effort.
      return isPersonStep(node) ? role : [role, node.model?.tier, node.effort].filter(Boolean).join(" · ");
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

/** The word on a person's card, in the gate's color: the card's own class says "agent", which is what the node is. */
const PERSONS = { "--kind": "var(--kind-human-gate)" } as CSSProperties;

export const GraphNode = memo(function GraphNode({ data }: NodeProps<GraphFlowNode>) {
  const { node } = data;
  // A node that stands for a subgrooph's box (handoff 0085) is drawn by the piece that made it (`units.tsx`).
  const Unit = "unit" in node && unitsNow()?.UnitNode;
  if (Unit) return <Unit unit={node.unit as never} Handle={Handle} glyph={glyph} />;
  const classes = [
    "gnode",
    `gnode-${node.kind}`,
    data.selected && "is-selected",
    data.highlighted && "is-highlighted",
    data.connectFrom && "is-source",
    data.picked === true && "is-picked",
    data.picked === false && "is-unpicked",
    data.loopColor !== undefined && `in-loop loop-c${data.loopColor % 4}`,
    data.run && `run-state run-${data.run.state}`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} data-node-id={node.id}>
      <Handle type="target" position={Position.Top} isConnectable={false} className="ghandle" />
      {/* A person's step has the mark and the color a person's decision has (the gate's), as in core's picture. */}
      <div className="gnode-kind" style={isPersonStep(node) ? PERSONS : undefined}>
        <span className={`kind-mark kind-${isPersonStep(node) ? "human-gate" : node.kind}`} aria-hidden="true" />
        {kindLabel(node)}
      </div>
      <div className="gnode-name">{node.name || <span className="muted">unnamed</span>}</div>
      <div className="gnode-sub">{subtitle(node)}</div>
      {data.run ? (
        <div className={`run-badge run-badge-${data.run.state}`} data-run-state={data.run.state}>
          <StateIcon state={data.run.state} />
          <span>{data.run.label}</span>
          {data.run.runs > 1 ? <span className="run-count" aria-label={`${data.run.runs} runs`}>×{data.run.runs}</span> : null}
        </div>
      ) : null}
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
