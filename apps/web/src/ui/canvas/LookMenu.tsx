import type { CSSProperties } from "react";

import css from "./look.css?inline";

// Where the dot stands. Added to the page by this script, as the other pieces of the canvas add theirs.
const sheet = document.createElement("style");
sheet.textContent = css;
document.head.append(sheet);

/**
 * The pictures' themes, offered on the canvas (handoff 0086; docs/themes.md): a dot in the stage's top right
 * corner, under the switch of the graph's views. It is all there is of the themes on this screen. `data-pictures`
 * is what makes it work: a press fetches the themes' piece, which opens its list of six here (`doc/look.ts`,
 * `ui/theme/themes.ts`), and once the piece is here it colors the dot and says the theme in its name.
 *
 * Where it stands, and that it steps aside for a graph in three dimensions, is in `look.css`, which rides in this
 * script. It is drawn by the header's own rules for its theme button, with the header's night colors read as the
 * screen's own: the app's stylesheets, which every address loads, are at their budget.
 */
export function LookMenu() {
  return (
    <div className="site-theme look-dot" style={AS_THE_SCREEN}>
      <button className="site-theme-toggle" type="button" aria-label="Picture theme" aria-haspopup="menu" data-pictures="" style={TOGGLE}>
        <span className="site-theme-dot" aria-hidden="true" />
      </button>
    </div>
  );
}

/** The header's colors, read as the screen's: for the button, and for the list the piece opens beside it. */
export const AS_THE_SCREEN = {
  "--night-line": "var(--line-strong)",
  "--night-2": "var(--surface)",
  "--night-ink": "var(--ink)",
  "--bright": "var(--accent)",
  "--shadow-night": "var(--shadow)",
} as CSSProperties;
const TOGGLE: CSSProperties = { background: "var(--surface)", boxShadow: "var(--shadow)" };
