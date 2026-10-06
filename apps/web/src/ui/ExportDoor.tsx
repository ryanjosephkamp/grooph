import { useEffect, useState } from "react";

import { piece } from "../piece.js";

type Panel = typeof import("./ExportPanel.js");
let panel: Panel | undefined;

/** Fetch the Export panel, once it has come. A fetch that fails is tried again there and then (`piece.ts`). */
export const loadExportPanel = (): Promise<Panel> => piece("ExportPanel", () => import("./ExportPanel.js")).then((m) => (panel = m));

/**
 * The Export panel's door (slice 0100). The panel is a piece of the app (decision 0021): what a canvas loads to
 * draw a graph does not carry the plan, the package and their words, which one button opens. The editor asks for it
 * soon after it opens, as it asks for the compiler, so a press seldom waits; a press that cannot fetch it says so
 * here and offers to try again.
 */
export function ExportDoor() {
  const [state, setState] = useState<"here" | "coming" | "failed">(panel ? "here" : "coming");
  useEffect(() => {
    if (state !== "coming") return;
    let gone = false;
    loadExportPanel().then(
      () => !gone && setState("here"),
      () => !gone && setState("failed"),
    );
    return () => {
      gone = true;
    };
  }, [state]);
  if (state === "here" && panel) return <panel.ExportPanel />;
  return (
    <div className="inspector">
      {state === "failed" ? (
        <div className="refusal" role="alert">
          <p>
            <strong>The Export panel could not be fetched.</strong> It needs a connection the first time. Nothing of the graph is lost.
          </p>
          <button type="button" className="btn" onClick={() => setState("coming")}>
            Try again
          </button>
        </div>
      ) : (
        <p className="field-hint" role="status">
          Opening export…
        </p>
      )}
    </div>
  );
}
