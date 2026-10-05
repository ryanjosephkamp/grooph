/**
 * A loop graph's other views (handoff 0092): the switch a map has, on every canvas, and the graph in three
 * dimensions. It is a piece of the app fetched once a canvas is up (decision 0021; `boxes.ts` asks for it), and the
 * scene itself is the map's own piece, fetched when 3D is chosen (`ui/map/space.ts`): the same sheets, cards, arcs
 * and slider, given a graph to draw. Nothing here changes the document or the canvas, which stays where it was
 * under the view.
 *
 * **What a graph's sheets are.** A loop is a sheet with its members standing on it; a node in a loop inside a loop
 * stands on the inner one. A subgrooph is a sheet. What is in neither stands on a sheet of its own, first, because
 * that is where a run begins and ends. So what repeats is seen as a place, and an edge that leaves a sheet is an
 * edge that enters or leaves a loop.
 *
 * **The slider** steps through the edges a first pass takes, in the order of the graph's layers, and then one turn
 * of each loop: its back edges, which are drawn dashed in the loop's color so that they read as returning. It is an
 * order and not a clock, and says so.
 *
 * **A recorded run** is given the slider instead: its own notes, in the order it wrote them, each lighting what it
 * is about (a node's card, an edge's arc, a loop's sheet) and saying who did what and in which round, as the run's
 * replay says it (`replaySteps` in core). That order is the run's, and it happened.
 *
 * **The picture becomes the scene.** Chosen, 3D is not put in the picture's place: each node is seen to go to its
 * card, tilting as it goes, while the canvas's edges fade and the sheets and arcs come; and back the same way
 * (`ui/become.ts`). The scene it ends on is the scene as it was before there was any motion, and with reduced
 * motion, or in a browser with no view transitions, the change is that scene in one paint.
 *
 * **The kinds of 3D.** The stairs are one way of seeing a graph in three dimensions; the others the owner picked
 * from the studio (handoff 0096) are a piece of their own (`graph-stage.tsx`), fetched when one is chosen. While a
 * view in three dimensions is up, a row under the switch says which kind it is and offers the others; the switch
 * itself stays Picture and 3D, and 3D opens the kind last chosen in the visit, the stairs the first time. From one
 * kind to another each card is seen to go to its place in the next, as from the picture.
 */
import { describeStop, edgeWhen, edgeWhenLabel, layerNodes, mapKit, replaySteps, roleName, type Edge, type Graph, type Id, type Node, type RunNote } from "@grooph/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { piece } from "../../piece.js";
import { become } from "../become.js";
import css from "./graph-views.css?inline";

type Space = typeof import("../map/space.js");
type Scene = Parameters<Space["scene"]>[1];
type Stage3 = typeof import("./graph-stage.js");
let space: Space | undefined;
let stage3: Stage3 | undefined;
let styled = false;

/** The kinds of view in three dimensions, in the order the row has them: each with its name and what it is. */
const KINDS = [
  ["stairs", "Stairs", "Each loop is a floor with its own nodes standing on it; a loop inside it has a floor of its own."],
  ["panes", "Panes", "The picture as it is, with each loop and each box lifted toward you on a pane of its own."],
] as const;
type Kind = (typeof KINDS)[number][0];
/** What is drawn over the canvas: nothing, which is the picture, or a kind of view in three dimensions. */
type On = "picture" | Kind;
/** The piece a kind is in: the map's scene for the stairs, the stage for the rest. */
const pieceOf = (kind: Kind): "space" | "stage" => (kind === "stairs" ? "space" : "stage");

// The kind last chosen, for the visit: the tab's own storage, and memory where a browser refuses that.
let last: Kind | undefined;
const kept = (): Kind => {
  if (last) return last;
  try {
    const was = sessionStorage.getItem("groophSpace");
    return KINDS.find(([id]) => id === was)?.[0] ?? "stairs";
  } catch {
    return "stairs";
  }
};
const keep = (kind: Kind): void => {
  last = kind;
  try {
    sessionStorage.setItem("groophSpace", kind);
  } catch {
    // Kept in memory, then.
  }
};

