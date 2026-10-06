import { KNOWN_TARGETS, targetTitle } from "@grooph/core";
import { useEffect, useMemo, useState } from "react";

import { computeIssues, needInWords, packageNeeds } from "../doc/issues.js";
import { useDoc } from "../doc/store.js";
import { piece } from "../piece.js";
import { useEditor } from "./editorContext.js";
import { Keep } from "./Keep.js";

const TARGETS = KNOWN_TARGETS.map((id) => ({ id, title: targetTitle(id) ?? id }));

type Panel = typeof import("./ExportPanel.js");
let panel: Panel | undefined;

/** Fetch the Export panel, once it has come. A fetch that fails is tried again there and then (`piece.ts`). */
export const loadExportPanel = (): Promise<Panel> => piece("ExportPanel", () => import("./ExportPanel.js")).then((m) => (panel = m));

/**
 * The Export panel's door (slice 0100). The panel is a piece of the app (decision 0021): what a canvas loads to
 * draw a graph does not carry the plan, the package and their words, which one button opens. The editor asks for it
 * soon after it opens, as it asks for the compiler, so a press seldom waits; a press that cannot fetch it says so
 * here and offers to try again.
 *
 * The door hands the panel all it needs of the canvas's own files (the document, its findings, a package's needs
 * in words, "Keep a copy", the editor's doings), so the panel imports none of them: a file two pieces import is
 * moved by the bundler into what every address loads. `test/plan.test.ts` holds that.
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
  const editor = useEditor();
  const doc = useDoc(editor.store);
  const own = useMemo(() => computeIssues(doc), [doc]);
  const needs = useMemo(() => packageNeeds(doc).map((need) => needInWords(need, doc, TARGETS)), [doc]);
  if (state === "here" && panel) {
    return <panel.ExportPanel doc={doc} own={own} needs={needs} keep={<Keep doc={doc} />} open={(type) => editor.openPanel({ type })} exported={editor.markExported} />;
  }
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
