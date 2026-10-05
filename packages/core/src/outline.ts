/**
 * The outline: a graph, or an operation map, as something to read from top
 * to bottom. Every node with its whole brief, every edge said as a sentence,
 * every loop with its bar and its stops. It is the view for reviewing on a
 * phone what an agent built, without tapping each node open, and it is what
 * the offline page and `grooph outline` print.
 *
 * A projection like the picture: it never round-trips, and edits happen in
 * the document. Pure and deterministic.
 */

import { indexGraph } from "./graph-index.js";
import { layerNodes } from "./layout.js";
import { CARRIER_LABEL, endName, handoffCarrierText, mapShape, mapShapeLine, wakesItself } from "./map.js";
import { estimateShape, shapeLine, tierLine } from "./proposals.js";
import { describeStop, loopMode, stopAction } from "./semantics.js";
import type { Edge, Graph, Group, Id, Node, OperationMap } from "./types.js";

/** One fact: a label and its text, or a list. */
export type OutlineItem = { label: string; text?: string; list?: string[] };

export type OutlineSection = {
  /** the id of the object this section is about; the document's own id for the first */
  id: Id;
  /** what kind of thing: "Graph", "Agent", "Human gate", "Subgrooph", "Loop", "Session", "Lane", "Handoffs" */
  kind: string;
  title: string;
  items: OutlineItem[];
  /** the subgrooph this node, or this subgrooph, is part of: a view may fold its sections into that one box */
  inside?: Id;
};

const KIND_LABEL: Record<Node["kind"], string> = { agent: "Agent", "human-gate": "Human gate", check: "Check", merge: "Merge", stop: "Stop" };

const item = (label: string, value: string | string[] | undefined): OutlineItem[] => {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.length > 0 ? [{ label, list: value }] : [];
  return value.trim() === "" ? [] : [{ label, text: value }];
};

/** An edge as its far end reads it: "on fail, to Builder (fresh context; sees diff, test output; needs approval)". */
function edgeSentence(edge: Edge, toward: "to" | "from", nameOf: (id: Id) => string, back: boolean): string {
  const when = edge.when ?? "always";
  const condition = typeof when === "object" ? `on verdict "${when.verdict}"` : when === "always" ? "always" : `on ${when}`;
  const notes = [
    back ? "back edge: starts the next round" : undefined,
    toward === "to" ? `${edge.isolation ?? "fresh"} context` : undefined,
    edge.evidence && edge.evidence.length > 0 ? `sees ${edge.evidence.join(", ")}` : undefined,
    edge.approval ? "needs a person's approval" : undefined,
    edge.concurrency ? `at most ${edge.concurrency.max} at once` : undefined,
    edge.retry ? `retry up to ${edge.retry.max}` : undefined,
    edge.label,
  ].filter((n): n is string => n !== undefined && n !== "");
  return `${condition}, ${toward} ${nameOf(edge[toward])}${notes.length > 0 ? ` (${notes.join("; ")})` : ""}`;
}

