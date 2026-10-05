import type { Graph, OperationMap } from "@grooph/core";
import { useState } from "react";

import { download } from "../doc/exportPackage.js";
import { pageMaker, pageName, pictureName, pictureSvg, svgToPng, type KeepTheme } from "../doc/keep.js";
import { themes, wanted } from "../doc/look.js";
import { AS_THE_SCREEN } from "./canvas/LookMenu.js";
import { Segmented } from "./fields.js";

const prefersDark = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

/**
 * The theme this screen is drawn in, when it is not Paper (docs/themes.md). Which theme is in effect is the themes'
 * piece's to say, and it is asked whenever there may be one: the piece has marked this screen's stage, or a theme
 * was kept or is named in the address. Undefined in Paper. `null` when the piece was wanted and could not be
 * fetched: the files are then Paper's, and that is said.
 */
const lookNow = async () => {
  if (!document.querySelector("main.stage[data-look]") && !wanted()) return undefined;
  try {
    return (await themes()).look();
  } catch {
    return null;
  }
};
const NO_THEMES = "The picture themes could not be fetched (they need a connection the first time), so this copy is in Paper.";
const NO_PAGE = "The offline page could not be made: its maker could not be fetched. It needs a connection the first time. The pictures above are made without it.";

/**
 * Keep a copy (review 2026-10, exports): the whole graph, or map, as a
 * picture with its words on it, readable at phone width, in light or dark;
 * and one HTML file that holds the document and a viewer and needs no
 * network. All made on the device from the document as it is now, in the
 * theme the pictures are in.
 */
export function Keep({ doc }: { doc: Graph | OperationMap }) {
  const [theme, setTheme] = useState<KeepTheme>(() => (prefersDark() ? "dark" : "light"));
  const [problem, setProblem] = useState<string | null>(null);
  /** The offline page's maker is on its way: the button says so and takes no second press. */
  const [making, setMaking] = useState(false);
  /** The picture as SVG: Paper's as it always was, and any other theme added to the picture that follows the viewer. */
  const drawn = async (): Promise<{ svg: string; look: string }> => {
    const look = await lookNow();
    setProblem(look === null ? NO_THEMES : null);
    return look ? { svg: look.picture(pictureSvg(doc, "auto"), theme), look: look.id } : { svg: pictureSvg(doc, theme), look: "" };
  };
  const png = async () => {
    try {
      const { svg, look } = await drawn();
      download(pictureName(doc, theme, "png", look), await svgToPng(svg), "image/png");
    } catch (err) {
      setProblem(`${(err as Error).message}. The SVG picture is the same drawing.`);
    }
  };
  const svg = async () => {
    const made = await drawn();
    download(pictureName(doc, theme, "svg", made.look), made.svg, "image/svg+xml");
  };
  const page = async () => {
    const look = await lookNow();
    setProblem(look === null ? NO_THEMES : null);
    // The page's maker is fetched at the first press (`doc/keep.ts`). When it cannot be had nothing is downloaded,
    // and that is said here, in place of a file that never comes. Only the fetch is caught: the notice is about it.
    setMaking(true);
    let make: Awaited<ReturnType<typeof pageMaker>>;
    try {
      make = await pageMaker();
    } catch {
      setProblem(NO_PAGE);
      return;
    } finally {
      setMaking(false);
    }
    const html = make(doc);
    download(pageName(doc), look ? look.page(html) : html, "text/html");
  };
  return (
    <div className="keep" role="group" aria-label="Keep a copy">
      <h3 className="files-title">Keep a copy</h3>
      {/* The list of six is the themes' piece's, fetched when this is pressed (`doc/look.ts`); it says the theme in effect after its name. */}
      <div className="site-theme" style={AS_THE_SCREEN}>
        <button type="button" className="btn" data-pictures="" aria-haspopup="menu">
          Picture theme
        </button>
      </div>
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
        <button type="button" className="btn" onClick={() => void png()}>
          Picture (PNG)
        </button>
        <button type="button" className="btn" onClick={() => void svg()}>
          Picture (SVG)
        </button>
        <button type="button" className="btn" disabled={making} aria-busy={making} onClick={() => void page()}>
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
