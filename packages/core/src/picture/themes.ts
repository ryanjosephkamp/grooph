/**
 * The picture's themes (docs/themes.md): Paper, which is the picture as it has always been drawn and needs nothing
 * from this file, and five more. A theme is a set of values, not a second renderer: its colors in light and in
 * dark, the face its words are drawn in, and a few rules for line weight, corners and lettering. The picture's
 * markup and geometry are the same in all six; `pictureLook(name)` turns a theme's values into what a picture's
 * frame carries (`PictureLook`, svg.ts).
 *
 * This file is a door of core (decision 0021), as the compiler and a map's other views are: nothing `base.ts`
 * reaches leads here and nothing here is imported but types, so the web app fetches it only when a theme other
 * than Paper is chosen, and fetching it moves nothing else. In Node there is no door: `index.ts` exports it.
 *
 * The rules are written for the hooks the pictures already carry (`data-card`, `data-edge`, a label's size), so a
 * theme adds no attribute to any element. A test holds every rule to a hook that exists.
 */
import type { Color, PictureLook, PictureTheme } from "./svg.js";

/** The six, in the order they are offered. The first is today's picture and has no values here. */
export const PICTURE_THEMES = ["paper", "blueprint", "ink", "phosphor", "transit", "chalk"] as const;
export type PictureThemeName = (typeof PICTURE_THEMES)[number];

type Palette = Record<Color, string> & { route?: string };
/** A color of the theme as a rule writes it: a variable in a picture that follows the viewer, the value in one that does not. */
type Paint = (name: Color | "route") => string;

export type ThemeValues = {
  name: Exclude<PictureThemeName, "paper">;
  label: string;
  /** what the theme is for, in a line */
  use: string;
  light: Palette;
  /** the same object as `light` for a theme with one form */
  dark: Palette;
  /** the face of the picture's words; without it, the picture's own */
  face?: string;
  /** style rules; `&` is the picture */
  rules: (c: Paint) => string;
  /** what the rules and the ground refer to: a pattern, a filter. `id` is the ground's, which says the picture's form. */
  defs?: (c: Paint, id: string) => string;
  /** whether `defs` holds a pattern to draw over the background */
  ground?: true;
  /** the same values for the canvas, which is not a picture: its cards' corners, their outline, a gate's, the edges' */
  canvas: { radius: number; stop: number; border: number; gate: number; edge: number; caps?: number; labelFace?: string };
};

// The faces. No theme fetches one: each asks for a face the site serves, then for one the reader's machine has.
const SANS = `"Atkinson Hyperlegible Next",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`;
const MONO = `"Atkinson Hyperlegible Mono",ui-monospace,"SF Mono",Menlo,Consolas,"Roboto Mono",monospace`;
const SERIF = `Georgia,"Times New Roman",Times,serif`;
// No `cursive` at the end: on a phone that is a script nobody reads at ten pixels.
const HAND = `"Chalkboard SE","Comic Sans MS",${SANS}`;

// What the rules select. A card is a node's, a session's or a person's; a gate's has the heavier outline, a
// stop's the rounder corners, a person's its own of each.
const CARD = `& rect[data-card]`;
const GATE = `& rect[data-card][stroke-width="1.8"]`;
const PERSON = `& rect[data-card][stroke-width="1.4"]`;
const STOP = `& rect[data-card][rx="16"]`;
/** a card that is neither a stop's nor a person's, and a family's two edges behind it (not the pill that counts the family) */
const PLAIN = `& [data-node]>rect[data-card],& [data-session]>rect[data-card],& [data-session]>rect[rx="9"]`;
/** the pills: an edge's condition, a label along a margin, a lane's place, a family's count */
const PILL = `& rect[rx="7.4"],& rect[rx="6.5"],& rect[rx="8.1"]`;
const LINE = `& [data-edge] path[fill="none"]`;
/** a node's kind, in the card's first line. A child of the node, so not a mark a page adds inside the card. */
const KIND = `& [data-node]>text[font-size="9.5"]`;
/** the small lines of a card, drawn in the regular weight */
const SUB = `& [data-node]>text[font-size="10.5"]`;
/**
 * How far a fixed-width face's letters are drawn in, in em. Every line of a picture is laid out for a face that sets
 * its letters by their own widths, and a fixed-width one sets a line of narrow letters wider. Drawn this much closer
 * and at the sizes below, no full line of the repository's prose (over twenty thousand of them, wrapped as the
 * pictures wrap them) leaves its box in the widest fixed-width face there is to meet, the site's own at 0.632 em.
 */
