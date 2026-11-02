/**
 * A loop graph's other views: the switch a map has, on every canvas, and the graph in three
 * dimensions. It is a piece of the app fetched once a canvas is up, and the
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
 * replay says it (`replaySteps` in core). That order is the run's, and it happened. The scene is core's
 * (`picture/stage/graph-scene.ts`), behind a door of its own.
 *
 * **The picture becomes the scene.** Chosen, 3D is not put in the picture's place: each node is seen to go to its
 * card, tilting as it goes, while the canvas's edges fade and the sheets and arcs come; and back the same way
 * (`ui/become.ts`). The scene it ends on is the scene as it was before there was any motion, and with reduced
 * motion, or in a browser with no view transitions, the change is that scene in one paint.
 *
 * **The kinds of 3D.** The stairs are one way of seeing a graph in three dimensions; the others the author picked
 * from the studio are a piece of their own (`graph-stage.tsx`), fetched when one is chosen. While a
 * view in three dimensions is up, a row under the switch says which kind it is and offers the others; the switch
 * itself stays Picture and 3D, and 3D opens the kind last chosen in the visit, the stairs the first time. From one
 * kind to another each card is seen to go to its place in the next, as from the picture.
 *
 * **Sketch**, left of Picture where the graph can be changed (the editor's canvas, not a run's): the graph drawn by
 * hand, and the drawing made the graph (`../sketch/SketchView.tsx`, a piece of its own, fetched when it is first
 * chosen). It lies over the canvas as a view in three dimensions does, folds a phone's sheet the same way, and puts
 * away the canvas's own bar while it is up.
 */
import { mapKit, type Graph, type Id, type RunNote } from "@grooph/core";
import { graphScene, KIND, KINDS_3D as KINDS } from "@grooph/core/graph-scene";
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { piece } from "../../piece.js";
import { become } from "../become.js";
import css from "./graph-views.css?inline";

type Space = typeof import("../map/space.js");
type Stage3 = typeof import("./graph-stage.js");
type More = typeof import("./graph-more.js");
type Sketch = typeof import("../sketch/SketchView.js");
let sketchPiece: Sketch | undefined;
let space: Space | undefined;
let stage3: Stage3 | undefined;
let more3: More | undefined;
let styled = false;

/** What the editor hands the drawing: the graph's key, whether it opened on the drawing, and how it changes the graph. */
export type SketchOf = Omit<import("../sketch/studio.js").StudioHost, "open"> & { start: boolean };

/** The kinds of view in three dimensions, in the order the row has them (core's `KINDS_3D`, which a still shares). */
type Kind = (typeof KINDS)[number][0];
/** What is drawn over the canvas: nothing, which is the picture, or a kind of view in three dimensions. */
type On = "picture" | Kind;
/** The piece a kind is in: the map's scene for the stairs, the stage for the rest; and Rings and Columns want a
 *  piece of their own beside the stage, which holds the kinds the stage's piece has no room for. */
const pieceOf = (kind: Kind): "space" | "stage" | "more" => (kind === "stairs" ? "space" : kind === "rings" || kind === "columns" ? "more" : "stage");
/** Whether what a kind is drawn with has been fetched. */
const here = (kind: Kind): boolean => !!(kind === "stairs" ? space : stage3 && (pieceOf(kind) === "stage" || more3));

// The kind last drawn, for the visit: the tab's own storage, and memory where a browser refuses that.
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

/**
 * Round a view that a browser may not be able to draw (no drawing surface): what fails in it is told to what holds
 * it, which falls back to what it showed before, and the rest of the page is left as it is. Without it an error in a
 * view takes the whole app off the page.
 */
class Guard extends Component<{ lost: () => void; children: ReactNode }, { lost: boolean }> {
  override state = { lost: false };
  static getDerivedStateFromError(): { lost: boolean } {
    return { lost: true };
  }
  override componentDidCatch(): void {
    this.props.lost();
  }
  override render(): ReactNode {
    return this.state.lost ? null : this.props.children;
  }
}

/**
 * The switch, over the canvas, and the view it chooses. `of` is what the canvas was given: a tap on a card does what
 * a tap on its node does there, and in the editor a card carried in Panes or Columns moves its node.
 */
