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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import css from "./graph-stage.css?inline";
import { makeStage, type Look, type Prim, type Stage } from "./stage/draw.js";
import { modelOf, stepsOf } from "./stage/model.js";
import { panes } from "./stage/panes.js";
import { along, type Shown, type View } from "./stage/shapes.js";

/** Each kind: how it places the graph, where it is first seen from, and what it is, in a sentence. */
const KINDS: Record<string, { view: View; start: Look; as: string; says: string }> = {
  panes: { view: panes, start: { yaw: -0.86, pitch: 0.16 }, as: "panes", says: "Every node is where the picture has it, as many panes toward you as there are loops and boxes round it. An edge that changes depth is entering or leaving one." },
};

let styled = false;
const still = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Stage3({ doc, kind, of }: { doc: Graph; kind: string; of: { onNodeTap?: (id: Id) => void; notes?: readonly RunNote[] } }) {
  if (!styled) {
    const sheet = document.createElement("style");
    sheet.textContent = css;
    document.head.append(sheet);
    styled = true;
  }
  const the = KINDS[kind]!;
  // Where the canvas has each node: the document's layout where it has one, and the canvas's own for this screen,
  // two to a row on a phone held upright and four on anything wider (`doc/layout.ts`, whose rule this is; it is not
  // imported, because it is part of the canvas's screens and asking it for one more thing moves bytes onto them).
  const model = useMemo(() => modelOf(doc, resolvePositions(doc, innerWidth < 640 ? 2 : 4, DEFAULT_LAYOUT_BOX).positions, of.notes), [doc, of.notes]);
  const steps = useMemo(() => stepsOf(model), [model]);
  // The edges a run took, each with the rounds it was taken between and the step it was taken at.
  const took = useMemo(() => (model.run ? steps.flatMap((step, n) => (step.edge && !step.about ? [{ edge: step.edge, r0: step.r0 ?? 0, r1: step.r1 ?? 0, step: n }] : [])) : []), [model, steps]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const k = Math.min(at, steps.length - 1);
  const step = steps[k]!;
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>(undefined);
  const glide = useRef(0);
  const was = useRef(0);

  useLayoutEffect(() => {
    const made = (stage.current = makeStage(frame.current!, canvas.current!, cards.current!, the.start));
    return () => (cancelAnimationFrame(glide.current), made.off());
  }, [kind]);
  // What the slider is at, drawn. Now, and not at the next frame: when the picture becomes this view the browser is
  // told the page has changed as soon as this is done, and takes the cards from where they are then.
  useLayoutEffect(() => {
    const on = stage.current!;
    // What the step is about: its nodes, its edge (by its name, and by its name and the round it is taken in, for a
    // view that draws an edge once a round), its loops. A note about the run as a whole picks nothing out.
    const about = [...(step.nodes ?? []).map((id) => `node:${id}`), ...(step.edge ? [`edge:${step.edge}`, `edge:${step.edge}@${step.r0 ?? 0}`] : []), ...(step.loops ?? []).map((id) => `loop:${id}`)];
    const shown: Shown = { k, took, lit: about.length ? new Set(about) : null };
    if (step.about && step.edge) shown.about = { edge: step.edge, r0: step.r0 ?? 0 };
    // A run is drawn as far as the note it is at; step 0 is all of it.
    if (model.run && k > 0) shown.dispatches = steps.slice(1, k + 1).filter((s) => s.dispatch !== undefined).length;
    const built = the.view(model, shown);
    on.lit = shown.lit;
    cancelAnimationFrame(glide.current);
    // What is at this step travels to it along the edge it took, or is simply where the note is. A ring, so that
    // what it stands on is seen through it.
    const route = step.edge && !step.about ? built.path(step.edge, step.r0, step.r1) : step.to ? [built.node(step.to, step.r1)] : null;
    const token: Extract<Prim, { t: "dot" }> | null = route ? { t: "dot", at: route[route.length - 1]!, r: 9.5, stroke: "accent", w: 3 } : null;
    on.set(token ? [...built.prims, token] : built.prims);
    // It is seen to travel when the slider has gone on by one, and not when it was dragged or went back.
    if (token && route && route.length > 1 && k === was.current + 1 && !still()) {
      token.at = route[0]!;
      const from = performance.now();
      const go = (now: number): void => {
        const t = Math.min(1, (now - from) / 620);
        token.at = along(route, 1 - (1 - t) ** 3);
        on.draw();
        if (t < 1) glide.current = requestAnimationFrame(go);
      };
      glide.current = requestAnimationFrame(go);
    }
    was.current = k;
    on.draw();
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
      <div ref={frame} className="s3-frame" tabIndex={0} role="group" aria-label={`${model.name} as ${the.as}: ${model.nodes.length} cards, ${model.edges.length} edges${model.loops.length ? `, and ${model.loops.length === 1 ? "the loop" : "the loops"} ${model.loops.map((l) => l.name).join(", ")}` : ""}. Drag to turn it; the arrow keys turn it too, and plus and minus move in and out.`}>
        <canvas ref={canvas} aria-hidden="true" />
        <div ref={cards}>
          {model.nodes.map((n) => (
            // A press that ended a drag turned the view and is not a tap; a key is always a tap (it has no clicks to count).
            <button key={n.id} type="button" className="s3-card" data-node={n.id} data-kind={n.kind} aria-label={`${n.word} ${n.name}`} {...(n.loop ? { "aria-description": `in the loop ${model.loops.find((l) => l.id === n.loop)!.name}` } : {})} onClick={(e) => (e.detail === 0 || !stage.current?.dragged()) && of.onNodeTap?.(n.id)}>
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
      <p className="s3-note">{the.says}</p>
    </div>
  );
}
