import {
  CARRIER_LABEL,
  describeStop,
  endName,
  handoffCarrierText,
  handoffsOf,
  indexGraph,
  loopMode,
  type Graph,
  type Id,
  type Loop,
  type Node,
  type OperationMap,
  type RunNote,
} from "@grooph/core";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * What a tap opens in an embed: the brief of a node, a loop's bar and stops,
 * or a session or handoff of a map, read-only and in the document's words.
 * Escape and the close button shut it, and focus goes back where it was.
 */

export type Picked =
  | { kind: "node"; id: Id }
  | { kind: "loop"; id: Id }
  | { kind: "session"; id: Id }
  | { kind: "person"; id: Id }
  | { kind: "handoff"; id: Id };

const KIND: Record<Node["kind"], string> = { agent: "Agent", "human-gate": "Human gate", check: "Check", merge: "Merge", stop: "Stop" };

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
  if (shown.length === 0) return null;
  return (
    <dl className="gx-rows">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const list = (items: readonly string[] | undefined): ReactNode =>
  items && items.length > 0 ? (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : undefined;

/** One line of what the run did here, at the step the replay is on. */
export type RunHere = { state: string; round?: number; runs: number; note?: RunNote };

function NodeBody({ doc, node, run }: { doc: Graph; node: Node; run?: RunHere }) {
  const loops = doc.loops.filter((l) => l.members.includes(node.id)).map((l) => l.name || l.id);
  const rows: [string, ReactNode][] = [];
  switch (node.kind) {
    case "agent": {
      const role = typeof node.role === "string" ? node.role : node.role.custom;
      // A person's step has a role and no tier, effort or capabilities: what a document still carries of those is not read.
      const agents = node.by !== "person";
      rows.push(
        ["Role", agents ? [role, node.model?.tier, node.effort].filter(Boolean).join(" · ") : role],
        ["Brief", <p className="gx-prose">{node.brief}</p>],
        ["Reads", list(node.inputs)],
        ["Leaves", list(node.outputs)],
        ["May", agents ? node.allow?.join(", ") : undefined],
        ["May not", agents ? node.deny?.join(", ") : undefined],
        ["Irreversible", node.irreversible?.join(", ")],
      );
      break;
    }
    case "human-gate":
      rows.push(["Asks", <p className="gx-prose">{node.prompt}</p>], ["Answers", node.options?.join(" / ")]);
      break;
    case "check":
      rows.push(["Kind", node.check.kind], ["Runs", node.check.run ? <code>{node.check.run}</code> : undefined], ["Passes when", <p className="gx-prose">{node.check.pass}</p>]);
      break;
    case "merge":
      rows.push(["Merges", node.merges.join(", ")], ["How", node.strategy]);
      break;
    case "stop":
      rows.push(["Ends the run", node.outcome ?? "yes"]);
      break;
  }
  rows.push(["About", node.description ? <p className="gx-prose">{node.description}</p> : undefined], ["In loop", loops.join(", ")]);
  return (
    <>
      {run ? <RunLine run={run} /> : null}
      <Rows rows={rows} />
    </>
  );
}

function RunLine({ run }: { run: RunHere }) {
  const facts = [run.state, run.round !== undefined ? `round ${run.round}` : "", run.runs > 1 ? `${run.runs} dispatches` : ""].filter(Boolean).join(" · ");
  return (
    <div className="gx-runline" data-state={run.state}>
      <strong>At this step: {facts}</strong>
      {run.note?.text ? <p>{run.note.text}</p> : null}
    </div>
  );
}

function LoopBody({ doc, loop, round }: { doc: Graph; loop: Loop; round?: string }) {
  const name = (id: Id) => doc.nodes.find((n) => n.id === id)?.name || id;
  return (
    <>
      {round ? (
        <div className="gx-runline">
          <strong>At this step: {round}</strong>
        </div>
      ) : null}
      <Rows
        rows={[
          ["Kind", `${loopMode(indexGraph(doc), loop)} loop`],
          ["Members", loop.members.map(name).join(", ")],
          ["Bar", loop.bar ? <p className="gx-prose">{`${loop.bar.name}. ${loop.bar.acceptance}`}</p> : undefined],
          ["Stops, in order", list(loop.stops.map(describeStop))],
        ]}
      />
    </>
  );
}

function MapBody({ map, picked }: { map: OperationMap; picked: Picked }) {
  if (picked.kind === "session") {
    const s = map.sessions.find((x) => x.id === picked.id);
    if (!s) return null;
    const { out, in: inward } = handoffsOf(map, s.id);
    return (
      <Rows
        rows={[
          ["Does", s.role],
          ["Runs in", [s.harness, s.model, s.lifetime, s.count && s.count > 1 ? `${s.count} like it` : ""].filter(Boolean).join(" · ")],
          ["Lane", map.lanes.find((l) => l.id === s.lane)?.name ?? s.lane],
          ["Repository", s.repo],
          ["Graph", s.graph],
          ["About", s.description ? <p className="gx-prose">{s.description}</p> : undefined],
          ["Hands to", list(out.map((h) => `${endName(map, h.to)}${h.what ? `: ${h.what}` : ""}`))],
          ["Takes from", list(inward.map((h) => `${endName(map, h.from)}${h.what ? `: ${h.what}` : ""}`))],
        ]}
      />
    );
  }
  if (picked.kind === "person") {
    const p = (map.people ?? []).find((x) => x.id === picked.id);
    if (!p) return null;
    return <Rows rows={[["Does", p.role], ["About", p.description ? <p className="gx-prose">{p.description}</p> : undefined]]} />;
  }
  const h = map.handoffs.find((x) => x.id === picked.id);
  if (!h) return null;
  return (
    <Rows
      rows={[
        ["From", endName(map, h.from)],
        ["To", endName(map, h.to)],
        ["What", h.what],
        ["Carried by", h.carrier ? `${CARRIER_LABEL[h.carrier.kind]}: ${handoffCarrierText(map, h)}` : "not named"],
      ]}
    />
  );
}

/** The title and kind line for what was picked. */
export function pickedTitle(doc: Graph | OperationMap, picked: Picked): { kind: string; name: string } | undefined {
  if ("grooph" in doc) {
    if (picked.kind === "node") {
      const node = doc.nodes.find((n) => n.id === picked.id);
      return node ? { kind: node.kind === "agent" && node.by === "person" ? "Person" : KIND[node.kind], name: node.name || node.id } : undefined;
    }
    if (picked.kind === "loop") {
      const loop = doc.loops.find((l) => l.id === picked.id);
      return loop ? { kind: "Loop", name: loop.name || loop.id } : undefined;
    }
    return undefined;
  }
  if (picked.kind === "session") return { kind: "Session", name: endName(doc, picked.id) };
  if (picked.kind === "person") return { kind: "Person", name: endName(doc, picked.id) };
  if (picked.kind === "handoff") {
    const n = doc.handoffs.findIndex((h) => h.id === picked.id);
    const h = doc.handoffs[n];
    return h ? { kind: `Handoff ${n + 1}`, name: `${endName(doc, h.from)} → ${endName(doc, h.to)}` } : undefined;
  }
  return undefined;
}

export function Brief({
  doc,
  picked,
  run,
  loopRound,
  onClose,
}: {
  doc: Graph | OperationMap;
  picked: Picked;
  run?: RunHere;
  loopRound?: string;
  onClose: () => void;
}) {
  const title = pickedTitle(doc, picked);
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus comes in when the panel opens or shows something else, and goes back to the part of the picture it shows when it shuts.
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, [picked.kind, picked.id]);
  useEffect(() => {
    const before = document.activeElement;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      const { kind, id } = pickedRef.current;
      const shown = document.querySelector(kind === "handoff" ? `[data-handoff-row="${CSS.escape(id)}"]` : `[data-${kind}="${CSS.escape(id)}"]`);
      const back = shown ?? before;
      if (back instanceof HTMLElement || back instanceof SVGElement) back.focus({ preventScroll: true });
    };
  }, []);

  if (!title) return null;
  let body: ReactNode = null;
  if ("grooph" in doc) {
    if (picked.kind === "node") {
      const node = doc.nodes.find((n) => n.id === picked.id)!;
      body = <NodeBody doc={doc} node={node} {...(run ? { run } : {})} />;
    } else if (picked.kind === "loop") {
      body = <LoopBody doc={doc} loop={doc.loops.find((l) => l.id === picked.id)!} {...(loopRound ? { round: loopRound } : {})} />;
    }
  } else body = <MapBody map={doc} picked={picked} />;

  return (
    <aside className="gx-brief" role="dialog" aria-modal="false" aria-labelledby="gx-brief-title">
      <header>
        <div>
          <span className="gx-brief-kind">{title.kind}</span>
          <h2 id="gx-brief-title">{title.name}</h2>
        </div>
        <button ref={close} type="button" className="gx-btn gx-icon" aria-label="Close brief" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="gx-brief-body">{body}</div>
    </aside>
  );
}
