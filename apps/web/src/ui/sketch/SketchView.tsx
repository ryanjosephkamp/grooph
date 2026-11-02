/**
 * The Sketch view in the editor (`../canvas/graph-views.tsx` shows it when Sketch is chosen): mermaidify's drawing
 * page, which `studio.ts` builds and runs, held in the canvas's place and handed the graph as it changes. It is a
 * piece of its own, fetched when Sketch is first chosen, with its styles in it.
 */
import type { Graph } from "@grooph/core";
import { useEffect, useRef } from "react";

import css from "./sketch.css?inline";
import { mountStudio, type Studio, type StudioHost } from "./studio.js";

let styled = false;

export function SketchView({ doc, host }: { doc: Graph; host: StudioHost }) {
  const at = useRef<HTMLDivElement>(null);
  const studio = useRef<Studio | undefined>(undefined);
  // The studio is made once for the graph and reaches the editor's latest through this.
  const latest = useRef(host);
  latest.current = host;
  if (!styled) {
    const sheet = document.createElement("style");
    sheet.textContent = css;
    document.head.append(sheet);
    styled = true;
  }
  useEffect(() => {
    const made = mountStudio(at.current!, {
      key: host.key,
      doc: () => latest.current.doc(),
      places: (d) => latest.current.places(d),
      apply: (next, typing) => latest.current.apply(next, typing),
      open: (id) => latest.current.open(id),
      exporting: () => latest.current.exporting(),
    });
    studio.current = made;
    return () => {
      made.destroy();
      studio.current = undefined;
    };
  }, [host.key]);
  useEffect(() => studio.current?.update(doc), [doc]);
  return (
    <div className="graph-sketch">
      <div ref={at} />
    </div>
  );
}
