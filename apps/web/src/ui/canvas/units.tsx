/**
 * A subgrooph on the canvas (amendment A-018, handoff 0085): one box. Closed, it lies over the place its nodes
 * have and says what it holds: its name, the template and version it came from, how many nodes, which brakes, and
 * the glyph of what is inside. Open, it is a frame around those nodes. It opens in place: no other node moves, and
 * a node keeps the position the document gives it whether its box is open or shut.
 *
 * This is a piece of the app fetched only for a document that has a subgrooph (decision 0021), like a map's other
 * views (`ui/map/views.tsx` says why such a piece imports nothing the app's other pieces share but React). Core's
 * fold is behind a door of its own. What the canvas has and this piece needs, the canvas's node hands it when it
 * draws a box: the glyph, and the canvas library's handle. The styles ride in the script.
 *
 * Everything about a box is here, so that a canvas whose document has none carries only the question and the
 * fetch (`boxes.ts`): which boxes are open, the room each takes, the nodes of the canvas they become, what a tap
 * and a drag do to one, and the outline's fold.
 */
import type { Graph, Id, OutlineSection, Position, Severity } from "@grooph/core";
import { foldUnits, unitGraph, unitLine } from "@grooph/core/units";
import { memo, useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

import css from "./units.css?inline";

const sheet = document.createElement("style");
sheet.textContent = css;
document.head.append(sheet);

/** Around the nodes of a box, and above them for its name. */
const PAD = 14;
const HEAD = 34;

/** A node of the canvas as it is laid out and drawn before it has been measured (core's `DEFAULT_LAYOUT_BOX`, the editor's node). */
const USUAL = { w: 200, h: 84 };

export type Rect = { x: number; y: number; w: number; h: number };

export type Face = {
  id: Id;
  name: string;
  open: boolean;
  /** `review-gate@1 · 3 nodes · 1 human gate · 1 loop` */
  line: string;
  about?: string;
  irreversible: string[];
  /** what it holds, as a graph of its own: the glyph of this is the box's */
  holds: Graph;
  /** what a person who cannot see it is told */
  label: string;
};

export type Boxed = {
  /** the graph as the canvas draws it: each closed box one node, under the group's id */
  doc: Graph;
  /** the boxes that are drawn, outermost first, each with the place it takes */
  boxes: { face: Face; rect: Rect }[];
  /** every node inside a box: what moves when a closed box is dragged */
  nodesOf: (box: Id) => Id[];
  /** the boxes that have to open for a node to be seen, outermost first; none when it is in sight */
  hides: (node: Id) => Id[];
};

/**
 * The boxes of a document and the graph the canvas draws with them. `positions` and `size` are the nodes' own, as
 * the canvas has them: a box takes the room its nodes take, with a margin and a line for its name.
 */
export function boxesFor(doc: Graph, open: readonly Id[] | "all", positions: Record<Id, Position>, size: (node: Id) => { w: number; h: number }): Boxed {
  const folded = foldUnits(doc, open);
  const rects = new Map<Id, Rect>();
  // Innermost first: a box that holds another makes room for that one's frame.
  for (const box of [...folded.boxes].reverse()) {
    const within = new Set(box.nodes);
    const held: Rect[] = box.nodes.map((id) => ({ ...(positions[id] ?? { x: 0, y: 0 }), ...size(id) }));
    for (const inner of folded.boxes) if (inner.depth > box.depth && inner.nodes.every((id) => within.has(id)) && rects.has(inner.group.id)) held.push(rects.get(inner.group.id)!);
    const x = Math.min(...held.map((r) => r.x)) - PAD;
    const y = Math.min(...held.map((r) => r.y)) - HEAD;
    rects.set(box.group.id, { x, y, w: Math.max(...held.map((r) => r.x + r.w)) + PAD - x, h: Math.max(...held.map((r) => r.y + r.h)) + PAD - y });
  }
  const byId = new Map(folded.boxes.map((box) => [box.group.id, box]));
  return {
    doc: folded.doc,
    boxes: folded.boxes.map((box) => {
      const said = unitLine(doc, box);
      const name = box.group.name || box.group.id;
      return {
        rect: rects.get(box.group.id)!,
        face: {
          id: box.group.id,
          name,
          open: box.open,
          line: said.line,
          ...(box.group.description ? { about: box.group.description } : {}),
          irreversible: said.irreversible,
          holds: unitGraph(doc, box),
          label: `Subgrooph: ${name}, ${said.line.split(" · ").slice(1).join(", ")}${box.open ? "" : ". Closed: Enter opens it"}`,
        },
      };
    }),
    nodesOf: (id) => byId.get(id)?.nodes ?? [],
    hides: (node) => {
      const chain = folded.chain(node).map((group) => group.id);
      const shut = chain.findIndex((id) => !(open === "all" || open.includes(id)));
      return shut < 0 ? [] : chain.slice(shut);
    },
  };
}

/**
 * A subgrooph in the outline: one box, shut until it is opened, that holds the sections of its nodes. What it says
 * shut is what the canvas's box says: its name, where it came from, how many nodes.
 */
function OutlineUnit({ section, count, open, onToggle, children }: { section: OutlineSection; count: number; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  const from = section.items.find((item) => item.label === "Placed from")?.text;
  return (
    <details className="outline-unit" data-outline-id={section.id} open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <span className="outline-kind">Subgrooph</span>
        <span className="outline-unit-name">{section.title}</span>
        <span className="outline-unit-line">
          {count} {count === 1 ? "node" : "nodes"}
          {from ? `, placed from ${from}` : ""}
        </span>
      </summary>
      {children}
    </details>
  );
}

/**
 * The outline's sections with each subgrooph's folded into its box, set where the first of its nodes comes. `one`
 * draws a section, as the outline does. The section a panel is about is in sight: its boxes open, and it is
 * brought into view.
 */
export function OutlineFold({ sections, current, one }: { sections: OutlineSection[]; current?: Id; one: (section: OutlineSection, i: number) => ReactNode }) {
  const [opened, setOpened] = useState<ReadonlySet<Id>>(new Set());
  /** the boxes around a section, innermost first */
  const around = (id: Id | undefined): Id[] => {
    const inside = sections.find((section) => section.id === id)?.inside;
    return inside === undefined ? [] : [inside, ...around(inside)];
  };
  const held = around(current).join(" ");
  useEffect(() => {
    if (held === "") return;
    setOpened((now) => new Set([...now, ...held.split(" ")]));
    requestAnimationFrame(() => document.querySelector(".outline .is-current")?.scrollIntoView({ block: "nearest" }));
  }, [current, held]);
  /** What is drawn directly inside `box` (at the top when undefined), in the outline's order. */
  const within = (box: Id | undefined): ReactNode[] => {
    const drawn = new Set<Id>();
    return sections.flatMap((section, i): ReactNode[] => {
      // The thing directly inside `box` that this section is, or is somewhere within.
      const chain = [section.id, ...around(section.id)];
      const at = box === undefined ? chain.length : chain.indexOf(box);
      const child = at > 0 ? chain[at - 1]! : undefined;
      if (child === undefined || drawn.has(child)) return [];
      drawn.add(child);
      const top = child === section.id ? section : sections.find((other) => other.id === child && other.kind === "Subgrooph");
      if (!top) return [];
      if (top.kind !== "Subgrooph") return [one(top, i)];
      const count = sections.filter((other) => other.kind !== "Subgrooph" && around(other.id).includes(top.id)).length;
      return [
        <OutlineUnit key={`unit-${top.id}`} section={top} count={count} open={opened.has(top.id)} onToggle={(open) => setOpened((now) => new Set(open ? [...now, top.id] : [...now].filter((id) => id !== top.id)))}>
          {one(top, sections.indexOf(top))}
          {within(top.id)}
        </OutlineUnit>,
      ];
    });
  };
  return <>{within(undefined)}</>;
}

/** A box as it is drawn: closed, a card as large as the room its nodes take; open, a frame with its name and a way to close it. */
function UnitFace({ face, severity, onToggle, glyph }: Omit<UnitData, "rect"> & { glyph: (doc: Graph) => string }) {
  const drawn = useMemo(() => (face.open ? "" : glyph(face.holds)), [face, glyph]);
  if (face.open) {
    return (
      <div className="unit unit-open" data-unit-id={face.id} data-open="">
        <div className="unit-head">
          <span className="unit-name">{face.name}</span>
          <span className="unit-from">{face.line.split(" · ")[0]}</span>
          <button
            type="button"
            className="unit-close nodrag nopan"
            aria-label={`Close ${face.name}`}
            aria-expanded="true"
            onClick={(event) => {
              // The button is inside the frame's node: the canvas would take the same click for a tap on that node.
              event.stopPropagation();
              onToggle();
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="unit unit-closed"
      data-unit-id={face.id}
      role="button"
      tabIndex={0}
      aria-expanded="false"
      aria-label={face.label}
      // A tap on the box opens it, and so does Enter. The canvas would take either for one on a node, and a box is none.
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <div className="unit-kind">
        <span className="unit-mark" aria-hidden="true" />
        Subgrooph
      </div>
      <div className="unit-name">{face.name}</div>
      <div className="unit-line">{face.line}</div>
      {face.about ? <div className="unit-about">{face.about}</div> : null}
      {face.irreversible.length > 0 ? <div className="unit-warn">irreversible inside: {face.irreversible.join(", ")}</div> : null}
      <div className="unit-glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: drawn }} />
      <div className="unit-hint">Open</div>
      {severity ? <span className={`gnode-issue issue-dot-${severity}`} role="img" aria-label={`has ${severity}s inside`} /> : null}
    </div>
  );
}

type UnitData = { face: Face; rect: Rect; severity?: Severity; onToggle: () => void };
/** The node that stands for a box in the graph the canvas draws: a node like any other to the canvas, and `unit` says what it is. */
type StandIn = Graph["nodes"][number] & { unit: UnitData };

/**
 * A box as the canvas's node draws it (`GraphNode.tsx` hands it here, with the handle and the glyph). Closed, edges
 * reach it as they reach any node; open, it is a frame and nothing attaches to it.
 */
export const UnitNode = memo(function UnitNode({ unit, Handle, glyph }: { unit: UnitData; Handle: ComponentType<{ type: "source" | "target"; position: never; isConnectable: boolean; className: string }>; glyph: (doc: Graph) => string }) {
  return (
    <div style={{ width: unit.rect.w, height: unit.rect.h }}>
      {unit.face.open ? null : <Handle type="target" position={"top" as never} isConnectable={false} className="ghandle" />}
      <UnitFace {...unit} glyph={glyph} />
      {unit.face.open ? null : <Handle type="source" position={"bottom" as never} isConnectable={false} className="ghandle" />}
    </div>
  );
});

const NONE: readonly Id[] = [];

/** What a canvas does with its boxes. */
export type Boxes = {
  /** the graph the canvas draws: the document with each closed box as one node */
  doc: Graph;
  /** where the canvas puts each node of that graph: the document's own places, and each box over the room its nodes take */
  positions: Record<Id, Position>;
  /**
   * The canvas's own nodes with the frames of the open boxes under them. A closed box is its face's to focus and to
   * open, not the canvas's, and it does not drag: its nodes are moved with the box open, where each can be seen.
   */
  with: <T extends { id: string }>(own: T[]) => T[];
};

/**
 * The boxes of a document, for a canvas that has put the document's nodes at `positions`. `pointed` and `selected`
 * name nodes that must be in sight (the ones an issue or a note points at, the one a panel is about): their boxes
 * open. `all` draws every box open: a run's canvas shows each node's state.
 */
export function useBoxes(
  doc: Graph,
  positions: Record<Id, Position>,
  measured: Record<Id, { width: number; height: number }>,
  severity: ReadonlyMap<Id, Severity>,
  pointed: Iterable<Id> = NONE,
  selected?: Id,
  all = false,
): Boxes {
  const [open, setOpen] = useState<readonly Id[]>(NONE);
  const toggle = useCallback((id: Id) => setOpen((now) => (now.includes(id) ? now.filter((other) => other !== id) : [...now, id])), []);
  // A node inside a closed box has not been drawn, so its size is not known: a box takes the room of nodes of the
  // usual size, and of a taller one once it has been seen. Open or shut, the box is then the same box.
  const boxed = useMemo(
    () => boxesFor(doc, all ? "all" : open, positions, (id) => ({ w: Math.max(measured[id]?.width ?? 0, USUAL.w), h: Math.max(measured[id]?.height ?? 0, USUAL.h) })),
    [doc, all, open, positions, measured],
  );
  // A node that has to be seen opens the boxes around it.
  const reveal = [...pointed, ...(selected === undefined ? [] : [selected])].join(" ");
  useEffect(() => {
    const shut = reveal === "" ? [] : [...new Set(reveal.split(" ").flatMap((id) => boxed.hides(id)))];
    if (shut.length > 0) setOpen((now) => [...new Set([...now, ...shut])]);
  }, [boxed, reveal]);

  return useMemo(() => {
    const worst = (id: Id): Severity | undefined => {
      const found = boxed.nodesOf(id).map((node) => severity.get(node));
      return found.includes("error") ? "error" : found.includes("warning") ? "warning" : undefined;
    };
    const units = new Map(
      boxed.boxes.map(({ face, rect }) => {
        const flaw = face.open ? undefined : worst(face.id);
        return [face.id, { face, rect, ...(flaw ? { severity: flaw } : {}), onToggle: () => toggle(face.id) }] as const;
      }),
    );
    const standIn = (id: Id, unit: UnitData): StandIn => ({ id, kind: "merge", name: unit.face.name, merges: [], unit });
    // An open box's frame: a node of the canvas that lies under what it holds, takes no tap and does not move.
    const frames = [...units].filter(([, unit]) => unit.face.open).map(([id, unit]) => ({
      id,
      type: "graph",
      position: { x: unit.rect.x, y: unit.rect.y },
      // Its size is its nodes' room, known before it is drawn: the canvas need not measure it to show it.
      measured: { width: unit.rect.w, height: unit.rect.h },
      zIndex: -1,
      draggable: false,
      focusable: false,
      className: "unit-frame",
      data: { node: standIn(id, unit), loops: [], selected: false, highlighted: false, connectFrom: false },
    }));
    const added = new WeakMap<object, unknown[]>();
    return {
      doc: { ...boxed.doc, nodes: boxed.doc.nodes.map((node) => (units.has(node.id) ? standIn(node.id, units.get(node.id)!) : node)) },
      positions: { ...positions, ...Object.fromEntries([...units].map(([id, unit]) => [id, { x: unit.rect.x, y: unit.rect.y }])) },
      with: (own) => (added.get(own) ?? added.set(own, [...frames, ...own.map((node) => (units.has(node.id) ? { ...node, focusable: false, draggable: false } : node))]).get(own)) as typeof own,
    };
  }, [boxed, positions, severity, toggle]);
}
