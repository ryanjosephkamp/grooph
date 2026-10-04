/**
 * The five themes that are not Paper (handoff 0086; docs/themes.md), as a piece of the app fetched when one is
 * chosen or named in an address (decision 0021): `doc/look.ts` asks for it, and the page names it so the service
 * worker holds it for a visit with no network (`vite.config.ts`).
 *
 * So that fetching it moves nothing else, this file imports only core's themes, which import nothing. Its styles
 * ride in the script, for the same reason a map's views' do: a stylesheet of its own would be asked for at every
 * address.
 *
 * A picture is handed a theme and carries it (`pictureLook`). The canvas is not a picture: it is drawn by the app's
 * own styles from the app's own variables, which have the pictures' names. So here the same values are written as
 * those variables, for the canvas of a screen that says which theme it is in (`.stage[data-look]`), for the marks
 * the map screen draws on a picture (`.map-picture[data-look]`), and for the bars and the ground of an embed
 * (`.gx[data-look]`).
 */
import { THEME_VALUES, pictureLook, type PictureLook, type ThemeValues } from "@grooph/core/themes";

const made = new Map<string, PictureLook | undefined>();

/** A theme as a picture is handed it, the same object every time, so a picture is drawn again only when the theme changes. */
export function look(id: string): PictureLook | undefined {
  if (!made.has(id)) made.set(id, pictureLook(id));
  return made.get(id);
}

type Palette = ThemeValues["light"];

const declare = (pairs: (readonly [string, string])[]): string => pairs.map(([name, value]) => `--${name}:${value}`).join(";");

/**
 * Whether a theme has one ink. The app adds marks of its own over a picture and on the canvas (what is selected,
 * where the keyboard is, an error, a run's states), and tells them apart by color. A theme with one ink has no
 * color to tell them by, so those marks keep the site's: Ink is for the picture, and the app's marks are not part
 * of it.
 */
const oneInk = (p: Palette): boolean => p.ok === p["line-strong"];

/**
 * The color of a mark the app draws on a picture by recoloring a card's outline: a picked session, the keyboard's
 * place. The theme's green, as the site's accent is green: a theme's own accent may be the very color its cards
 * are outlined in (Transit, Blueprint), and a mark in it would not be seen. Undefined for a theme with one ink.
 */
const mark = (p: Palette): string | undefined => (oneInk(p) ? undefined : p.ok);

/** A theme's colors as the app's variables: the canvas's nodes, edges, labels and ground read these. */
const variables = (p: Palette): string =>
  declare([
    // prettier-ignore
    ...([
      ["bg", p.bg], ["surface", p.surface], ["surface-2", p["surface-2"]], ["ink", p.ink], ["ink-2", p["ink-2"]], ["ink-3", p["ink-3"]],
      ["line", p.line], ["line-strong", p["line-strong"]], ["dots", p.line], ["edge", p.route ?? p["ink-2"]],
      ["kind-agent", p.accent], ["kind-human-gate", p.gate], ["kind-check", p.check], ["kind-merge", p.merge], ["kind-stop", p.stop],
      ["loop-0", p["loop-0"]], ["loop-1", p["loop-1"]], ["loop-2", p["loop-2"]], ["loop-3", p["loop-3"]],
    ] as const),
    // prettier-ignore
    ...(oneInk(p) ? [] : ([
      ["accent", p.accent], ["accent-ink", p.bg], ["accent-soft", p["accent-soft"]], ["focus", p.ok], ["highlight", p.gate],
      ["error", p.error], ["error-soft", p["error-soft"]], ["warning", p.warning], ["warning-soft", p["gate-soft"]], ["ok", p.ok], ["ok-soft", p["ok-soft"]],
    ] as const)),
  ]) + `;color:${p.ink}`;

/** Each form of a theme under its own condition: light as written, dark where the device is dark (a theme with one form has no second). */
const forms = (t: ThemeValues, rule: (p: Palette) => string): string => rule(t.light) + (t.dark === t.light ? "" : `@media (prefers-color-scheme:dark){${rule(t.dark)}}`);

/**
 * The canvas in a theme: the colors on the canvas, on the loops' legend that floats over it and on the words of an
 * empty one, and the theme's corners, outlines, edge weight and lettering on the nodes. Those sit inside
 * `:where()`, so they never outrank what a node's state says about it: selected, in a run, with an error.
 *
 * A state that the app says by weight is another matter: a theme's edges and outlines may be heavier than the
 * app's emphasis (Transit's edges are 4.5, a selected edge 3), and the emphasized one would come out the thinner.
 * So each of those is said again here, a step above the theme's own weight.
 */
