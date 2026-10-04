/**
 * A map's other views, for the map screen (handoff 0080): its lanes side by side and its sequence, the switch
 * between the views, and the styles they need. It is a piece of the app fetched when a map is
 * drawn (decision 0021): `MapView.tsx` asks for it as it opens, and the page names it so the service worker holds
 * it for a visit with no network (`vite.config.ts`).
 *
 * So that fetching it moves nothing else, this file imports nothing that the app's other pieces share but React,
 * which every address has already: core's views import only types (`packages/core/src/picture/map-kit.ts` says
 * why), and the screen hands them core's parts. Its styles ride in the script, for the same reason: a stylesheet
 * of its own would be asked for at every address.
 *
 * The third view, the map in three dimensions (handoff 0087), is a piece of its own again (`space.ts`), fetched
 * only when it is chosen: this file holds its place on the switch and nothing of how it is drawn.
 */
import type { MapKit, MapPictureOptions, OperationMap } from "@grooph/core";
import { mapSequenceWith, mapWideWith } from "@grooph/core/map-views";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

import css from "./views.css?inline";

const sheet = document.createElement("style");
sheet.textContent = css;
document.head.append(sheet);

type Space = typeof import("./space.js");
let space: Space | undefined;
type View = "picture" | "sequence" | "space";
const VIEWS: [View, string][] = [["picture", "Picture"], ["sequence", "Sequence"], ["space", "3D"]];

/** With room to spare the lanes side by side are shown larger, up to this many pixels to the unit. */
const LARGEST = 1.3;

/** What the views drew for the screen to show: the picture, whether it is the sequence, and its frame's own size. */
export const drawn = (svg: string, sequence: boolean): { svg: string; sequence: boolean; style: CSSProperties } => {
  const units = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)?.[1] ?? 0);
  // A sequence scrolls sideways inside its frame; the lanes side by side are not stretched past `LARGEST`.
  return { svg, sequence, style: sequence ? ({ "--map-units": `${units}px` } as CSSProperties) : { maxWidth: `${Math.round(units * LARGEST)}px` } };
};

/**
 * The switch, Picture, Sequence and 3D, and behind it the drawing: the lanes side by side from 1100 px, the
 * sequence when it is chosen, each in the room the screen's stage has, a unit to a pixel. On a phone the picture is
 * the phone's, which the screen draws itself, and `onDrawn` is told there is nothing of theirs.
 *
 * The room is the stage's width less its padding, in steps of twenty pixels, so that dragging the window's edge
 * does not draw the picture again at every pixel.
 *
 * `live` and `at` are what the hooks saw of the map's sessions and when (`mapLive` in core). Only the view in three
 * dimensions takes them, for the last stop of its slider; the map screen has none to give, and passes nothing.
 */
export function Views({ map, kit, wide, stage, onDrawn, live, at }: { map: OperationMap; kit: MapKit; wide: boolean; stage: RefObject<HTMLElement | null>; onDrawn: (theirs?: ReturnType<typeof drawn>) => void; live?: MapPictureOptions["live"]; at?: string }) {
  const [view, setView] = useState<View>("picture");
  // The flat view that is drawn, or was before 3D was chosen: what is shown while 3D is on its way, or cannot be had.
  const [flat, setFlat] = useState<Exclude<View, "space">>("picture");
  // `undefined` until the piece has come, `null` when it could not be fetched.
  const [piece, setPiece] = useState<Space | null | undefined>(space);
  const [room, setRoom] = useState<number>();
  const sequence = flat === "sequence";
  const three = view === "space" && piece ? piece : undefined;
  // If the piece cannot be had, the switch goes back to the flat view that is drawn by then, which may not be the
  // one that was drawn when 3D was pressed.
  const drawnFlat = useRef(flat);
  drawnFlat.current = flat;
  const choose = (next: View): void => {
    setView(next);
    if (next !== "space") return setFlat(next);
    if (!piece) import("./space.js").then((m) => setPiece((space = m)), () => (setPiece(null), setView((now) => (now === "space" ? drawnFlat.current : now))));
  };
  note(stage.current);
  useEffect(() => refocus(stage.current));
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = (): void => {
      const style = getComputedStyle(el);
      setRoom(Math.max(0, Math.floor((el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / 20) * 20));
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const svg = useMemo(() => (three ? "" : (sequence ? mapSequenceWith : mapWideWith)(kit, map, wide && room ? { width: room } : {})), [map, wide, sequence, room, three]);
  // In three dimensions a sheet holds three cards in a row at a phone's width, and more where there is room.
  const per = !room || room < 640 ? 3 : room < 900 ? 4 : 6;
  const made = useMemo(() => three?.plan(kit, map, { per, ...(live ? { live } : {}), ...(at ? { at } : {}) }), [map, three, per, live, at]);
  // Told before the screen paints, so the picture and the switch change together.
  useLayoutEffect(() => onDrawn(made ? { svg: made.html, sequence: false, style: {} } : wide || sequence ? drawn(svg, sequence) : undefined), [svg, wide, sequence, made]);
  // The scene is markup like the pictures; once the screen has put it on the page it is given its behavior, and
  // that is taken from it when the markup goes. How it was turned and where its slider was are kept between the two.
  const kept = useRef<ReturnType<Space["held"]>>(undefined);
  const scene = useRef<{ el: HTMLElement; made: typeof made; off: () => void }>(undefined);
  useEffect(() => {
    const el = (made && stage.current?.querySelector<HTMLElement>(".space")) || undefined;
    // The same markup can stand for a newer plan (what the hooks saw, read a minute later): it is attached again.
    if (el === scene.current?.el && (!el || made === scene.current?.made)) return;
    scene.current?.off();
    scene.current = el && three && made ? { el, made, off: three.attach(el, made, (kept.current ??= three.held()), choose) } : undefined;
  });
  useEffect(() => () => scene.current?.off(), []);
  // A set of radios, as the app's other switches are. Which layout the picture has is the screen's business.
  return (
    <>
      <div className="segmented map-views" role="radiogroup" aria-label="View of the map">
        {VIEWS.map(([name, label]) => (
          <button key={name} type="button" role="radio" aria-checked={view === name} className={view === name ? "seg seg-on" : "seg"} onClick={() => choose(name)}>
            {label}
          </button>
        ))}
      </div>
      {piece === null ? (
        <p className="map-views-note" role="status">
          The view in three dimensions could not be fetched. The picture and the sequence show the same map.
        </p>
      ) : null}
    </>
  );
}

/**
 * A picture drawn again for a new room is new markup, and the keyboard's place goes with the old. The part that
 * had it is noted, as a selector, each time the views are about to draw, and given it back once the screen has.
 */
let held: string | undefined;
const PARTS = ["session", "person", "handoff", "handoff-row"];

function note(stage: HTMLElement | null): void {
  const at = stage?.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  const part = PARTS.find((name) => at?.hasAttribute(`data-${name}`));
  // And in three dimensions the scene itself, its slider and its buttons.
  held = part ? `[data-${part}="${CSS.escape(at!.getAttribute(`data-${part}`)!)}"]` : at?.closest(".space") ? (at.dataset["do"] ? `.space [data-do="${at.dataset["do"]}"]` : at.matches("input") ? ".space input" : at.matches(".space-scene") ? ".space-scene" : undefined) : undefined;
}

function refocus(stage: HTMLElement | null): void {
  if (!held || document.activeElement !== document.body) return;
  const part = stage?.querySelector<SVGElement>(held);
  if (held.startsWith("[")) part?.setAttribute("tabindex", "0");
  part?.focus({ preventScroll: true });
}