const TIGHT = `letter-spacing:-.05em`;

const blueprint: ThemeValues = {
  name: "blueprint",
  label: "Blueprint",
  use: "For architecture notes and slides, where the picture should read as an engineering drawing.",
  // prettier-ignore
  light: {
    bg: "#f2f6fc", surface: "#f8fbff", "surface-2": "#e3ebf7", ink: "#0f2f63", "ink-2": "#24467e", "ink-3": "#48628f",
    line: "#d3dff0", "line-strong": "#24467e", accent: "#0f2f63", "accent-soft": "#dde7f6",
    gate: "#a4470b", "gate-soft": "#fbeedd", check: "#1d4e9e", merge: "#5a3fa0", stop: "#48628f",
    ok: "#1c6b4a", "ok-soft": "#dcf0e6", warning: "#8a5200", error: "#a8261c", "error-soft": "#fbe6e3",
    "loop-0": "#0a6a9c", "loop-1": "#6a45b5", "loop-2": "#a8431a", "loop-3": "#9c2a63",
  },
  // prettier-ignore
  dark: {
    bg: "#143d73", surface: "#184683", "surface-2": "#1d4f92", ink: "#f1f6ff", "ink-2": "#d0def5", "ink-3": "#b3c8eb",
    line: "#2a5594", "line-strong": "#d0def5", accent: "#f1f6ff", "accent-soft": "#24579e",
    gate: "#ffc566", "gate-soft": "#3a4f6e", check: "#a9d1ff", merge: "#d7c2ff", stop: "#b3c8eb",
    ok: "#9ff0c0", "ok-soft": "#1c5a60", warning: "#ffd27f", error: "#ffb3a8", "error-soft": "#5a3550",
    "loop-0": "#7fe3ff", "loop-1": "#d7c2ff", "loop-2": "#ffb08a", "loop-3": "#f8afdb",
  },
  rules: () =>
    `${CARD}{stroke-width:1.2}${GATE}{stroke-width:2.4}` +
    `${PLAIN},${PILL}{rx:0;ry:0}${STOP}{rx:16px;ry:16px}` +
    // Fixed-width labels, smaller and closer (`TIGHT`). The title in capitals is smaller too: capitals are wider than
    // what was measured, in any face.
    `${KIND}{font-family:${MONO};font-weight:500;text-transform:uppercase;letter-spacing:.09em}` +
    `${SUB},& [data-lane] text[font-size="10.5"]{font-family:${MONO};font-size:8.5px;${TIGHT}}` +
    `& text[font-size="17"]{text-transform:uppercase;letter-spacing:.06em;font-size:12.5px}`,
  defs: (c, id) => `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20,.5H.5V20" fill="none" stroke-width="1" style="stroke:${c("line")}"/></pattern>`,
  ground: true,
  canvas: { radius: 0, stop: 16, border: 1.2, gate: 2.4, edge: 1.5, caps: 0.09, labelFace: MONO },
};

const BLACK = "#000000";
const WHITE = "#f6f6f6";
const ink: ThemeValues = {
  name: "ink",
  label: "Ink",
  use: "For papers and print. One ink and no tints, so it survives a photocopier.",
  // prettier-ignore
  light: {
    bg: "#ffffff", surface: "#ffffff", "surface-2": "#f1f1f1", ink: BLACK, "ink-2": "#1c1c1c", "ink-3": "#3d3d3d",
    line: "#bdbdbd", "line-strong": BLACK, accent: BLACK, "accent-soft": "#ececec",
    gate: BLACK, "gate-soft": "#ececec", check: BLACK, merge: BLACK, stop: BLACK,
    ok: BLACK, "ok-soft": "#ececec", warning: BLACK, error: BLACK, "error-soft": "#ececec",
    "loop-0": BLACK, "loop-1": BLACK, "loop-2": BLACK, "loop-3": BLACK,
  },
  // prettier-ignore
  dark: {
    bg: "#0b0b0b", surface: "#0b0b0b", "surface-2": "#1c1c1c", ink: WHITE, "ink-2": "#e2e2e2", "ink-3": "#bdbdbd",
    line: "#4a4a4a", "line-strong": WHITE, accent: WHITE, "accent-soft": "#222222",
    gate: WHITE, "gate-soft": "#222222", check: WHITE, merge: WHITE, stop: WHITE,
    ok: WHITE, "ok-soft": "#222222", warning: WHITE, error: WHITE, "error-soft": "#222222",
    "loop-0": WHITE, "loop-1": WHITE, "loop-2": WHITE, "loop-3": WHITE,
  },
  face: SERIF,
  rules: () =>
    // With one ink, weight says what color said: a gate, a person and an edge a person approves are heavy rules.
    `${CARD}{stroke-width:.8}${GATE}{stroke-width:3}${PERSON}{stroke-width:2.4}` +
    `${PLAIN}{rx:2px;ry:2px}${STOP}{rx:16px;ry:16px}` +
    `${LINE}{stroke-width:1.1}& [data-edge] path[stroke-width="2"]{stroke-width:2.4}` +
    `& [data-edge] path[stroke-dasharray="5 3"]{stroke-dasharray:3.5 2.5}` +
    `${KIND}{text-transform:uppercase;letter-spacing:.1em;font-size:8.5px}`,
  canvas: { radius: 2, stop: 16, border: 0.8, gate: 3, edge: 1.1, caps: 0.1 },
};

