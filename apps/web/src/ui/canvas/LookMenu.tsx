import type { CSSProperties } from "react";

import { LOOKS } from "../../doc/look.js";
import { Menu, usePictureChoices } from "../landing/Chrome.js";

/**
 * The pictures' theme, offered on the canvas (handoff 0086; docs/themes.md): the header's menu button with the one
 * set of choices, in the corner the loops' legend leaves free. It is drawn by the header's own rules, with the
 * header's night colors read as the screen's own, so it needs no style of its own: the site's stylesheet is at its
 * budget.
 */
export function LookMenu() {
  const pictures = usePictureChoices();
  const [, label, dot] = LOOKS.find(([id]) => id === pictures.chosen)!;
  return <Menu name={`Picture theme: ${label}`} sets={[pictures]} dot={dot} style={ON_CANVAS} toggleStyle={TOGGLE} />;
}

const ON_CANVAS = {
  position: "absolute",
  top: 22,
  right: 10,
  zIndex: "var(--z-overlay)",
  "--night-line": "var(--line-strong)",
  "--night-2": "var(--surface)",
  "--night-ink": "var(--ink)",
  "--bright": "var(--accent)",
  "--shadow-night": "var(--shadow)",
} as CSSProperties;
const TOGGLE: CSSProperties = { background: "var(--surface)", boxShadow: "var(--shadow)" };
