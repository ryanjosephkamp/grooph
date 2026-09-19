import { describeStop, loopMode, indexGraph, type Graph, type Id, type IssueLike, type Loop, type Node } from "@grooph/core";
import type { ReactNode } from "react";

import { KIND_LABEL } from "../../doc/catalog.js";

/** Read-only details for what a link carries: the same facts the inspectors edit, as text. */

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, value]) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0));
  return (
    <dl className="readonly">
      {shown.map(([label, value]) => (
        <div key={label} className="readonly-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const list = (items: readonly string[] | undefined): ReactNode =>
  items && items.length > 0 ? (
    <ul className="plain-list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : undefined;

const prose = (text: string | undefined): ReactNode => (text ? <p className="prose">{text}</p> : undefined);

export function NodeDetails({ node }: { node: Node }) {
  const common: [string, ReactNode][] = [
    ["Name", node.name],
    ["Id", <span className="mono">{node.id}</span>],
    ["About", prose(node.description)],
    ["Coupled", node.coupled ? "yes" : undefined],
  ];
  switch (node.kind) {
    case "agent":
      return (
        <div className="inspector">
          <Rows
            rows={[
              ...common,
              ["Role", typeof node.role === "string" ? node.role : `${node.role.custom} (custom)`],
              ["Model", node.model ? [node.model.tier, ...Object.entries(node.model.pin ?? {}).map(([h, m]) => `${h}: ${m}`)].join(" · ") : "session default"],
              ["Effort", node.effort],
              ["Brief", prose(node.brief)],
              ["Inputs", list(node.inputs)],
              ["Outputs", list(node.outputs)],
              ["Allowed", list(node.allow)],
              ["Denied", list(node.deny)],
              ["Owns", list(node.owns)],
              ["Irreversible", list(node.irreversible)],
            ]}
          />
        </div>
      );
    case "human-gate":
      return (
        <div className="inspector">
          <Rows rows={[...common, ["Asks", prose(node.prompt)], ["Options", list(node.options)]]} />
        </div>
      );
    case "check":
      return (
        <div className="inspector">
          <Rows
            rows={[
              ...common,
              ["Check", node.check.kind],
              ["Runs", node.check.run ? <span className="mono">{node.check.run}</span> : undefined],
              ["Passes when", node.check.pass],
              ["Threshold", node.check.threshold === undefined ? undefined : String(node.check.threshold)],
            ]}
          />
        </div>
      );
    case "merge":
      return (
        <div className="inspector">
          <Rows rows={[...common, ["Merges", list(node.merges)], ["Strategy", node.strategy]]} />
        </div>
      );
    case "stop":
      return (
        <div className="inspector">
          <Rows rows={[...common, ["Outcome", node.outcome ?? "ends the run"]]} />
        </div>
      );
  }
}

export function LoopDetails({ doc, loop }: { doc: Graph; loop: Loop }) {
  const name = (id: Id) => doc.nodes.find((n) => n.id === id)?.name ?? id;
  const edge = (id: Id) => {
    const e = doc.edges.find((x) => x.id === id);
    return e ? `${name(e.from)} → ${name(e.to)}${e.when && e.when !== "always" ? ` (${typeof e.when === "string" ? e.when : e.when.verdict})` : ""}` : id;
  };
  return (
    <div className="inspector">
      <Rows
        rows={[
          ["Name", loop.name],
          ["Mode", loopMode(indexGraph(doc), loop)],
          ["Members", list(loop.members.map(name))],
          ["Back edges", list(loop.back.map(edge))],
          ["Bar", loop.bar ? loop.bar.name : "none"],
          ["Inspects", list(loop.bar?.inspects.map((e) => `${e.kind}: ${e.ref}`))],
          ["Good enough", prose(loop.bar?.acceptance)],
          ["Aiming for", prose(loop.bar?.aspiration)],
          ["Stops, in order", list(loop.stops.map((s) => `${describeStop(s)}${s.then ? ` → ${name(s.then)}` : ""}`))],
        ]}
      />
    </div>
  );
}

export function GraphDetails({ doc }: { doc: Graph }) {
  return (
    <div className="inspector">
      <Rows
        rows={[
          ["Name", doc.name],
          ["Id", <span className="mono">{doc.id}</span>],
          ["Goal", prose(doc.goal)],
          ["About", prose(doc.description)],
          ["Budget", doc.constraints?.budget],
          ["Time", doc.constraints?.time],
          ["Other limits", doc.constraints?.other],
          ["Target", doc.target?.harness],
          ["Adaptation", doc.adaptation ?? "adaptive (default)"],
          ["Started from", doc.lineage?.from ?? doc.lineage?.pattern],
          ["Version", String(doc.version)],
        ]}
      />
    </div>
  );
}

export function IssueList({ issues }: { issues: readonly IssueLike[] }) {
  if (issues.length === 0) {
    return (
      <div className="inspector">
        <p className="all-clear">No issues. The graph validates for export.</p>
      </div>
    );
  }
  return (
    <div className="inspector">
      <ul className="issues">
        {issues.map((issue, i) => (
          <li key={`${issue.code}-${i}`}>
            <div className={`issue issue-${issue.severity}`}>
              <span className="issue-head">
                <span className="issue-severity">{issue.severity}</span>
                <span className="issue-code mono">{issue.code}</span>
              </span>
              <span className="issue-message">{issue.message}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const kindTitle = (node: Node): string => KIND_LABEL[node.kind];