// One form: a screen is dark. Asked for light, it is the same picture.
// prettier-ignore
const SCREEN: Palette = {
  bg: "#0a0f0b", surface: "#0e1610", "surface-2": "#132017", ink: "#b8f5c2", "ink-2": "#8fd69b", "ink-3": "#6aa876",
  line: "#1c2e21", "line-strong": "#3c6b48", accent: "#5dff8a", "accent-soft": "#123620",
  gate: "#ffb84a", "gate-soft": "#33260e", check: "#7fd4ff", merge: "#c9a6ff", stop: "#9fb5a4",
  ok: "#5dff8a", "ok-soft": "#123620", warning: "#ffb84a", error: "#ff7a6a", "error-soft": "#3a1714",
  "loop-0": "#6fe3ff", "loop-1": "#ffd84a", "loop-2": "#ff8f6a", "loop-3": "#ff8fd0",
};
const phosphor: ThemeValues = {
  name: "phosphor",
  label: "Phosphor",
  use: "For terminals and dark dashboards. Fixed-width lettering on a dark screen, with gates in amber.",
  light: SCREEN,
  dark: SCREEN,
  face: MONO,
  rules: () =>
    // Every corner but the picture's own: the cards, the lanes, the pills. A stop, a person and a number keep theirs.
    `& g rect,&>rect[rx]{rx:2px;ry:2px}${STOP}{rx:16px;ry:16px}${PERSON}{rx:12px;ry:12px}& rect[rx="7.2"]{rx:7.2px;ry:7.2px}` +
    `${GATE}{stroke-width:2.2}` +
    // Fixed-width throughout, so every line is closer and smaller (`TIGHT`): the bold ones by less, since they were
    // measured wider.
    `& text{${TIGHT}}` +
    `& text[font-size="17"]{font-size:16px}& text[font-size="13.5"]{font-size:12.25px}& text[font-size="12.5"]{font-size:11.25px}& text[font-size="12"]{font-size:11px}` +
    `& text[font-size="11.5"]{font-size:9.75px}& text[font-size="11"]{font-size:9px}& text[font-size="10.5"]{font-size:8.5px}& text[font-size="10"]{font-size:8px}` +
    `& text[font-size="11"][font-weight="700"]{font-size:10.5px}& text[font-size="10.5"][font-weight="700"]{font-size:9.75px}& text[font-size="10"][font-weight="700"]{font-size:9.5px}` +
    `& text[font-size="9.5"]{font-size:8.75px}& text[font-size="9"]{font-size:8.25px}` +
    `${KIND}{text-transform:uppercase;letter-spacing:.06em}`,
  defs: (c, id) => `<pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0,.5H3" fill="none" stroke-width="1" style="stroke:${c("surface-2")}"/></pattern>`,
  ground: true,
  canvas: { radius: 2, stop: 16, border: 1, gate: 2.2, edge: 1.5, caps: 0.1 },
};

