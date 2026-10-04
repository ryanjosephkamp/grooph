import type { Graph, OperationMap } from "@grooph/core";
import { useState } from "react";

import { download } from "../doc/exportPackage.js";
import { pageHtml, pageName, pictureName, pictureSvg, svgToPng, type KeepTheme } from "../doc/keep.js";
import { LOOKS, chooseLook, useLook, useLookId } from "../doc/look.js";
import { Segmented, Select } from "./fields.js";

const prefersDark = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * Keep a copy (review 2026-10, exports): the whole graph, or map, as a
 * picture with its words on it, readable at phone width, in light or dark;
 * and one HTML file that holds the document and a viewer and needs no
 * network. All made on the device from the document as it is now.
 */
export function Keep({ doc }: { doc: Graph | OperationMap }) {
  const [theme, setTheme] = useState<KeepTheme>(() => (prefersDark() ? "dark" : "light"));
  const [problem, setProblem] = useState<string | null>(null);
  // The pictures' theme (docs/themes.md): the one chosen for this browser, which can be changed here too.
  const lookId = useLookId();
  const look = useLook();
  const waiting = lookId !== "paper" && !look;
  const png = async () => {
    setProblem(null);
    try {
      download(pictureName(doc, theme, "png", look), await svgToPng(pictureSvg(doc, theme, look)), "image/png");
    } catch (err) {
      setProblem(`${(err as Error).message}. The SVG picture is the same drawing.`);
    }
  };
  return (
    <div className="keep" role="group" aria-label="Keep a copy">
      <h3 className="files-title">Keep a copy</h3>
      <Select label="Picture theme" value={lookId} options={LOOKS.map(([value, label]) => ({ value, label }))} onChange={chooseLook} />
      <Segmented
        label="Picture colors"
        value={theme}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={setTheme}
      />
      <div className="export-actions">
        <button type="button" className="btn" disabled={waiting} onClick={() => void png()}>
          Picture (PNG)
        </button>
        <button type="button" className="btn" disabled={waiting} onClick={() => download(pictureName(doc, theme, "svg", look), pictureSvg(doc, theme, look), "image/svg+xml")}>
          Picture (SVG)
        </button>
        <button type="button" className="btn" disabled={waiting} onClick={() => download(pageName(doc), pageHtml(doc, look), "text/html")}>
          Offline page (.html)
        </button>
      </div>
      {problem ? (
        <p className="refusal" role="alert">
          {problem}
        </p>
      ) : null}
      <p className="field-hint">The picture is laid out for a phone. The offline page holds the picture, every brief and the document itself in one file, and opens with no network.</p>
    </div>
  );
}