/** A graph, top to bottom: the graph itself, each node in the order work reaches it, then each loop. */
export function outline(doc: Graph): OutlineSection[] {
  const index = indexGraph(doc);
  const nodes = new Map<Id, Node>(doc.nodes.map((n) => [n.id, n]));
  const nameOf = (id: Id): string => nodes.get(id)?.name || id;
  const backEdges = new Set(doc.loops.flatMap((l) => l.back));
  const sections: OutlineSection[] = [];
  // A subgrooph is read as a unit (amendment A-018): the nearest one that holds a node, through any plain group.
  const groups = doc.groups ?? [];
  const holder = (id: Id): Group | undefined => groups.find((group) => group.members.includes(id));
  const unitOf = (id: Id): Group | undefined => {
    let group = holder(id);
    for (let n = 0; group && !group.from && n < groups.length; n++) group = holder(group.id);
    return group?.from ? group : undefined;
  };
  const partOf = (id: Id): { inside?: Id } => (unitOf(id) ? { inside: unitOf(id)!.id } : {});

  const shape = estimateShape(doc);
  sections.push({
    id: doc.id,
    kind: doc.template ? "Template" : "Graph",
    title: doc.name || doc.id,
    items: [
      ...item("Goal", doc.goal),
      ...item("About", doc.description),
      ...item("Shape", doc.nodes.length > 0 ? shapeLine(shape) : undefined),
      ...item("Model tiers", shape.agents > 0 ? tierLine(shape) : undefined),
      ...item("Runs in", doc.target?.harness),
      ...item("Budget", doc.constraints?.budget),
      ...item("Time", doc.constraints?.time),
      ...item("Other limits", doc.constraints?.other),
      ...item("If the graph turns out wrong", doc.adaptation === "fixed" ? "fixed: the lead follows it exactly, or halts and asks" : doc.adaptation === "propose" ? "propose: the lead changes nothing and records proposals" : "adaptive: the lead may amend its working copy, visibly; brakes cannot be loosened"),
      ...item("Version", `${doc.id}@${doc.version}`),
    ],
  });

  for (const id of layerNodes(doc).flat()) {
    const node = nodes.get(id)!;
    const out = doc.edges.filter((e) => e.from === id && nodes.has(e.to)).map((e) => edgeSentence(e, "to", nameOf, backEdges.has(e.id)));
    const into = doc.edges.filter((e) => e.to === id && nodes.has(e.from)).map((e) => edgeSentence(e, "from", nameOf, backEdges.has(e.id)));
    const inLoops = doc.loops.filter((l) => l.members.includes(id)).map((l) => l.name || l.id);
    const own: OutlineItem[] = (() => {
      switch (node.kind) {
        case "agent":
          return [
            ...item("Role", typeof node.role === "string" ? node.role : `${node.role.custom} (custom)`),
            ...item("Model", [node.model?.tier ?? "session default", ...Object.entries(node.model?.pin ?? {}).map(([h, m]) => `${h}: ${m}`), node.effort ? `${node.effort} effort` : ""].filter((s) => s !== "").join(" · ")),
            ...item("Brief", node.brief),
            ...item("Expects", node.inputs),
            ...item("Leaves behind", node.outputs),
            ...item("May", node.allow),
            ...item("May not", node.deny),
            ...item("Skills", node.skills),
            ...item("Owns", node.owns),
            ...item("Irreversible", node.irreversible),
          ];
        case "human-gate":
          return [...item("Asks", node.prompt), ...item("Answers", node.options)];
        case "check":
          return [...item("Checks", node.check.kind), ...item("Runs", node.check.run), ...item("Passes when", node.check.pass), ...item("Threshold", node.check.threshold === undefined ? undefined : String(node.check.threshold))];
        case "merge":
          return [...item("Merges", node.merges), ...item("How", node.strategy)];
        case "stop":
          return [...item("Ends the run with", node.outcome ?? "its last result")];
      }
    })();
    sections.push({
      id,
      kind: KIND_LABEL[node.kind],
      title: node.name || node.id,
      items: [...item("About", node.description), ...item("Part of", unitOf(id)?.name), ...own, ...item("In loop", inLoops), ...item("Then", out), ...item("Reached", into)],
      ...partOf(id),
    });
  }

  for (const group of groups) {
    if (!group.from) continue;
    sections.push({
      id: group.id,
      kind: "Subgrooph",
      title: group.name,
      items: [
        ...item("About", group.description),
        ...item("Placed from", `the template ${group.from.replace("@", ", version ")}`),
        ...item("Filled with", Object.entries(group.with ?? {}).map(([key, value]) => `${key}: ${value}`)),
        ...item("Part of", unitOf(group.id)?.name),
        ...item("Holds", [...doc.nodes, ...groups].filter((held) => unitOf(held.id) === group && (!("members" in held) || held.from)).map((held) => held.name || held.id)),
      ],
      ...partOf(group.id),
    });
  }

  for (const loop of doc.loops) {
    sections.push({
      id: loop.id,
      kind: "Loop",
      title: loop.name || loop.id,
      items: [
        ...item("Kind", `${loopMode(index, loop)} loop`),
        ...item("Members", loop.members.map(nameOf)),
        ...item("Bar", loop.bar?.name),
        ...item("Good enough to stop", loop.bar?.acceptance),
        ...item("Aiming at", loop.bar?.aspiration),
        ...item("The critic inspects", loop.bar?.inspects.map((e) => `${e.kind}: ${e.ref}${e.note ? ` (${e.note})` : ""}`)),
        ...item("Stops, in order", loop.stops.map((s) => `${describeStop(s)}: ${stopAction(s).replace(/`/g, "")}`)),
      ],
    });
  }

  for (const policy of doc.policies ?? []) {
    sections.push({
      id: policy.id,
      kind: "Policy",
      title: typeof policy.kind === "string" ? policy.kind : policy.kind.custom,
      items: [...item("Applies to", policy.scope), ...item("Settings", Object.entries(policy.params ?? {}).map(([k, v]) => `${k}: ${String(v)}`))],
    });
  }
  return sections;
}

/** An operation map, top to bottom: the map, each lane with its sessions, then every handoff. */
export function mapOutline(map: OperationMap): OutlineSection[] {
  const nameOf = (id: Id): string => endName(map, id);
  const harness = (h: string): string => (h === "claude-code" ? "Claude Code" : h === "codex" ? "Codex" : h);
  const said = (h: (typeof map.handoffs)[number], toward: "to" | "from"): string =>
    `${toward} ${h.from === h.to ? "itself" : nameOf(h[toward])}, by ${handoffCarrierText(map, h) || (h.carrier ? `${CARRIER_LABEL[h.carrier.kind]} (not named)` : "no named carrier")}${h.what ? `: ${h.what}` : ""}`;
  const sections: OutlineSection[] = [
    { id: map.id, kind: "Operation map", title: map.name || map.id, items: [...item("As of", map.asOf), ...item("Shape", mapShapeLine(mapShape(map))), ...item("About", map.description), ...item("Version", `${map.id}@${map.version}`)] },
  ];
  for (const p of map.people ?? []) {
    sections.push({
      id: p.id,
      kind: "Person",
      title: p.name || p.id,
      items: [
        ...item("Role", p.role),
        ...item("About", p.description),
        ...item("Hands work", map.handoffs.filter((h) => h.from === p.id).map((h) => said(h, "to"))),
        ...item("Is handed work", map.handoffs.filter((h) => h.to === p.id).map((h) => said(h, "from"))),
      ],
    });
  }
  for (const lane of map.lanes) {
    sections.push({
      id: lane.id,
      kind: "Lane",
      title: lane.name || lane.id,
      items: [...item("Machine", `${lane.machine}${lane.place ? ` (${lane.place})` : ""}`), ...item("Account", lane.account), ...item("About", lane.description), ...item("Sessions", map.sessions.filter((s) => s.lane === lane.id).map((s) => s.name || s.id))],
    });
    for (const s of map.sessions.filter((x) => x.lane === lane.id)) {
      const wakes = wakesItself(map, s.id);
      sections.push({
        id: s.id,
        kind: "Session",
        title: s.name || s.id,
        items: [
          ...item("Role", s.role),
          ...item("Runs on", [harness(s.harness), s.model].filter(Boolean).join(" · ")),
          ...item("How many", s.count && s.count > 1 ? `${s.count} like sessions, drawn as one` : undefined),
          ...item("Lifetime", s.lifetime === "per-task" ? "per task" : s.lifetime),
          ...item("Wakes itself", wakes === undefined ? undefined : wakes === "" ? "on a schedule" : wakes),
          ...item("Repository", s.repo),
          ...item("Its graph", s.graph),
          ...item("About", s.description),
          ...item("Hands work", map.handoffs.filter((h) => h.from === s.id).map((h) => said(h, "to"))),
          ...item("Is handed work", map.handoffs.filter((h) => h.to === s.id).map((h) => said(h, "from"))),
        ],
      });
    }
  }
  return sections;
}

/** The outline as Markdown: what `grooph outline` prints. */
export function outlineMarkdown(sections: OutlineSection[]): string {
  const lines: string[] = [];
  sections.forEach((section, i) => {
    lines.push(`${i === 0 ? "#" : "##"} ${i === 0 ? "" : `${section.kind}: `}${section.title}`, "");
    if (i > 0) lines.push(`\`${section.id}\``, "");
    for (const it of section.items) {
      if (it.list) {
        lines.push(`**${it.label}**`, "");
        for (const entry of it.list) lines.push(`- ${entry}`);
        lines.push("");
      } else if ((it.text ?? "").includes("\n") || (it.text ?? "").length > 90) lines.push(`**${it.label}**`, "", it.text!.trim(), "");
      else lines.push(`**${it.label}:** ${it.text}`, "");
    }
  });
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
