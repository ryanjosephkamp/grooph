/**
 * What every canvas carries of a subgrooph's box (amendment A-018, handoff 0085): the question, and the fetch. The
 * box itself, which ones are open, the room each takes and the outline's fold all come with the piece
 * (`units.tsx`), so a document with no subgrooph fetches nothing and pays for almost nothing.
 */
import type { Graph } from "@grooph/core";
import { createElement, useEffect, useState, type FunctionComponent } from "react";

import { piece } from "../../piece.js";

export type Units = typeof import("./units.js");
export type UseBoxes = Units["useBoxes"] | (() => undefined);
/** `undefined` until it is asked for, `null` when it could not be had: the nodes are then drawn as they are. */
let got: Units | null | undefined;
/** The piece, if it has come: a canvas fetches it, and what is drawn beside a canvas asks here. */
export const unitsNow = (): Units | null | undefined => got;
const none = (): undefined => undefined;

/**
 * A canvas that draws a document's subgroophs as boxes. A document that has one waits for the piece, which is
 * asked for again if the fetch fails (`piece.ts`); if it cannot be had, the nodes are drawn as they are. `Drawn` is
 * the canvas, and is handed the piece's own hook to call, or one that answers nothing; it is made anew when the
 * piece arrives, so the hook it calls is always the same one.
 */
export const boxed =
  <P extends object>(Drawn: FunctionComponent<P & { useBoxes: UseBoxes }>, useDocOf: (props: P) => Graph): FunctionComponent<P> =>
  (props) => {
    const wanted = !!useDocOf(props).groups?.some((group) => group.from);
    const [units, setUnits] = useState(got);
    useEffect(() => {
      if (wanted && units === undefined) piece("units", () => import("./units.js")).then((m) => setUnits((got = m)), () => setUnits((got = null)));
    }, [wanted, units]);
    return wanted && units === undefined ? null : createElement(Drawn, { key: units ? 1 : 0, ...props, useBoxes: wanted && units ? units.useBoxes : none });
  };
