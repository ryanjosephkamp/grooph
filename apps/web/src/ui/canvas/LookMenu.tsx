import type { CSSProperties } from "react";

/**
 * The pictures' themes, offered on the canvas (handoff 0086; docs/themes.md): a dot in the stage's top right
 * corner. It is all there is of the themes on this screen. `data-pictures` is what makes it work: a press fetches
 * the themes' piece, which opens its list of six here (`doc/look.ts`, `ui/theme/themes.ts`), and once the piece is
 * here it colors the dot and says the theme in its name.
 *
 * The loops' legend stops 80 px short of the stage's right edge in the editor and the viewer (styles.css) and 64 px
 * short in the run view (`RunView.tsx`), so nothing lies over it. It is drawn by the header's own rules for its
 * theme button, with the header's night colors read as the screen's own, so it needs no style of its own: the
 * site's stylesheet is at its budget.
 */
export function LookMenu() {
  return (
    <div className="site-theme" style={ON_CANVAS}>
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
const ON_CANVAS: CSSProperties = { position: "absolute", top: 22, right: 10, zIndex: "var(--z-overlay)", ...AS_THE_SCREEN };
const TOGGLE: CSSProperties = { background: "var(--surface)", boxShadow: "var(--shadow)" };
