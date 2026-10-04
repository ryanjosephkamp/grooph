import { mapPicture, picture, replaySteps, type Graph, type OperationMap, type RunBundle } from "@grooph/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { openPayload } from "../../doc/share.js";
import { Brief, type Picked, type RunHere } from "./Brief.js";
import { decorateGraph, decorateMap } from "./decorate.js";
import { openInAppHref, type EmbedLink } from "./link.js";
import { Replay, loopRoundText, reducedMotion } from "./Replay.js";
import { Stage, type StageHandle } from "./Stage.js";

/**
 * `#/embed` (slice 0056, docs/exports.md "Embedding"): one document from a
 * share payload, drawn as core's picture, for a frame in someone else's page.
 * No app header, no save, no navigation: a reader can move the picture, tap
 * for a brief, and open the same payload in grooph. A run plays on its graph.
 * Nothing is stored and nothing is fetched beyond the app's own files.
 */

/** The picture's width in its own units for a frame this wide: its own 400 on a phone, wider cards on a wide frame. */
const unitsFor = (frame: number): number => Math.round(Math.min(Math.max(frame, 300), 600));
/** Pixels per unit: the frame's width, but never so large that a wide frame makes a poster. */
const scaleFor = (frame: number, units: number): number => Math.min(frame / units, 1.25);

const viewBox = (svg: string): { w: number; h: number } => {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  return { w: Number(m?.[1] ?? 400), h: Number(m?.[2] ?? 400) };
};

type Shown =
  | { kind: "graph"; doc: Graph }
  | { kind: "map"; doc: OperationMap }
  | { kind: "run"; doc: Graph; bundle: RunBundle }
  | { kind: "problem"; message: string };

function shownFrom(link: EmbedLink): Shown {
  const opened = openPayload(link.payload);
  if (!opened.ok) return { kind: "problem", message: opened.message };
  const { envelope } = opened;
  if (envelope.kind === "graph") return { kind: "graph", doc: envelope.doc };
  if (envelope.kind === "map") return { kind: "map", doc: envelope.doc };
  if (envelope.kind === "run") return { kind: "run", doc: envelope.doc.working, bundle: envelope.doc };
  // A comparison does not fit a frame: show the candidate asked for, else the recommended one, else the first.
  const set = envelope.doc;
  const chosen =
    set.candidates.find((c) => c.id === link.candidate) ?? set.candidates.find((c) => c.id === set.recommendation?.candidate) ?? set.candidates[0];
  if (chosen && "grooph" in chosen.graph) return { kind: "graph", doc: chosen.graph };
  return { kind: "problem", message: "This comparison has no graph that can be drawn here. Open it in grooph to see the candidates." };
}

/** Tell the page around the frame how tall the embed would like to be, so its script can size the frame. */
function postHeight(height: number): void {
  if (window.parent === window) return;
  window.parent.postMessage({ grooph: "embed-height", height }, "*");
}

export function Embed({ link }: { link: EmbedLink }) {
  const shown = useMemo(() => shownFrom(link), [link]);
  const root = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(() => document.documentElement.clientWidth || 400);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setFrameWidth(el.clientWidth));
    observer.observe(el);
    setFrameWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const attrs = {
    ref: root,
    className: "gx",
    ...(link.theme ? { "data-theme": link.theme } : {}),
    ...(link.frame ? { "data-frame": "" } : {}),
  };

  if (shown.kind === "problem") {
    return (
      <div {...attrs}>
        <div className="gx-problem" role="alert">
          <strong>This embed could not be drawn.</strong>
          <p>{shown.message}</p>
        </div>
      </div>
    );
  }
  return (
    <div {...attrs} {...(shown.kind === "run" ? { "data-replay": "" } : {})}>
      <Shown shown={shown} link={link} frameWidth={frameWidth} root={root} />
    </div>
  );
}

