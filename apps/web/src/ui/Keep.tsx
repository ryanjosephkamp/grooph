import type { Graph, OperationMap } from "@grooph/core";
import { useState } from "react";

import { download } from "../doc/exportPackage.js";
import { pageHtml, pageName, pictureName, pictureSvg, svgToPng, type KeepTheme } from "../doc/keep.js";
import { Segmented } from "./fields.js";

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
  const png = async () => {
    setProblem(null);
    try {
      download(pictureName(doc, theme, "png"), await svgToPng(pictureSvg(doc, theme)), "image/png");
    } catch (err) {
      setProblem(`${(err as Error).message}. The SVG picture is the same drawing.`);
    }
  };
  return (
    <div className="keep" role="group" aria-label="Keep a copy">
      <h3 className="files-title">Keep a copy</h3>
      <Segmented
        label="Picture colours"
        value={theme}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
        onChange={setTheme}
      />
      <div className="export-actions">
        <button type="button" className="btn" onClick={() => void png()}>
          Picture (PNG)
        </button>
        <button type="button" className="btn" onClick={() => download(pictureName(doc, theme, "svg"), pictureSvg(doc, theme), "image/svg+xml")}>
          Picture (SVG)
        </button>
        <button type="button" className="btn" onClick={() => download(pageName(doc), pageHtml(doc), "text/html")}>
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
