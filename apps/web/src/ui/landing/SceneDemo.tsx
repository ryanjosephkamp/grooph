import type { Graph } from "@grooph/core";
import { useState, type ReactNode } from "react";

import { loadBuiltIns } from "../../doc/templates.js";
import { piece } from "../../piece.js";
import "./more.css";

type Stage = typeof import("../canvas/graph-stage.js");

/**
 * The front page's diagram in 3D, shown when asked for and not before: the template and the view are pieces of the
 * app, fetched on the press of the button, as the canvas fetches them. The view takes the picture's place, its
 * slider playing through a first pass and a turn of the loop, and `children` (the picture and its caption) come back
 * when it is closed. It is Panes: the picture itself, with the loop lifted toward the reader.
 */
export function SceneDemo({ id, children }: { id: string; children: ReactNode }) {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [shown, setShown] = useState<{ stage: Stage; doc: Graph } | null>(null);

  if (shown) {
    return (
      <>
        <div className="land-3d">
          <shown.stage.Stage3 doc={shown.doc} kind="panes" wide={innerWidth} of={{}} play />
        </div>
        <figcaption className="muted">
          The same template in 3D, as every canvas in the app can show it: drag to turn it.{" "}
          <button type="button" className="link-button" onClick={() => setShown(null)}>
            Back to the picture
          </button>
        </figcaption>
      </>
    );
  }

  return (
    <>
      {children}
      <p className="land-play">
        <button
          type="button"
          className="btn"
          disabled={state === "loading"}
          onClick={async () => {
            setState("loading");
            try {
              const [stage, builtIns] = await Promise.all([piece("graph-stage", () => import("../canvas/graph-stage.js")), loadBuiltIns()]);
              const doc = builtIns.find((graph) => graph.id === id);
              if (!doc) throw new Error(`no built-in template ${id}`);
              setShown({ stage, doc });
              setState("idle");
            } catch {
              setState("failed");
            }
          }}
        >
          <span aria-hidden="true">▶</span> See it in 3D
        </button>
        <span className="muted" role="status">
          {state === "loading" ? "Fetching the 3D view…" : state === "failed" ? "The 3D view could not be fetched. It needs a network the first time." : ""}
        </span>
      </p>
    </>
  );
}
