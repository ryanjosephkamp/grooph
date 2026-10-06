/**
 * A graph's other views in three dimensions (handoff 0096): the ones the owner picked from the studio
 * (`handoffs/briefs/studio-3d/`), beside the stairs the app had. One piece of the app, fetched when one of them is
 * chosen (decision 0021; `graph-views.tsx` asks for it, through `piece()`), and named by the page so the service
 * worker holds it. The stairs are not in it: they are the map's scene, a piece of its own.
 *
 * A view is a placing of the graph in space (`stage/panes.ts` and its fellows) on one stage (`stage/draw.ts`), which
 * draws on a 2D canvas and puts the graph's cards over it as real elements. What a view draws is worked out once, for
 * all of them (`stage/model.ts`). The slider under a view walks the edges of a first pass and then one turn of each
 * loop; on a run's page it walks the run's own notes, as the stairs' does.
 */
import { DEFAULT_LAYOUT_BOX, resolvePositions, type Graph, type Id, type RunNote } from "@grooph/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import css from "./graph-stage.css?inline";
import { makeStage, type Look, type Prim, type Stage } from "./stage/draw.js";
import { columnsAt, modelOf, stepsOf, under, type Model } from "./stage/model.js";
import { panes } from "./stage/panes.js";
import { along, arch, by, card, circle, edgeLine, ground, hue, shownAt, stations, TAU, type Shown, type View } from "./stage/shapes.js";
import { brakes, spiral, topOf } from "./stage/spiral.js";

/**
 * A kind: how it places the graph, where it is first seen from, what it is in a sentence, by how many pixels its frame
 * is made tall enough to keep its cards apart, whether each loop's brakes are said under it, and what else it says
 * under itself. Rings and Columns are kinds of a piece of their own (`graph-more.tsx`), handed in when one is chosen.
 */
export type Kind = { view: View; start: Look; as: string; says: string; apart?: number; brakes?: boolean; under?: (model: Model, shown: Shown) => ReactNode };
/** The stage's own shapes and readings, for a kind that is not in this piece to be drawn with: handed to it, since
 *  a thing both pieces imported would be a third file for a browser to fetch. */
export const tools = { arch, by, card, circle, edgeLine, ground, hue, stations, TAU, under };
export type Tools = typeof tools;
const KINDS: Record<string, Kind> = {
  panes: { view: panes, start: { yaw: -0.86, pitch: 0.16 }, as: "panes", apart: 2, says: "Every node is where the picture has it, one pane toward you for each loop or subgrooph around it; loops that only share a node are panes at one depth. An edge that changes depth is entering or leaving a loop or a subgrooph." },
  spiral: { view: spiral, start: { yaw: -0.42, pitch: 0.3 }, as: "a spiral for each loop", apart: 7, says: "A round of a loop is one turn upward, and a brake that counts rounds is a place on the way up. A loop inside another is a spiral of its own, where its rounds start afresh; a node two loops share stands on one of them.", brakes: true },
};