const KIND: Record<Exclude<Node["kind"], "agent">, [string, "gate" | "check" | "merge" | "stop"]> = { "human-gate": ["Human gate", "gate"], check: ["Check", "check"], merge: ["Merge", "merge"], stop: ["Stop", "stop"] };
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The edges of a first pass, in the order of the graph's layers, and then each loop's back edges: one turn of each. */
export function firstPass(doc: Graph): { edge: Edge; loop?: Graph["loops"][number] }[] {
  const rank = new Map(layerNodes(doc).flat().map((id, k) => [id, k]));
  const known = (e: Edge | undefined): e is Edge => !!e && rank.has(e.from) && rank.has(e.to);
  const back = new Map(doc.loops.flatMap((loop) => loop.back.map((id) => [id, loop] as const)));
  const forward = doc.edges.filter((e) => known(e) && !back.has(e.id)).sort((a, b) => rank.get(a.from)! - rank.get(b.from)! || rank.get(a.to)! - rank.get(b.to)!);
  const turns = [...back].map(([id, loop]) => ({ edge: doc.edges.find((e) => e.id === id), loop })).filter((t): t is { edge: Edge; loop: Graph["loops"][number] } => known(t.edge));
  return [...forward.map((edge) => ({ edge })), ...turns];
}

/**
 * A graph as a scene: its sheets with their cards, its edges as links in the order of a first pass, and what the
 * slider says at each. `card` is how wide a card is, which is the scene's to say.
 */
