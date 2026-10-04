/**
 * A map's other views, for the map screen (handoff 0080): its lanes side by side and its sequence, the switch
 * between the picture and the sequence, and the styles they need. It is a piece of the app fetched when a map is
 * drawn (decision 0021): `MapView.tsx` asks for it as it opens, and the page names it so the service worker holds
 * it for a visit with no network (`vite.config.ts`).
 *
 * So that fetching it moves nothing else, this file imports nothing that the app's other pieces share but React,
 * which every address has already: core's views import only types (`packages/core/src/picture/map-kit.ts` says
 * why), and the screen hands them core's parts. Its styles ride in the script, for the same reason: a stylesheet
 * of its own would be asked for at every address.
 */
import type { MapKit, OperationMap } from "@grooph/core";
import { mapSequenceWith, mapWideWith } from "@grooph/core/map-views";
import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties, type RefObject } from "react";

import css from "./views.css?inline";

const sheet = document.createElement("style");
sheet.textContent = css;
document.head.append(sheet);

/** With room to spare the lanes side by side are shown larger, up to this many pixels to the unit. */
const LARGEST = 1.3;

/** What the views drew for the screen to show: the picture, whether it is the sequence, and its frame's own size. */
export const drawn = (svg: string, sequence: boolean): { svg: string; sequence: boolean; style: CSSProperties } => {
  const units = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)?.[1] ?? 0);
  // A sequence scrolls sideways inside its frame; the lanes side by side are not stretched past `LARGEST`.
  return { svg, sequence, style: sequence ? ({ "--map-units": `${units}px` } as CSSProperties) : { maxWidth: `${Math.round(units * LARGEST)}px` } };
};

/**
 * The switch, Picture and Sequence, and behind it the drawing: the lanes side by side from 1100 px, the sequence
 * when it is chosen, each in the room the screen's stage has, a unit to a pixel. On a phone the picture is the
 * phone's, which the screen draws itself, and `onDrawn` is told there is nothing of theirs.
 *
 * The room is the stage's width less its padding, in steps of twenty pixels, so that dragging the window's edge
 * does not draw the picture again at every pixel.
 */
export function Views({ map, kit, wide, stage, onDrawn }: { map: OperationMap; kit: MapKit; wide: boolean; stage: RefObject<HTMLElement | null>; onDrawn: (theirs?: ReturnType<typeof drawn>) => void }) {
  const [sequence, setSequence] = useState(false);
  const [room, setRoom] = useState<number>();
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
  const svg = useMemo(() => (sequence ? mapSequenceWith : mapWideWith)(kit, map, wide && room ? { width: room } : {}), [map, wide, sequence, room]);
  // Told before the screen paints, so the picture and the switch change together.
  useLayoutEffect(() => onDrawn(wide || sequence ? drawn(svg, sequence) : undefined), [svg, wide, sequence]);
  // Picture or Sequence: a pair of radios, as the app's other switches are. Which layout the picture has is the screen's business.
  return (
    <div className="segmented map-views" role="radiogroup" aria-label="View of the map">
      {["Picture", "Sequence"].map((label, k) => (
        <button key={label} type="button" role="radio" aria-checked={sequence === (k === 1)} className={sequence === (k === 1) ? "seg seg-on" : "seg"} onClick={() => setSequence(k === 1)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * A picture drawn again for a new room is new markup, and the keyboard's place goes with the old. The part that
 * had it is noted, as a selector, each time the views are about to draw, and given it back once the screen has.
 */
let held: string | undefined;
const PARTS = ["session", "person", "handoff", "handoff-row"];

function note(stage: HTMLElement | null): void {
  const at = stage?.contains(document.activeElement) ? document.activeElement : null;
  const part = PARTS.find((name) => at?.hasAttribute(`data-${name}`));
  held = part ? `[data-${part}="${CSS.escape(at!.getAttribute(`data-${part}`)!)}"]` : undefined;
}

function refocus(stage: HTMLElement | null): void {
  if (!held || document.activeElement !== document.body) return;
  const part = stage?.querySelector<SVGElement>(held);
  part?.setAttribute("tabindex", "0");
  part?.focus({ preventScroll: true });
}