export function Views({ doc, of }: { doc: Graph; of: { onNodeTap?: (id: Id) => void; onNodeMove?: (id: Id, at: { x: number; y: number }) => void; notes?: readonly RunNote[]; sketch?: SketchOf } }) {
  // What the switch shows, what the row of kinds shows, and what is drawn. The first two follow a press at once; the
  // third waits until the piece that draws it has come, and until then the page is as it was.
  const [view, setView] = useState<"picture" | "space">("picture");
  const [kind, setKind] = useState<Kind>(kept);
  const [on, setOn] = useState<On>("picture");
  // The two pieces, `undefined` until each has come.
  const [three, setThree] = useState<Space | undefined>(space);
  const [more, setMore] = useState<Stage3 | undefined>(stage3);
  const [rest, setRest] = useState<More | undefined>(more3);
  // The drawing: whether it is what the switch shows, and its piece once it has come. A graph opened to be drawn
  // (`#/g/<key>?sketch`) opens on it.
  const [sketching, setSketching] = useState(!!of.sketch?.start);
  const [drawn, setDrawn] = useState<Sketch | undefined>(sketchPiece);
  // What is said when a piece could not be fetched, until the next press; and which piece was last asked for in vain.
  const [note, setNote] = useState<string>();
  const failed = useRef<{ space?: boolean; stage?: boolean; more?: boolean }>({});
  const [per, setPer] = useState(3);
  // How wide the window was when the canvas under this last laid the document out, which it does when it is handed
  // one (`Canvas.tsx`, `ViewCanvas.tsx`): a view that keeps the picture's places wraps its rows where the canvas
  // did, though the window has been turned since.
  const wide = useRef({ doc, at: innerWidth });
  if (wide.current.doc !== doc) wide.current = { doc, at: innerWidth };
  const host = useRef<HTMLDivElement>(null);
  const held = useRef<ReturnType<Space["held"]>>(undefined);
  // Full screen: the view and its controls over the whole window, the words under it put away. Where the browser
  // has full screen for a page (not an iPhone's) it is asked for too. With nothing touched for a moment the controls
  // fade, and the next touch, move or key brings them back.
  const [focus, setFocus] = useState(false);
  const [idle, setIdle] = useState(false);
  const full = (want: boolean): void => {
    setFocus(want);
    setIdle(false);
    const el = host.current;
    if (want && el && document.fullscreenEnabled && !document.fullscreenElement) el.requestFullscreen?.().catch(() => undefined);
    else if (!want && document.fullscreenElement === el) document.exitFullscreen?.().catch(() => undefined);
  };
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
  const fetching = useRef<{ space?: boolean; stage?: boolean; more?: boolean }>({});
  // What to call once the page has a change that was asked for. Each change is numbered and made with `again` set to
  // its number, so that a commit follows it even when it changes nothing, and the layout effect below, which runs
  // after the scene's own, calls those the commit has reached: the browser holds the page still until it is told, for
  // seconds if it never is, and takes its picture of the page as it is when it is told.
  const moved = useRef<[number, () => void][]>([]);
  // The last of the picture and the stairs to be up: where a view that cannot be drawn falls back to.
  const safe = useRef<On>("picture");
  // The sheet is down to its head while a view in three dimensions is what is asked for or up, so the view has the room.
  const fold = (kind?: On): void => void host.current?.closest(".editor")?.toggleAttribute("data-space-folds", !!kind && kind !== "picture");
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
    if (now === "picture") setOn(now);
    // What the visit remembers is the kind last drawn: not one that was asked for and has not come, and not one
    // that came and could not be drawn (the stage says when it has drawn, below).
    else if (here(now)) (setOn(now), pieceOf(now) === "space" ? keep(now) : undefined);
    setView(now === "picture" ? "picture" : "space");
    if (now !== "picture") setKind(now);
  };
  const choose = (next: On): void => {
    // A press puts away the note that an earlier choice could not be fetched; asking for it again is a new try.
    setNote(undefined);
    // On a phone a panel's sheet goes down to its head when one of the stage's kinds is chosen, and comes back with
    // the picture. Not for the stairs: they are as they were, and what is seen to go into them is what was in
    // sight over the sheet (#101's test of that is unchanged).
    fold(next);
    if (next === asked.current) return;
    asked.current = next;
    const slot = next === "picture" ? undefined : pieceOf(next);
    if (slot && !(slot === "space" ? three : slot === "more" ? more && rest : more)) {
      // The first press of a kind fetches its piece, once, and nothing moves until it has come; nor then, if
      // something else was asked for meanwhile. The switch and the row follow the press at once.
      setView("space");
      setKind(next as Kind);
      if (fetching.current[slot]) return;
      fetching.current[slot] = true;
      const mine = (): boolean => asked.current !== "picture" && pieceOf(asked.current) === slot;
      // (A kind of the second piece is drawn on the stage: both are asked for, and it comes when both have.)
      const stage = (): Promise<Stage3> => piece("graph-stage", () => import("./graph-stage.js"));
      (slot === "space"
        ? piece("space", () => import("../map/space.js")).then((m) => () => setThree((space = m)))
        : slot === "stage"
          ? stage().then((m) => () => setMore((stage3 = m)))
          : Promise.all([stage(), piece("graph-more", () => import("./graph-more.js"))]).then(([m, c]) => () => (setMore((stage3 = m)), setRest((more3 = c))))
      ).then(
        (come) => {
          failed.current[slot] = false;
          const arrive = (): void => (come(), mine() ? show() : undefined);
          if (mine()) go(arrive, () => !mine());
          else arrive();
        },
        () => {
          fetching.current[slot] = false;
          failed.current[slot] = true;
          // Back to what is drawn, if this is still what was being waited for.
          const waited = mine();
          if (waited) fold((asked.current = shown.current));
          if (asked.current === "picture") {
            // From the picture, the kind that could not be had is not the one 3D opens next on this page: a kind of
            // the other piece is, whether the reader waited for this one or had gone back to the picture.
            setKind(slot === "space" ? "panes" : "stairs");
            setNote(slot !== "space" && !failed.current.space ? "That view in three dimensions could not be fetched. The picture shows the same graph, and so do the stairs." : "The view in three dimensions could not be fetched. The picture shows the same graph.");
          } else setNote("That view could not be fetched. This one shows the same graph.");
          if (waited) show();
        },
      );
    } else if (next !== "picture" || shown.current !== "picture")
      go(show, () => asked.current === shown.current);
    // The picture, asked for while a view was still on its way: the page is the picture already.
    else show();
  };
  const made = useMemo(() => (on === "stairs" && three ? three.scene(mapKit, graphScene(doc, per, three.CARD, of.notes)) : undefined), [doc, on, three, per, of.notes]);
  // One of the other kinds, drawn by the stage.
  const staged = on !== "picture" && on !== "stairs" && more && (pieceOf(on) === "stage" || rest) ? on : undefined;
  // The kinds of the second piece, made once with the stage's shapes.
  const kinds = useMemo(() => (more && rest ? rest.MORE(more.tools) : {}), [more, rest]);
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
      el.setAttribute("aria-label", `${node?.kind === "agent" ? (node.by === "person" ? "Person" : "Agent") : (KIND[node?.kind as "stop"]?.[0] ?? "Node")} ${name(el.dataset["node"]!)}`);
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
    if (on === "picture" || on === "stairs") safe.current = on;
    told(reached);
  });
  // A press on the sheet's head, or on the bar over the canvas, brings the sheet up again; and so does any press
  // after which the sheet is another panel's (one that asks for a panel, wherever it is: Fit and Undo ask for
  // none, and leave it down). And the mark goes with this.
  useEffect(() => {
    const editor = host.current?.closest(".editor");
    const title = (): string | null | undefined => editor?.querySelector(".sheet:not(.sheet-rail)")?.getAttribute("aria-label");
    const up = (e: Event): void => {
      const was = title();
      if (e.target instanceof Element && e.target.closest(".topbar,.sheet-head")) fold();
      else requestAnimationFrame(() => title() !== was && fold());
    };
    editor?.addEventListener("click", up, true);
    return () => (editor?.removeEventListener("click", up, true), editor?.removeAttribute("data-space-folds"));
  }, []);
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
  // A card that is pressed opens its node's sheet: the sheet comes up for it.
  const open = (id: Id): void => (fold(), of.onNodeTap?.(id));
  // The drawing, chosen or put away. Chosen, it takes the canvas's place at once, out of three dimensions if one was
  // up, and the address says so, so the page opens on it again; a phone's sheet goes down to its head, as for 3D.
  const draw = (want: boolean): void => {
    setNote(undefined);
    if (want && asked.current !== "picture") {
      asked.current = "picture";
      setOn("picture");
      setView("picture");
    }
    setSketching(want);
    if (!want) fold(asked.current);
  };
  useEffect(() => {
    if (!of.sketch) return;
    if (sketching) host.current?.closest(".editor")?.toggleAttribute("data-space-folds", true);
    const at = /^(#\/g\/[^/?]+)(\?new|\?sketch)?$/.exec(location.hash);
    const want = at ? (sketching ? `${at[1]}?sketch` : at[2] === "?sketch" ? at[1]! : location.hash) : location.hash;
    if (want !== location.hash) history.replaceState(history.state, "", want);
    if (!sketching || drawn) return;
    piece("SketchView", () => import("../sketch/SketchView.js")).then(
      (m) => setDrawn((sketchPiece = m)),
      () => {
        setSketching(false);
        fold();
        setNote("The drawing could not be fetched. It needs a connection the first time. The picture shows the same graph.");
      },
    );
  }, [sketching]);
  const tap = (target: EventTarget | null): boolean => {
    const node = target instanceof Element ? target.closest<SVGGElement>("[data-node]") : null;
    if (node) open(node.dataset["node"]!);
    return !!node;
  };
  // A view the browser could not draw: back to what was up before it, with a word of why. It is not what the visit
  // remembers, since it never drew.
  const lost = (): void => {
    const back = safe.current;
    fold((asked.current = back));
    setOn(back);
    setView(back === "picture" ? "picture" : "space");
    setKind("stairs");
    setNote(back === "picture" ? "That view cannot be drawn in this browser. The picture shows the same graph." : "That view cannot be drawn in this browser. This one shows the same graph.");
  };
  const up = !!made || !!staged;
  // Out of full screen when the browser leaves it (a back gesture, Escape), when Escape is pressed where the browser
  // had none, and when the view is no longer one in three dimensions.
  useEffect(() => {
    if (!focus) return;
    if (!up) return full(false);
    let timer = setTimeout(() => setIdle(true), 2600);
    const stir = (): void => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2600);
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !document.fullscreenElement) full(false);
      else stir();
    };
    const left = (): void => {
      if (!document.fullscreenElement) setFocus(false);
    };
    addEventListener("pointermove", stir);
    addEventListener("pointerdown", stir);
    addEventListener("keydown", key);
    document.addEventListener("fullscreenchange", left);
    return () => {
      clearTimeout(timer);
      removeEventListener("pointermove", stir);
      removeEventListener("pointerdown", stir);
      removeEventListener("keydown", key);
      document.removeEventListener("fullscreenchange", left);
    };
  }, [focus, up]);
  return (
    // `is-space` when a view in three dimensions is on the page, not when it is asked for: until then the canvas is
    // whole.
    <div ref={host} className={`graph-views${up ? " is-space" : ""}${up && focus ? " is-focus" : ""}${up && focus && idle ? " is-idle" : ""}${sketching ? " is-sketch" : ""}`}>
      {up ? (
        <button type="button" className="graph-full" aria-pressed={focus} onClick={() => full(!focus)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d={focus ? "M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" : "M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5"} />
          </svg>
          {focus ? "Exit" : "Full screen"}
        </button>
      ) : null}
      <div className="segmented graph-switch" role="radiogroup" aria-label="View of the graph">
        {(of.sketch ? (["sketch", "picture", "space"] as const) : (["picture", "space"] as const)).map((name) => {
          const chosen = name === "sketch" ? sketching : !sketching && view === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={chosen}
              className={chosen ? "seg seg-on" : "seg"}
              onClick={() => (name === "sketch" ? draw(true) : (draw(false), choose(name === "picture" ? "picture" : kind)))}
            >
              {name === "sketch" ? "Sketch" : name === "picture" ? "Picture" : "3D"}
            </button>
          );
        })}
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
      {note ? (
        <p className="graph-views-note" role="status">
          {note}
        </p>
      ) : null}
      {sketching && drawn && of.sketch ? <drawn.SketchView doc={doc} host={{ ...of.sketch, open }} /> : null}
      {made ? (
        // `data-keep`: the room the switch, the row of kinds, the bar, the slider and a viewer's own bar at the foot
        // take, so that the scene is as tall as what is left and the slider's words are read without scrolling where
        // that can be. A run's page has no bar at its foot, and its scene has that room too.
        <div className="graph-space map-stage" data-keep={focus ? 250 : of.notes ? 326 : 346}>
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
          <Guard key={staged} lost={lost}>
            <more.Stage3 doc={doc} kind={staged} {...(kinds[staged] ? { its: kinds[staged] } : {})} wide={wide.current.at} of={{ ...of, onNodeTap: open }} drawn={() => keep(staged)} />
          </Guard>
        </div>
      ) : null}
    </div>
  );
}