function canvasRules(t: ThemeValues): string {
  const at = `.stage[data-look="${t.name}"]`;
  const on = `${at} .react-flow,${at} .loop-legend,${at} .empty-canvas`;
  const c = t.canvas;
  return (
    forms(t, (p) => `${on}{${variables(p)}}`) +
    (t.face ? `:where(${at}) .react-flow{font-family:${t.face}}` : "") +
    `:where(${at}) .gnode{border-radius:${c.radius}px;border-width:${c.border}px}` +
    `:where(${at}) .gnode-stop{border-radius:${c.stop}px}` +
    `:where(${at}) .gnode-human-gate{border-width:${c.gate}px;border-color:var(--kind-human-gate)}` +
    `:where(${at}) .gedge-line{stroke-width:${c.edge}}` +
    (c.radius < 9 ? `:where(${at}) .gedge-label{border-radius:${c.radius}px}` : "") +
    (c.caps ? `:where(${at}) .gnode-kind{text-transform:uppercase;letter-spacing:${c.caps}em}` : "") +
    (c.labelFace ? `:where(${at}) .gnode-kind,:where(${at}) .gnode-sub{font-family:${c.labelFace}}` : "") +
    `${at} .gedge.is-selected .gedge-line,${at} .gedge.is-highlighted .gedge-line,${at} .gedge.is-picked .gedge-line{stroke-width:${Math.max(3, c.edge + 1.5)}}` +
    `${at} .gnode.run-halted{border-width:${Math.max(2, c.border + 0.8)}px}${at} .gnode-human-gate.run-halted{border-width:${Math.max(2, c.gate)}px}`
  );
}

/**
 * The marks the app draws on a map's picture (`.map-picture`, styles.css): a picked or focused card is outlined in
 * `--accent`, a picked row is filled with `--accent-soft`. On a themed picture those are the theme's green and the
 * ground its lanes have, on which every color a row's words are drawn in is held to 4.5 to 1; and the outline is a
 * step heavier than the theme's own heaviest, so it is seen by weight too.
 */
function mapRules(t: ThemeValues): string {
  const at = `.map-picture[data-look="${t.name}"]`;
  const heavy = Math.max(t.canvas.border, 1.4) + 1.4;
  return (
    forms(t, (p) => `${at}{${declare([...(mark(p) ? [["accent", mark(p)!] as const] : []), ["accent-soft", p["surface-2"]]])}}`) +
    `${at} :is([data-session],[data-person]):is(.is-on,:focus-visible)>rect[data-card]{stroke-width:${heavy}}`
  );
}

/**
 * An embed in a theme: its own variables (embed.css), and the theme's ground behind the picture and its bars. An
 * embed in Paper lets the page around it show through; a theme's words are colored for the theme's own ground, so a
 * themed embed brings that ground with it. The keyboard's place, a picked node and a node's state in a replay are
 * said by an outline's color and weight: the color is the theme's green, and the weights are a step above the
 * theme's own.
 */
function embedRules(t: ThemeValues): string {
  const at = `.gx[data-look="${t.name}"]`;
  const own = (p: Palette): string =>
    declare([
      ...(["bg", "surface", "surface-2", "ink", "ink-2", "ink-3", "line", "line-strong", "accent", "ok", "error", "gate", "loop-0", "loop-1", "loop-2", "loop-3"] as const).map((name) => [`gx-${name}`, p[name]] as const),
      ...(mark(p) ? [["gx-focus", mark(p)!] as const] : []),
    ]);
  const node = `${at} .gx-canvas g[data-node]`;
  const c = t.canvas;
  return (
    `${at}{${own(t.light)};background:var(--gx-bg)}` +
    (t.dark === t.light ? "" : `@media (prefers-color-scheme:dark){${at}:not([data-theme="light"]){${own(t.dark)}}}${at}[data-theme="dark"]{${own(t.dark)}}`) +
    `${node}:focus-visible rect[data-card],${node}.is-picked rect[data-card],${node}:hover rect[data-card],` +
    // A node that has been reached; one not reached yet keeps the theme's own outline, dimmed.
    `${["running", "passed", "failed", "halted"].map((state) => `${at}[data-replay] g[data-node][data-state="${state}"] rect[data-card]`).join(",")}{stroke-width:${Math.max(2.5, c.border + 0.9)}px}` +
    // After the states and as particular as they are, so the step a replay is on is the heaviest, as in Paper.
    `${at}[data-replay] g[data-node][data-focus] rect[data-card]{stroke-width:${Math.max(3.5, c.border + 1.9)}px}` +
    `${at}[data-replay] g[data-edge][data-focus] path:first-child{stroke-width:${Math.max(3, c.edge + 1.5)}px}`
  );
}

/** The five themes' rules for the canvas, for the app's marks on a map's picture and for an embed, as one stylesheet. */
export const styles = (): string =>
  Object.values(THEME_VALUES)
    .map((t) => canvasRules(t) + mapRules(t) + embedRules(t))
    .join("");

// In a page, the rules are there from the moment the piece is. (A test reads `styles()` with no page at all.)
if (typeof document !== "undefined") {
  const sheet = document.createElement("style");
  sheet.textContent = styles();
  document.head.append(sheet);
}