let styled = false;
const still = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `wide` is how wide the window was when the canvas under this was drawn: its rows wrap as the canvas's do. */
/** `drawn` is told once the view has been drawn for the first time: a browser that cannot draw it throws before. */
/** `its` is the kind itself, for one that is not in this piece. */
export function Stage3({ doc, kind, its, wide, of, drawn }: { doc: Graph; kind: string; its?: Kind; wide: number; of: { onNodeTap?: (id: Id) => void; notes?: readonly RunNote[] }; drawn?: () => void }) {
  if (!styled) {
    const sheet = document.createElement("style");
    sheet.textContent = css;
    document.head.append(sheet);
    styled = true;
  }
  const the = its ?? KINDS[kind]!;
  // Where the canvas has each node: the document's layout where it has one, and the canvas's own for this screen.
  // Whether the frame is a phone's width: the frame's own, since a window with the details beside the view is wide
  // and its frame is not. Read once it is on the page, before anything is painted, and again when its width
  // changes (a panel opened beside it).
  const [slim, setSlim] = useState(wide < 640);
  const model = useMemo(() => modelOf(doc, resolvePositions(doc, columnsAt(wide), DEFAULT_LAYOUT_BOX).positions, of.notes, slim), [doc, wide, of.notes, slim]);
  // Every loop and box a node is in, the nearest first: what its card is said to be in.
  const within = (id: Id): string =>
    [...model.loops.filter((l) => l.members.includes(id)).sort((a, b) => a.members.length - b.members.length).map((l) => `in the loop ${l.name}`), ...model.groups.filter((g) => g.nodes.includes(id)).sort((a, b) => a.nodes.length - b.nodes.length).map((g) => `in the ${g.from ? "subgrooph" : "group"} ${g.name}`)].join(", ");
  const steps = useMemo(() => stepsOf(model), [model]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const k = Math.min(at, steps.length - 1);
  const step = steps[k]!;
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>(undefined);
  const glide = useRef(0);
  const once = useRef(false);
  const was = useRef(0);

  useLayoutEffect(() => {
    const see = (): void => setSlim(frame.current!.clientWidth < 640);
    see();
    const sized = new ResizeObserver(see);
    sized.observe(frame.current!);
    return () => sized.disconnect();
  }, []);
  useLayoutEffect(() => {
    const made = (stage.current = makeStage(frame.current!, canvas.current!, cards.current!, the.start, the.apart));
    // What a view grows (a spiral, its lid) is not there when the view comes: the cards land first, and then it is
    // grown. For a reader who asked for less motion it is all drawn at once.
    let frames = 0;
    let wait: ReturnType<typeof setTimeout> | undefined;
    if (!still()) {
      made.grown = 0;
      wait = setTimeout(() => {
        const from = performance.now();
        const grow = (now: number): void => {
          made.grown = Math.min(1, (now - from) / 700);
          made.draw();
          if (made.grown < 1) frames = requestAnimationFrame(grow);
        };
        frames = requestAnimationFrame(grow);
      }, 330);
    }
    return () => (clearTimeout(wait), cancelAnimationFrame(frames), cancelAnimationFrame(glide.current), made.off());
  }, [kind]);
  // What the slider is at, drawn. Now, and not at the next frame: when the picture becomes this view the browser is
  // told the page has changed as soon as this is done, and takes the cards from where they are then.
  useLayoutEffect(() => {
    const on = stage.current!;
    const shown = shownAt(model, steps, k);
    const built = the.view(model, shown);
    on.lit = shown.lit;
    cancelAnimationFrame(glide.current);
    // Where a step is, is its card, lit. What got there is seen to travel to it along the edge it took, over the
    // cards, when the slider has gone on by one: not when it was dragged or went back, and not for a reader who
    // asked for less motion. Once there it is the lit card, and the ring is put away.
    const route = step.edge && !step.about ? built.path(step.edge, step.r0, step.r1) : null;
    if (route && route.length > 1 && k === was.current + 1 && !still()) {
      const token: Extract<Prim, { t: "dot" }> = { t: "dot", at: route[0]!, r: 9.5, over: true };
      on.set([...built.prims, token]);
      const from = performance.now();
      const go = (now: number): void => {
        const t = Math.min(1, (now - from) / 620);
        token.at = along(route, 1 - (1 - t) ** 3);
        token.hide = t === 1;
        on.draw();
        if (t < 1) glide.current = requestAnimationFrame(go);
      };
      glide.current = requestAnimationFrame(go);
    } else on.set(built.prims);
    was.current = k;
    on.draw();
    if (!once.current) ((once.current = true), drawn?.());
  }, [model, kind, k]);
  useEffect(() => {
    if (!playing) return;
    if (k >= steps.length - 1) return setPlaying(false);
    const timer = setTimeout(() => setAt(k + 1), k === 0 ? 150 : 1150);
    return () => clearTimeout(timer);
  }, [playing, k, steps.length]);
  const to = (next: number): void => (setPlaying(false), setAt(Math.max(0, Math.min(steps.length - 1, next))));
  const unit = model.run ? "note" : "step";
  return (
    <div className="s3" data-picture="space" data-kind={kind}>
      <div className="s3-bar">
        <span>Drag to turn. Pinch to move in and out.</span>
        {/* Shown in its place where the frame is as tall as it may be and cards still touch (`stage/draw.ts`). */}
        <span className="s3-tight">Not every card has room here. Move in to read them, or close the details if they are open under this view.</span>
        <button type="button" aria-label="Move out" onClick={() => stage.current?.zoom(0.8)}>
          −
        </button>
        <button type="button" aria-label="Move in" onClick={() => stage.current?.zoom(1.25)}>
          +
        </button>
        <button type="button" onClick={() => stage.current?.reset()}>
          Starting view
        </button>
      </div>
      <div ref={frame} className="s3-frame" tabIndex={0} role="group" aria-label={`${model.name} as ${the.as}: ${model.nodes.length} card${model.nodes.length === 1 ? "" : "s"}, ${model.edges.length} edge${model.edges.length === 1 ? "" : "s"}${model.loops.length ? `, and ${model.loops.length === 1 ? "the loop" : "the loops"} ${model.loops.map((l) => l.name).join(", ")}` : ""}. Drag to turn it; the arrow keys turn it too, and plus and minus move in and out.`}>
        <canvas ref={canvas} aria-hidden="true" />
        <div ref={cards}>
          {model.nodes.map((n) => (
            // A press that ended a drag turned the view and is not a tap; a key is always a tap (it has no clicks to count).
            <button key={n.id} type="button" className="s3-card" data-node={n.id} data-kind={n.kind} aria-label={`${n.word} ${n.name}`} {...(within(n.id) ? { "aria-description": within(n.id) } : {})} onClick={(e) => (e.detail === 0 || !stage.current?.dragged()) && of.onNodeTap?.(n.id)}>
              <b>{n.name}</b>
              <span>{n.line}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="s3-steps">
        <button type="button" className={playing ? "is-on" : undefined} onClick={() => (playing ? setPlaying(false) : (k >= steps.length - 1 && setAt(0), setPlaying(true)))}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" aria-label={`Previous ${unit}`} onClick={() => to(k - 1)}>
          ‹
        </button>
        <button type="button" aria-label={`Next ${unit}`} onClick={() => to(k + 1)}>
          ›
        </button>
        <input type="range" min={0} max={steps.length - 1} step={1} value={k} aria-label={model.run ? "Note, in the order the run wrote them" : "Step, in the order a first pass takes them"} onChange={(e) => to(Number(e.target.value))} />
      </div>
      <output className="s3-says" aria-live="polite">
        {step.says}
      </output>
      {the.brakes && model.loops.length ? (
        // Each loop's brakes in words, with what stands for each in the drawing.
        <ul className="s3-key" aria-label="Each loop's brakes">
          {model.loops.map((loop, n) => (
            <li key={loop.id}>
              <b style={{ color: `var(--loop-${n % 4})` }}>{loop.name}</b> {brakes(loop, topOf(model, loop)).words.join("; ")}
            </li>
          ))}
        </ul>
      ) : null}
      {the.under?.(model, shownAt(model, steps, k))}
      <p className="s3-note">
        {the.says}
        {kind === "panes" && !model.loops.length && !model.groups.some((g) => g.from) ? " This graph has no loop and no subgrooph, so nothing is lifted." : ""}
      </p>
    </div>
  );
}
