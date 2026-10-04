/**
 * The canvas's side of a subgrooph's box (amendment A-018, handoff 0085). The box itself, and core's fold behind
 * it, are a piece fetched only for a document that has a subgrooph (`units.tsx`); this file is what both canvases
 * share to ask for it, to hold which boxes are open, and to turn them into nodes of the canvas.
 *
 * A document with no subgrooph never gets here past the first line of `useBoxes`, and fetches nothing.
 */
import { glyph, type Graph, type Id, type Position, type Severity } from "@grooph/core";
import { Handle, Position as Side, type Node, type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { NODE_HEIGHT, NODE_WIDTH } from "../../doc/layout.js";
import type { Boxed, Face } from "./units.js";

type Door = typeof import("./units.js");
/** `undefined` until it is asked for, `null` when it could not be fetched: the nodes are then drawn as they are. */
let door: Door | null | undefined;

/**
 * The piece that draws a subgrooph, fetched when it is wanted and not before. `undefined` while it is on its way
 * (and always, when it is not wanted); `null` when it could not be fetched, and the caller draws without it.
 */
export function useUnitsDoor(wanted: boolean): Door | null | undefined {
  const [got, setGot] = useState(door);
  useEffect(() => {
    if (wanted && got === undefined) import("./units.js").then((m) => setGot((door = m)), () => setGot((door = null)));
  }, [wanted, got]);
  return wanted ? got : undefined;
}

export type UnitFlowNode = Node<{ face: Face; severity?: Severity; onToggle: () => void }, "unit">;

/** A box as a node of the canvas. Closed, edges reach it as they reach any node; open, it is a frame and nothing attaches to it. */
export const UnitNode = memo(function UnitNode({ data }: NodeProps<UnitFlowNode>) {
  if (!door) return null;
  const { UnitFace } = door;
  return (
    <>
      {data.face.open ? null : <Handle type="target" position={Side.Top} isConnectable={false} className="ghandle" />}
      <UnitFace {...data} />
      {data.face.open ? null : <Handle type="source" position={Side.Bottom} isConnectable={false} className="ghandle" />}
    </>
  );
});

export type Boxes = {
  /** false while a document with a subgrooph waits for its boxes: the canvas draws nothing until they are here */
  ready: boolean;
  /** the graph the canvas draws: the document, or the document with each closed box as one node */
  shown: Graph;
  /** the boxes as nodes of the canvas, frames first so that they lie under what they hold */
  nodes: UnitFlowNode[];
  /** where a box is and how large, for the edges that reach it */
  rect: (id: Id) => { x: number; y: number; w: number; h: number } | undefined;
  /** a closed box's own nodes, when `id` is one */
  nodesOf: (id: Id) => Id[] | undefined;
  /** open a closed box, close an open one */
  toggle: (id: Id) => void;
};

const NONE: readonly Id[] = [];

/**
 * The boxes of a document. `all` draws every one open (a run's canvas shows each node's state); `reveal` names
 * nodes that must be in sight (the one a panel is about, the ones an issue points at): their boxes open.
 */
export function useBoxes(
  doc: Graph,
  positions: Record<Id, Position>,
  measured: Record<Id, { width: number; height: number }>,
  options: { all?: boolean; reveal?: readonly Id[]; drag?: Record<Id, Position>; severity?: ReadonlyMap<Id, Severity> } = {},
): Boxes {
  const wanted = (doc.groups ?? []).some((group) => group.from !== undefined);
  const got = useUnitsDoor(wanted);
  const [open, setOpen] = useState<readonly Id[]>(NONE);
  const toggle = useCallback((id: Id) => setOpen((now) => (now.includes(id) ? now.filter((other) => other !== id) : [...now, id])), []);

  // A node inside a closed box has not been drawn, so its size is not known: a box takes the room of nodes of the
  // usual size, and of a taller one once it has been seen. Open or shut, the box is then the same box.
  const boxed: Boxed | undefined = useMemo(
    () => (wanted && got ? got.boxesFor(glyph, doc, options.all ? "all" : open, positions, (id) => ({ w: Math.max(measured[id]?.width ?? 0, NODE_WIDTH), h: Math.max(measured[id]?.height ?? 0, NODE_HEIGHT) })) : undefined),
    [wanted, got, doc, options.all, open, positions, measured],
  );
  // A node that has to be seen opens the boxes around it.
  const reveal = (options.reveal ?? NONE).join(" ");
  useEffect(() => {
    if (!boxed || reveal === "") return;
    const shut = [...new Set(reveal.split(" ").flatMap((id) => boxed.hides(id)))];
    if (shut.length > 0) setOpen((now) => [...new Set([...now, ...shut])]);
  }, [boxed, reveal]);

  const { drag, severity } = options;
  return useMemo(() => {
    if (!boxed) return { ready: !wanted || got === null, shown: doc, nodes: [], rect: () => undefined, nodesOf: () => undefined, toggle };
    const rects = new Map(boxed.boxes.map((box) => [box.face.id, box.rect]));
    const worst = (id: Id): Severity | undefined => {
      const found = boxed.nodesOf(id).map((node) => severity?.get(node));
      return found.includes("error") ? "error" : found.includes("warning") ? "warning" : undefined;
    };
    return {
      ready: true,
      shown: boxed.doc,
      nodes: boxed.boxes.map(({ face, rect }) => {
        const flaw = face.open ? undefined : worst(face.id);
        return {
          id: face.id,
          type: "unit" as const,
          position: drag?.[face.id] ?? { x: rect.x, y: rect.y },
          // Its size is its nodes' room, known before it is drawn: the canvas need not measure it to show it.
          style: { width: rect.w, height: rect.h },
          measured: { width: rect.w, height: rect.h },
          ariaLabel: face.label,
          // A frame lies under the nodes it holds, takes no tap and does not move; a closed box is a node like another.
          zIndex: face.open ? -1 : 0,
          draggable: !face.open,
          focusable: !face.open,
          ...(face.open ? { className: "unit-frame" } : {}),
          data: { face, ...(flaw ? { severity: flaw } : {}), onToggle: () => toggle(face.id) },
        };
      }),
      rect: (id) => rects.get(id),
      nodesOf: (id) => (boxed.boxes.some((box) => box.face.id === id && !box.face.open) ? boxed.nodesOf(id) : undefined),
      toggle,
    };
  }, [boxed, wanted, got, doc, drag, severity, toggle]);
}
