import { useEffect, useRef, useState, type ReactNode } from "react";

import "./more.css";

/**
 * A recorded run, played on the front page when asked for and not before.
 *
 * The run is one of the proving runs (the heterogeneous critic, 20 September 2026), shown by the embed of slice
 * 0056 in a frame. Nothing of it is in the app's first load: the run is a file fetched on the press of the
 * button, and the embed's code comes with the frame. The run takes the picture's place while it plays, and
 * `children` (the picture and its caption) come back when it is closed.
 */
export function RunDemo({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [payload, setPayload] = useState<string | null>(null);
  const [height, setHeight] = useState(680);
  const frame = useRef<HTMLIFrameElement>(null);

  // The frame says how tall it wants to be, as it does on any page that embeds a graph.
  useEffect(() => {
    if (payload === null) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { grooph?: string; height?: number } | null;
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || data?.grooph !== "embed-height" || !(Number(data.height) > 0)) return;
      setHeight(Math.min(Number(data.height), 4000));
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, [payload]);

  if (payload !== null) {
    return (
      <>
        <iframe
          ref={frame}
          className="land-run-frame"
          title="A recorded run of the heterogeneous critic template, played step by step"
          src={`${import.meta.env.BASE_URL}#/embed?d=${payload}&play=1`}
          style={{ height }}
        />
        <figcaption className="muted">
          A run Claude Code made on 20 September, replayed from its own notes. The critic fails the first round, the builder goes again, and the run halts at
          the human gate.{" "}
          <button type="button" className="link-button" onClick={() => setPayload(null)}>
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
            const res = await fetch(`${import.meta.env.BASE_URL}demo/run.txt`);
            if (!res.ok) throw new Error(String(res.status));
            setPayload((await res.text()).trim());
            setState("idle");
          } catch {
            setState("failed");
          }
        }}
      >
        <span aria-hidden="true">▶</span> Watch a recorded run
      </button>
      <span className="muted" role="status">
          {state === "loading" ? "Fetching the run…" : state === "failed" ? "The run could not be fetched. It needs a network the first time." : ""}
        </span>
      </p>
    </>
  );
}