export function graphScene(doc: Graph, per: number, card: number, notes?: readonly RunNote[]): Scene {
  const [, , , , , , , , , , , , , , , inkFor, , , , , , , rect, , , , text, , wrap] = mapKit;
  const ink = inkFor("auto");
  const nameOf = (id: Id): string => doc.nodes.find((n) => n.id === id)?.name || id;
  const order = layerNodes(doc).flat();
  const at = new Map(order.map((id, k) => [id, k]));

  // Where each node stands: its innermost loop, else its subgrooph, else the first sheet.
  const loops = doc.loops.map((loop, k) => ({ loop, k, members: new Set(loop.members) }));
  const units = (doc.groups ?? []).filter((g) => g.from);
  const home = (id: Id): string => {
    const inner = loops.filter((l) => l.members.has(id)).sort((a, b) => a.members.size - b.members.size)[0];
    if (inner) return `loop ${inner.loop.id}`;
    const unit = units.find((g) => g.members.includes(id));
    return unit ? `unit ${unit.id}` : "";
  };
  const standing = new Map<string, Node[]>();
  for (const id of order) {
    const node = doc.nodes.find((n) => n.id === id)!;
    (standing.get(home(id)) ?? standing.set(home(id), []).get(home(id))!).push(node);
  }
  const drawn = (node: Node): Scene["sheets"][number]["items"][number] => {
    const [under, tone] = node.kind === "agent" ? [roleName(node), "accent" as const] : KIND[node.kind];
    const tier = node.kind === "agent" && node.model ? node.model.tier : "";
    const lines = wrap(node.name || node.id, card - 16, 12.5, 3, "bold");
    const h = 7 + lines.length * 15 + 13 + (tier ? 11.5 : 0) + 6;
    return {
      id: node.id,
      h,
      svg: () => {
        // A gate keeps its heavy outline and a stop its square corners, as in the picture: shape before color.
        const frame = node.kind === "human-gate" ? { fill: ink("gate-soft"), stroke: ink("gate"), rx: 12, width: 1.8 } : { fill: ink("surface"), stroke: ink(node.kind === "agent" ? "line-strong" : tone), rx: node.kind === "stop" ? 2 : 8, width: node.kind === "agent" ? 1 : 1.4 };
        let y = 5;
        const words = lines.map((line) => text(8, (y += 15), line, { size: 12.5, fill: ink("ink"), weight: "bold" }));
        return `<g data-node="${esc(node.id)}" data-kind="${node.kind}">${rect(0.7, 0.7, card - 1.4, h - 1.4, { ...frame, mark: "card" })}${words.join("")}${text(8, (y += 13), wrap(under, card - 16, 9.5, 1, "bold")[0]!, { size: 9.5, fill: ink(tone), weight: "bold" })}${tier ? text(8, y + 11.5, tier, { size: 9, fill: ink("ink-3") }) : ""}</g>`;
      },
    };
  };
  // The first sheet, then each loop and subgrooph that has a node of its own, in the order a first pass meets them.
  const others = [...standing.keys()].filter((key) => key !== "").sort((a, b) => at.get(standing.get(a)![0]!.id)! - at.get(standing.get(b)![0]!.id)!);
  const sheets: Scene["sheets"] = [...(standing.has("") || others.length === 0 ? [""] : []), ...others].map((key, k) => {
    const items = (standing.get(key) ?? []).map(drawn);
    const found = loops.find((l) => `loop ${l.loop.id}` === key);
    const unit = units.find((g) => `unit ${g.id}` === key);
    if (found) {
      const outer = loops.filter((l) => l !== found && found.loop.members.every((id) => l.members.has(id))).sort((a, b) => a.members.size - b.members.size)[0];
      return { cls: "", mark: `data-loop="${esc(found.loop.id)}"`, name: found.loop.name || found.loop.id, place: "loop", sub: `${outer ? `inside ${outer.loop.name || outer.loop.id} · ` : ""}stops: ${found.loop.stops.map(describeStop).join("; ")}`, gap: k === 0 ? 0 : 1, items };
    }
    if (unit) return { cls: "", mark: `data-unit="${esc(unit.id)}"`, name: unit.name || unit.id, place: "subgrooph", sub: `from ${unit.from}`, gap: k === 0 ? 0 : 1, items };
    return { cls: " is-people", mark: 'data-outside=""', name: others.length ? "Outside any loop" : doc.name || doc.id, place: "", sub: others.length ? "what a run passes once" : "no loop", gap: 0, items };
  });

  const pass = firstPass(doc);
  const links: Scene["links"] = pass.map(({ edge, loop }, k) => ({ id: edge.id, n: k + 1, from: edge.from, to: edge.to, style: loop ? { color: `loop-${doc.loops.indexOf(loop) % 4}` as "loop-0", dash: "6 4", width: 2.2 } : { color: "ink-2", width: 1.6 } }));
  const total = pass.length;
  const stops: Scene["stops"] = [{ short: "all steps", says: total === 0 ? "This graph has no edges to step through." : total === 1 ? "The graph's one edge is lit." : `All ${total} steps are lit. Move the slider or press Play to follow a first pass, one edge at a time.` }];
  pass.forEach(({ edge, loop }, k) => {
    const when = edgeWhen(edge) === "always" ? "" : ` · when ${edgeWhenLabel(edge)}`;
    stops.push({ handoff: edge.id, short: `step ${k + 1} of ${total}`, says: `Step ${k + 1} of ${total}: ${edge.from === edge.to ? `${nameOf(edge.from)} to itself` : `${nameOf(edge.from)} to ${nameOf(edge.to)}`}${when}${loop ? ` · back into ${loop.name || loop.id}: another round, until ${loop.stops.map(describeStop).join("; ")}` : ""}` });
  });
  const words = { title: doc.name || doc.id, sheets, links, per, link: "edge", links_: "edges", none: " · no nodes", flat: ' The picture shows the same graph, flat. <button type="button" data-flat="picture">Picture</button>' };
  if (notes?.length) {
    // A run's notes, as its replay reads them. A note lights what it is about and leaves the rest as it is: the
    // order here is the run's, not the order the arcs are numbered in.
    const replay = replaySteps(notes, doc);
    const drawn = new Set(sheets.map((s) => s.mark));
    const lit = (focus: (typeof replay.steps)[number]["focus"]): Partial<Scene["stops"][number]> =>
      focus?.kind === "edge" ? { handoff: focus.id } : focus?.kind === "node" ? { ends: [focus.id] } : focus?.kind === "loop" ? (drawn.has(`data-loop="${esc(focus.id)}"`) ? { sheet: `data-loop="${esc(focus.id)}"` } : { ends: doc.loops.find((l) => l.id === focus.id)?.members ?? [] }) : {};
    return {
      ...words,
      stops: replay.steps.map((step, k) =>
        k === 0 ? { short: "before the run", says: `Before the run: ${notes.length} note${notes.length === 1 ? "" : "s"} to follow. Move the slider or press Play.` } : { short: `note ${k} of ${notes.length}`, says: `Note ${k} of ${notes.length}: ${step.caption}`, alone: true, ...lit(step.focus) },
      ),
      step: "note",
      range: "Note, in the order the run wrote them",
      note: `The run's own notes, in the order it wrote them. ${replay.end.line}`,
    };
  }
  return {
    ...words,
    stops,
    range: "Step, in the order a first pass takes them",
    note: "The edges a first pass takes, in order, and then one turn of each loop. An order, not a clock: a graph records no times.",
  };
}

