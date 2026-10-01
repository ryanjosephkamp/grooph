import { useNodesInitialized, useReactFlow, useStore } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";

import { fitOptions, openingViewport, type Pad, type Viewport } from "./fit.js";

/** From this width the inspector is a panel beside the canvas, not a sheet over it (styles.css). */
const WIDE = 900;

/**
 * Opens a canvas at a size that can be read (`openingViewport`). React Flow's
 * own fit shows the whole graph; when that would be too small to read, this
 * replaces it once, after the nodes are measured, and never again: what the
 * person pans or zooms to afterwards is theirs.
 *
 * With `control`, a canvas that opened zoomed in offers the whole graph, and
 * the way back, in one tap. The editor has Fit in its toolbar instead.
 */
export function OpeningView({ pad, control, refit }: { pad: Pad; control?: boolean; refit?: { current: boolean } }) {
  const flow = useReactFlow();
  const ready = useNodesInitialized();
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const done = useRef(false);
  /** the canvas's size when the view was last chosen for it */
  const sized = useRef<{ width: number; height: number } | null>(null);
  const [opening, setOpening] = useState<Viewport | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (!ready || done.current || width === 0 || height === 0) return;
    done.current = true;
    sized.current = { width, height };
    const nodes = flow.getNodes();
    if (nodes.length === 0) return;
    const { fits, ...view } = openingViewport(flow.getNodesBounds(nodes), { width, height }, pad);
    if (fits) return;
    // Two frames, so this lands after React Flow's own first fit.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void flow.setViewport(view);
        setOpening(view);
      }),
    );
  }, [ready, width, height, flow, pad]);

  // On a wide screen a panel opens beside the canvas and takes a third of it. If the view is still the one the app
  // chose, it is chosen again for the room that is left, so nothing ends up under the panel (review 2026-10, item 14).
  // A view someone panned or zoomed to is theirs, and a phone's sheet opens over the canvas: both are left alone.
  useEffect(() => {
    if (!refit || !done.current || width === 0 || height === 0) return;
    const before = sized.current;
    sized.current = { width, height };
    if (before === null || (before.width === width && before.height === height)) return;
    if (refit.current || window.innerWidth < WIDE) return;
    const nodes = flow.getNodes();
    if (nodes.length === 0) return;
    const { fits, ...view } = openingViewport(flow.getNodesBounds(nodes), { width, height }, pad);
    if (fits) void flow.fitView({ ...fitOptions(pad), duration: 150 });
    else void flow.setViewport(view, { duration: 150 });
  }, [width, height, refit, flow, pad]);

  if (!control || opening === null) return null;
  return (
    <button
      type="button"
      className="view-fit"
      aria-pressed={all}
      onClick={() => {
        if (all) void flow.setViewport(opening, { duration: 250 });
        else void flow.fitView({ ...fitOptions(pad), duration: 250 });
        setAll(!all);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {all ? <path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5" /> : <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />}
      </svg>
      {all ? "Readable size" : "Show all"}
    </button>
  );
}