function Shown({ shown, link, frameWidth, root }: { shown: Exclude<Shown, { kind: "problem" }>; link: EmbedLink; frameWidth: number; root: React.RefObject<HTMLDivElement | null> }) {
  const units = unitsFor(frameWidth);
  const baseScale = scaleFor(frameWidth, units);
  const svg = useMemo(() => (shown.kind === "map" ? mapPicture(shown.doc, { width: units }) : picture(shown.doc, { width: units })), [shown, units]);
  const size = useMemo(() => viewBox(svg), [svg]);
  const name = shown.doc.name || shown.doc.id;

  const stage = useRef<StageHandle>(null);
  const bars = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [moved, setMoved] = useState(false);

  // Replay: a step is a note; step 0 is the graph before the run.
  const replay = useMemo(() => (shown.kind === "run" ? replaySteps(shown.bundle.notes, shown.doc) : undefined), [shown]);
  // A run opens at its end, unless it is to play; under reduced motion it does not play, so it opens at its end too.
  const [step, setStep] = useState(() => (replay && !(link.play && !reducedMotion()) ? replay.steps.length - 1 : 0));
  const current = replay?.steps[step];

  const decorate = useCallback(
    (svgRoot: SVGSVGElement) => {
      if (link.theme) svgRoot.setAttribute("data-theme", link.theme);
      svgRoot.removeAttribute("role");
      svgRoot.setAttribute("aria-hidden", "false");
      if (shown.kind === "map") decorateMap(svgRoot, shown.doc);
      else decorateGraph(svgRoot, shown.doc, current ? { step: current, last: step === replay!.steps.length - 1 } : undefined);
      for (const el of svgRoot.querySelectorAll(".is-picked")) el.classList.remove("is-picked");
      if (picked) {
        const attr = picked.kind === "handoff" ? `[data-handoff-row="${CSS.escape(picked.id)}"], [data-handoff="${CSS.escape(picked.id)}"]` : `[data-${picked.kind}="${CSS.escape(picked.id)}"]`;
        for (const el of svgRoot.querySelectorAll(attr)) el.classList.add("is-picked");
      }
    },
    [shown, link.theme, current, step, replay, picked],
  );

  const onTap = useCallback(
    (target: Element): boolean => {
      const hit = target.closest("[data-node], [data-loop], [data-session], [data-person], [data-handoff], [data-handoff-row], [data-plate], [data-number]");
      if (!(hit instanceof SVGElement)) return false;
      const d = hit.dataset;
      const next: Picked | null = d["node"]
        ? { kind: "node", id: d["node"] }
        : d["loop"]
          ? { kind: "loop", id: d["loop"] }
          : d["session"]
            ? { kind: "session", id: d["session"] }
            : d["person"]
              ? { kind: "person", id: d["person"] }
              : { kind: "handoff", id: (d["handoff"] ?? d["handoffRow"] ?? d["plate"] ?? d["number"])! };
      setPicked((p) => (p && p.kind === next.kind && p.id === next.id ? null : next));
      return true;
    },
    [],
  );

  // The height this embed would like, for the host page's script: the picture fitted to the width, and the bars.
  useEffect(() => {
    const el = root.current;
    const barEl = bars.current;
    if (!el || !barEl) return;
    const send = () => postHeight(Math.ceil(size.h * baseScale + barEl.offsetHeight + (el.offsetHeight - el.clientHeight)));
    send();
    const observer = new ResizeObserver(send);
    observer.observe(barEl);
    // A host page's script may arrive after the frame (deferred, or added by a CMS): say it again a little later.
    const later = [1000, 3000].map((ms) => setTimeout(send, ms));
    window.addEventListener("load", send);
    return () => {
      observer.disconnect();
      later.forEach(clearTimeout);
      window.removeEventListener("load", send);
    };
  }, [size.h, baseScale, root]);

  const runHere = useMemo((): RunHere | undefined => {
    if (!replay || !current || picked?.kind !== "node") return undefined;
    const node = current.summary.nodes[picked.id];
    if (!node) return undefined;
    const note = [...replay.steps.slice(1, step + 1)].reverse().find((s) => s.note?.at === `node:${picked.id}`)?.note;
    return { state: node.state, runs: node.runs, ...(node.round !== undefined ? { round: node.round } : {}), ...(note ? { note } : {}) };
  }, [replay, current, picked, step]);

  const loopRound = replay && current && picked?.kind === "loop" ? loopRoundText(current.summary.loops[picked.id]) : undefined;

  return (
    <>
      <div className="gx-main">
      <Stage
        ref={stage}
        svg={svg}
        width={size.w}
        height={size.h}
        baseScale={baseScale}
        label={`${name}. Drag to move, pinch or ctrl and scroll to zoom, tap ${shown.kind === "map" ? "a session or a handoff" : "a node"} to read about it.`}
        onTap={onTap}
        decorate={decorate}
        onMoved={setMoved}
      />
      {picked ? (
        <Brief
          doc={shown.doc}
          picked={picked}
          {...(runHere ? { run: runHere } : {})}
          {...(loopRound ? { loopRound } : {})}
          onClose={() => setPicked(null)}
        />
      ) : null}
      </div>
      <div ref={bars} className="gx-bars">
        {replay ? <Replay replay={replay} doc={shown.doc as Graph} step={step} setStep={setStep} autoplay={link.play} /> : null}
        <div className="gx-bar" role="toolbar" aria-label="Picture">
          <button type="button" className="gx-btn gx-icon" aria-label="Zoom out" onClick={() => stage.current?.zoom(1 / 1.25)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12h12" />
            </svg>
          </button>
          <button type="button" className="gx-btn gx-icon" aria-label="Zoom in" onClick={() => stage.current?.zoom(1.25)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12h12M12 6v12" />
            </svg>
          </button>
          <button type="button" className="gx-btn" aria-label="Fit the picture" disabled={!moved} onClick={() => stage.current?.fit()}>
            Fit
          </button>
          <span className="gx-spacer" />
          <a className="gx-btn gx-open" href={openInAppHref(link)} target="_blank" rel="noopener noreferrer">
            Open in grooph
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />
            </svg>
          </a>
        </div>
      </div>
    </>
  );
}