const transit: ThemeValues = {
  name: "transit",
  label: "Transit",
  use: "For talks and posters seen from across a room. Edges are thick route lines and each loop keeps its own color.",
  // prettier-ignore
  light: {
    bg: "#ffffff", surface: "#ffffff", "surface-2": "#eef1f5", ink: "#0f1b2d", "ink-2": "#26344a", "ink-3": "#4a5a72",
    line: "#d5dbe4", "line-strong": "#0f1b2d", accent: "#0f1b2d", "accent-soft": "#e3e9f2",
    gate: "#b04f00", "gate-soft": "#fdeed9", check: "#0057b8", merge: "#6b3fb0", stop: "#0f1b2d",
    ok: "#007a4d", "ok-soft": "#dbf2e6", warning: "#8f5200", error: "#c4281c", "error-soft": "#fde7e4",
    "loop-0": "#d7261e", "loop-1": "#007a4d", "loop-2": "#b85300", "loop-3": "#b0178a",
    route: "#0057b8",
  },
  // prettier-ignore
  dark: {
    bg: "#0d1524", surface: "#121c2e", "surface-2": "#1a2740", ink: "#f3f6fb", "ink-2": "#cfd8e6", "ink-3": "#9fadc2",
    line: "#26344d", "line-strong": "#f3f6fb", accent: "#f3f6fb", "accent-soft": "#1f2e49",
    gate: "#ffab4a", "gate-soft": "#3a2a12", check: "#6db3ff", merge: "#b99cff", stop: "#f3f6fb",
    ok: "#5fd6a0", "ok-soft": "#143a2a", warning: "#ffc266", error: "#ff8a7d", "error-soft": "#3d1c19",
    "loop-0": "#ff6b5e", "loop-1": "#5fd6a0", "loop-2": "#ffab4a", "loop-3": "#f07ad0",
    route: "#6db3ff",
  },
  face: SANS,
  rules: (c) =>
    // The plain edges take the route's color. Their own is written on them, so the rule has to outrank it.
    `& [data-edge] [style="stroke:${c("ink-2")}"]{stroke:${c("route")}!important}& [data-edge] [style="fill:${c("ink-2")}"]{fill:${c("route")}!important}` +
    `${LINE}{stroke-width:4.5}` +
    `& [data-edge] path[stroke-dasharray="5 3"]{stroke-dasharray:10 5;stroke-linecap:butt}& [data-edge] path[stroke-dasharray="1.5 3"]{stroke-dasharray:.1 8}` +
    // The arrowheads, larger about their own middle. Only where that can be said: a renderer that knows `transform`
    // and not `transform-box` (the CLI's, for a PNG) would move each one across the picture.
    `@supports (transform-box:fill-box){& [data-edge] path+path,& [data-edge] circle+path{transform-box:fill-box;transform-origin:center;transform:scale(1.6)}}` +
    `& [data-edge] circle{r:4.2px;stroke:${c("bg")};stroke-width:1.5}` +
    `${CARD}{stroke-width:2.6}${GATE}{stroke-width:4.2}${PERSON}{stroke-width:3.4}` +
    `${PLAIN}{rx:22px;ry:22px}${STOP}{rx:5px;ry:5px}` +
    `${KIND}{text-transform:uppercase;letter-spacing:.08em}`,
  canvas: { radius: 22, stop: 5, border: 2.6, gate: 4.2, edge: 4.5, caps: 0.08 },
};

const chalk: ThemeValues = {
  name: "chalk",
  label: "Chalk",
  use: "For early drafts and teaching. Hand lettering and lines that wobble say the graph is still open to change.",
  // prettier-ignore
  light: {
    bg: "#f6f7f7", surface: "#fbfbfb", "surface-2": "#eceeee", ink: "#2a2e32", "ink-2": "#454a50", "ink-3": "#62686f",
    line: "#d5d8db", "line-strong": "#4a5057", accent: "#2456a6", "accent-soft": "#dfe8f6",
    gate: "#a94e08", "gate-soft": "#fbeedd", check: "#2456a6", merge: "#6a45b5", stop: "#62686f",
    ok: "#1c6b4a", "ok-soft": "#dcf0e6", warning: "#8a5200", error: "#a8261c", "error-soft": "#fbe6e3",
    "loop-0": "#7a3fb8", "loop-1": "#0e7584", "loop-2": "#b8430f", "loop-3": "#a82a66",
  },
  // prettier-ignore
  dark: {
    bg: "#26302e", surface: "#2a3533", "surface-2": "#313d3a", ink: "#f3f2ec", "ink-2": "#d9dcd5", "ink-3": "#b0b8b1",
    line: "#3d4a47", "line-strong": "#d9dcd5", accent: "#a8d8ff", "accent-soft": "#2f4652",
    gate: "#ffd28a", "gate-soft": "#4a4230", check: "#a8d8ff", merge: "#d9c2ff", stop: "#b0b8b1",
    ok: "#a6e8c0", "ok-soft": "#2c4a3c", warning: "#ffd28a", error: "#ffb0a6", "error-soft": "#4f3532",
    "loop-0": "#f5a8cc", "loop-1": "#9fe0d6", "loop-2": "#ffb48a", "loop-3": "#d9c2ff",
  },
  face: HAND,
  rules: () =>
    // The wobble is on the shapes and the lines, never on a word. A sequence's rows hold their words, so they keep still.
    `${CARD},& [data-edge],& [data-plate],& [data-lane]>rect,& [data-people]>rect,&[data-picture="map"] [data-handoff]{filter:url(#gp-chalk)}` +
    `${CARD}{stroke-width:1.5}${GATE}{stroke-width:2.6}` +
    `${LINE}{stroke-width:1.8}` +
    `& text{letter-spacing:.01em}`,
  defs: () =>
    `<filter id="gp-chalk"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>`,
  canvas: { radius: 9, stop: 16, border: 1.5, gate: 2.6, edge: 1.8 },
};