/**
 * The switch, over the canvas, and the view it chooses. `of` is what the canvas was given: a tap on a card does what
 * a tap on its node does there.
 */
export function Views({ doc, of }: { doc: Graph; of: { onNodeTap?: (id: Id) => void; notes?: readonly RunNote[] } }) {
  // What the switch shows, what the row of kinds shows, and what is drawn. The first two follow a press at once; the
  // third waits until the piece that draws it has come, and until then the page is as it was.
  const [view, setView] = useState<"picture" | "space">("picture");
  const [kind, setKind] = useState<Kind>(kept);
  const [on, setOn] = useState<On>("picture");
  // `undefined` until a piece has come, `null` when it could not be fetched.
  const [three, setThree] = useState<Space | null | undefined>(space);
  const [more, setMore] = useState<Stage3 | null | undefined>(stage3);
  const [per, setPer] = useState(3);
  const host = useRef<HTMLDivElement>(null);
  const held = useRef<ReturnType<Space["held"]>>(undefined);
  if (!styled) {
    const sheet = document.createElement("style");
    sheet.textContent = css;
    document.head.append(sheet);
    styled = true;
  }
  // The nodes on the canvas, or their cards when a view in three dimensions is up: what is seen to go from the one
  // view to the other. Only those wholly in the frame that holds them, the stage and in it the canvas or the view's
  // own: the browser draws a moving part over everything that is not moving, uncut, so a node the canvas cuts off (on
  // a phone, one that would be under a template's details) would be seen to cross what it was behind. And only the
  // graph's nodes: a subgrooph's frame is drawn on the canvas as one more, larger than the stage as often as not.
  // Measured, not asked of the page: while the browser waits for a change, every point of the page is the page's root.
  const parts = (): [HTMLElement, string][] => {
    const stage = host.current?.parentElement;
    if (!stage) return [];
    const cards = [...stage.querySelectorAll<HTMLElement>(".space-card, .s3-card")].map((card): [HTMLElement, string] => [card, card.dataset["node"] ?? card.querySelector<SVGGElement>("[data-node]")?.dataset["node"] ?? ""]);
    const [a, b] = [stage, stage.querySelector(cards.length ? ".space-scene, .s3-frame" : ".react-flow") ?? stage].map((el) => el.getBoundingClientRect()) as [DOMRect, DOMRect];
    return (cards.length ? cards : [...stage.querySelectorAll<HTMLElement>(".react-flow__node[data-id]")].map((node): [HTMLElement, string] => [node, node.dataset["id"]!])).filter(([el, id]) => {
      const box = el.getBoundingClientRect();
      return doc.nodes.some((n) => n.id === id) && box.left > Math.max(a.left, b.left) - 1 && box.right < Math.min(a.right, b.right) + 1 && box.top > Math.max(a.top, b.top) - 1 && box.bottom < Math.min(a.bottom, b.bottom) + 1;
    });
  };
  // What was last asked for, which the page may not have yet; what it has; and which pieces are on their way.
  const asked = useRef<On>("picture");
  const shown = useRef<On>(on);
  const fetching = useRef<{ space?: boolean; stage?: boolean }>({});
  // What to call once the page has a change that was asked for. Each change is numbered and made with `again` set to
  // its number, so that a commit follows it even when it changes nothing, and the layout effect below, which runs
  // after the scene's own, calls those the commit has reached: the browser holds the page still until it is told, for
  // seconds if it never is, and takes its picture of the page as it is when it is told.
  const moved = useRef<[number, () => void][]>([]);
  const count = useRef(0);
  const [reached, again] = useState(0);
  // `idle` is asked when the browser comes for the change, a frame after it was told of it: whether another press
  // came between and nothing is left to change. No move is made of the page going to itself.
  const go = (change: () => void, idle: () => boolean): void => {
    // A view that has gone has nothing to move, now or by then.
    if (!host.current) return change();
    become(parts, (done, skip) => {
      if (!host.current) return done();
      if (idle()) skip();
      moved.current.push([++count.current, done]);
      change();
      again(count.current);
    });
  };
  // Another press may have come by the time a change is made: what the page is given is what was asked for last.
  // The switch and the row say it at once; it is drawn only if its piece has come, and until then the page keeps
  // what it has (the piece's arrival draws it).
  const show = (): void => {
    const now = asked.current;
    if (now === "picture" || (pieceOf(now) === "space" ? space : stage3)) setOn(now);
    setView(now === "picture" ? "picture" : "space");
    if (now !== "picture") setKind(now);
  };
  const choose = (next: On): void => {
    if (next === asked.current) return;
    asked.current = next;
    if (next !== "picture") keep(next);
    // A new choice puts away the note that an earlier one could not be fetched; asking again is a new try.
    if (three === null) setThree(undefined);
    if (more === null) setMore(undefined);
    const slot = next === "picture" ? undefined : pieceOf(next);
    if (slot && !(slot === "space" ? three : more)) {
      // The first press of a kind fetches its piece, once, and nothing moves until it has come; nor then, if
      // something else was asked for meanwhile. The switch and the row follow the press at once.
      setView("space");
      setKind(next as Kind);
      if (fetching.current[slot]) return;
      fetching.current[slot] = true;
      const mine = (): boolean => asked.current !== "picture" && pieceOf(asked.current) === slot;
      (slot === "space" ? piece("space", () => import("../map/space.js")).then((m) => () => setThree((space = m))) : piece("graph-stage", () => import("./graph-stage.js")).then((m) => () => setMore((stage3 = m)))).then(
        (come) => {
          const arrive = (): void => (come(), mine() ? show() : undefined);
          if (mine()) go(arrive, () => !mine());
          else arrive();
        },
        () => {
          fetching.current[slot] = false;
          (slot === "space" ? setThree : setMore)(null);
          // The kind that could not be had is not the one 3D opens next: the one that is drawn is, or the stairs.
          if (kept() !== "stairs" && pieceOf(kept()) === slot) keep(shown.current === "picture" ? "stairs" : shown.current);
          // Back to what is drawn, if this is still what was being waited for.
          if (!mine()) return;
          asked.current = shown.current;
          setKind(kept());
          show();
        },
      );
    } else if (next !== "picture" || shown.current !== "picture")
      go(show, () => asked.current === shown.current);
    // The picture, asked for while a view was still on its way: the page is the picture already.
    else show();
  };
  const made = useMemo(() => (on === "stairs" && three ? three.scene(mapKit, graphScene(doc, per, three.CARD, of.notes)) : undefined), [doc, on, three, per, of.notes]);
  // One of the other kinds, drawn by the stage.
  const staged = on !== "picture" && on !== "stairs" && more ? on : undefined;
  // The scene is markup; once it is on the page it is given its styles, its starting view, its behavior, and its
  // cards and arcs their names. Before the browser paints, as a map's is: the first press of a visit is drawn by a
  // fetch that has arrived and not by the press, and React then gives the browser its chance to paint before it
  // does what was put off. A phone takes it: raw text and arcs drawn black across the canvas, for a frame or more.
  useLayoutEffect(() => {
    const root = host.current?.querySelector<HTMLElement>(".space");
    if (!root || !three || !made) return;
    const name = (id: Id): string => doc.nodes.find((n) => n.id === id)?.name || id;
    for (const el of root.querySelectorAll<SVGGElement>("[data-node]")) {
      const node = doc.nodes.find((n) => n.id === el.dataset["node"]);
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${node?.kind === "agent" ? "Agent" : (KIND[node?.kind as "stop"]?.[0] ?? "Node")} ${name(el.dataset["node"]!)}`);
    }
    for (const el of root.querySelectorAll<SVGGElement>("[data-edge]")) {
      const at = made.arcs.find((arc) => arc.id === el.dataset["edge"]);
      el.setAttribute("role", "img");
      if (at) el.setAttribute("aria-label", `Step ${at.n}: ${name(at.from)} to ${name(at.to)}`);
    }
    return three.attach(root, made, (held.current ??= three.held()), () => choose("picture"));
  }, [made]);
  const told = (upTo: number): void => void (moved.current = moved.current.filter(([n, done]) => n > upTo || (done(), false)));
  useLayoutEffect(() => {
    shown.current = on;
    told(reached);
  });
  // A view that goes while a change is on its way must not leave the browser waiting for it.
  useEffect(() => () => told(Infinity), []);
  // Three cards in a row at a phone's width, and more where there is room, as a map's sheets have.
  useEffect(() => {
    const stage = host.current?.parentElement;
    if (!stage || typeof ResizeObserver !== "function") return;
    const sized = new ResizeObserver(() => setPer(stage.clientWidth < 640 ? 3 : stage.clientWidth < 900 ? 4 : 6));
    sized.observe(stage);
    return () => sized.disconnect();
  }, []);
  const tap = (target: EventTarget | null): boolean => {
    const node = target instanceof Element ? target.closest<SVGGElement>("[data-node]") : null;
    if (node) of.onNodeTap?.(node.dataset["node"]!);
    return !!node;
  };
  const up = !!made || !!staged;
  return (
    // `is-space` when a view in three dimensions is on the page, not when it is asked for: until then the canvas is
    // whole.
    <div ref={host} className={`graph-views${up ? " is-space" : ""}`}>
      <div className="segmented graph-switch" role="radiogroup" aria-label="View of the graph">
        {(["picture", "space"] as const).map((name) => (
          <button key={name} type="button" role="radio" aria-checked={view === name} className={view === name ? "seg seg-on" : "seg"} onClick={() => choose(name === "picture" ? "picture" : kind)}>
            {name === "picture" ? "Picture" : "3D"}
          </button>
        ))}
      </div>
      {up ? (
        <div className="segmented graph-kinds" role="radiogroup" aria-label="Kind of view in three dimensions">
          {KINDS.map(([id, name, says]) => (
            <button key={id} type="button" role="radio" aria-checked={kind === id} aria-description={says} title={says} className={kind === id ? "seg seg-on" : "seg"} onClick={() => choose(id)}>
              {name}
            </button>
          ))}
        </div>
      ) : null}
      {three === null || more === null ? (
        <p className="graph-views-note" role="status">
          {more === null && three !== null ? (on === "picture" ? "That view in three dimensions could not be fetched. The picture shows the same graph, and so do the stairs." : "That view could not be fetched. This one shows the same graph.") : "The view in three dimensions could not be fetched. The picture shows the same graph."}
        </p>
      ) : null}
      {made ? (
        // `data-keep`: the room the switch, the row of kinds, the bar, the slider and a viewer's own bar at the foot
        // take, so that the scene is as tall as what is left and the slider's words are read without scrolling where
        // that can be. A run's page has no bar at its foot, and its scene has that room too.
        <div className="graph-space map-stage" data-keep={of.notes ? 326 : 346}>
          <div
            className="map-picture"
            onClick={(e) => void tap(e.target)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && tap(e.target)) e.preventDefault();
            }}
            dangerouslySetInnerHTML={{ __html: made.html }}
          />
        </div>
      ) : staged && more ? (
        <div className="graph-space">
          <more.Stage3 key={staged} doc={doc} kind={staged} of={of} />
        </div>
      ) : null}
    </div>
  );
}