/** The five themes that are not Paper, by name. */
export const THEME_VALUES: Record<Exclude<PictureThemeName, "paper">, ThemeValues> = { blueprint, ink, phosphor, transit, chalk };

export const isPictureTheme = (name: string): name is PictureThemeName => (PICTURE_THEMES as readonly string[]).includes(name);

const FORMS: readonly string[] = ["light", "dark", "auto"];

/**
 * What `--theme` and a `theme=` in an address say: a theme by name, a form (`light`, `dark`, `auto`, which alone are
 * Paper in that form, as they always were), or both, as `chalk-dark`. Undefined when it is none of these.
 */
export function readTheme(value: string): { name: PictureThemeName; form?: PictureTheme } | undefined {
  if (FORMS.includes(value)) return { name: "paper", form: value as PictureTheme };
  const cut = value.lastIndexOf("-");
  const form = cut > 0 && FORMS.includes(value.slice(cut + 1)) ? (value.slice(cut + 1) as PictureTheme) : undefined;
  const name = form ? value.slice(0, cut) : value;
  return isPictureTheme(name) ? { name, ...(form ? { form } : {}) } : undefined;
}

/**
 * What a picture is handed to be drawn in a theme: `picture(doc, { look: pictureLook("blueprint") })`.
 * Undefined for Paper, and for a name that is none of the six: the picture is then today's.
 */
export function pictureLook(name: string | undefined): PictureLook | undefined {
  if (name === undefined || name === "paper" || !isPictureTheme(name)) return undefined;
  const t = (THEME_VALUES as Record<string, ThemeValues>)[name]!;
  const scope = `.grooph-picture[data-look="${t.name}"]`;
  const vars = (p: Palette): string => (Object.keys(p) as (keyof Palette)[]).map((k) => `--gp-${k}:${p[k]}`).join(";");
  // An id that says the form: of two pictures of one theme in one page, one light and one dark, each finds its own ground.
  const id = (theme: PictureTheme): string => `gp-${t.name}${theme === "auto" ? "" : `-${theme}`}`;
  return {
    name: t.name,
    light: t.light,
    dark: t.dark,
    head(theme) {
      const auto = theme === "auto";
      const palette = theme === "dark" ? t.dark : t.light;
      const c: Paint = auto ? (k) => `var(--gp-${k})` : (k) => palette[k] ?? "";
      // Inline in a page, a Paper picture's own rules for dark reach every picture there. A theme's must outrank them
      // wherever they apply, so a theme with one form says its colors a second time, for a picture that is not held
      // to light: that is the selector Paper's dark has, and one attribute more.
      const dark = `${scope}:not([data-theme="light"])`;
      const colors = !auto
        ? ""
        : t.dark === t.light
          ? `${scope},${dark}{${vars(t.light)}}`
          : `${scope}{${vars(t.light)}}@media (prefers-color-scheme:dark){${dark}{${vars(t.dark)}}}${scope}[data-theme="dark"]{${vars(t.dark)}}`;
      const face = t.face ? `${scope}{font-family:${t.face}}` : "";
      return `<style>${colors}${face}${t.rules(c).replaceAll("&", scope)}</style>` + (t.defs ? `<defs>${t.defs(c, id(theme))}</defs>` : "");
    },
    ...(t.ground ? { ground: (theme: PictureTheme) => `<rect width="100%" height="100%" fill="url(#${id(theme)})"/>` } : {}),
  };
}

export type { PictureLook };
