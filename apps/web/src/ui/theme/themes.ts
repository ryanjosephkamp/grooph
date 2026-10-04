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
 * those variables, for the canvas of a screen that says which theme it is in (`.stage[data-look]`), and for the
 * bars and the ground of an embed that does (`.gx[data-look]`).
 */
import { THEME_VALUES, pictureLook, type PictureLook, type ThemeValues } from "@grooph/core/themes";

const made = new Map<string, PictureLook | undefined>();

/** A theme as a picture is handed it, the same object every time, so a picture is drawn again only when the theme changes. */
export function look(id: string): PictureLook | undefined {
  if (!made.has(id)) made.set(id, pictureLook(id));
  return made.get(id);
}

type Palette = ThemeValues["light"];

/** A theme's colors as the app's variables: the canvas's nodes, edges, labels and ground read these. */
const variables = (p: Palette): string =>
  // prettier-ignore
  [
    ["bg", p.bg], ["surface", p.surface], ["surface-2", p["surface-2"]], ["ink", p.ink], ["ink-2", p["ink-2"]], ["ink-3", p["ink-3"]],
    ["line", p.line], ["line-strong", p["line-strong"]], ["dots", p.line], ["edge", p.route ?? p["ink-2"]],
    ["accent", p.accent], ["accent-ink", p.bg], ["accent-soft", p["accent-soft"]], ["focus", p.accent], ["highlight", p.gate],
    ["error", p.error], ["error-soft", p["error-soft"]], ["warning", p.warning], ["warning-soft", p["gate-soft"]], ["ok", p.ok], ["ok-soft", p["ok-soft"]],
    ["kind-agent", p.accent], ["kind-human-gate", p.gate], ["kind-check", p.check], ["kind-merge", p.merge], ["kind-stop", p.stop],
    ["loop-0", p["loop-0"]], ["loop-1", p["loop-1"]], ["loop-2", p["loop-2"]], ["loop-3", p["loop-3"]],
  ].map(([name, value]) => `--${name}:${value}`).join(";") + `;color:${p.ink}`;

/**
 * The canvas in a theme: the colors on the canvas and on the loops' legend that floats over it, and the theme's
 * corners, outlines, edge weight and lettering on the nodes. Written inside `:where()`, so a rule here never
 * outranks what a node's state says about it: selected, in a run, with an error.
 */
function canvasRules(t: ThemeValues): string {
  const at = `.stage[data-look="${t.name}"]`;
  const on = `${at} .react-flow,${at} .loop-legend`;
  const c = t.canvas;
  return (
    `${on}{${variables(t.light)}}` +
    (t.dark === t.light ? "" : `@media (prefers-color-scheme:dark){${on}{${variables(t.dark)}}}`) +
    (t.face ? `:where(${at}) .react-flow{font-family:${t.face}}` : "") +
    `:where(${at}) .gnode{border-radius:${c.radius}px;border-width:${c.border}px}` +
    `:where(${at}) .gnode-stop{border-radius:${c.stop}px}` +
    `:where(${at}) .gnode-human-gate{border-width:${c.gate}px;border-color:var(--kind-human-gate)}` +
    `:where(${at}) .gedge-line{stroke-width:${c.edge}}` +
    (c.radius < 9 ? `:where(${at}) .gedge-label{border-radius:${c.radius}px}` : "") +
    (c.caps ? `:where(${at}) .gnode-kind{text-transform:uppercase;letter-spacing:${c.caps}em}` : "") +
    (c.labelFace ? `:where(${at}) .gnode-kind,:where(${at}) .gnode-sub{font-family:${c.labelFace}}` : "")
  );
}

/**
 * An embed in a theme: its own variables (embed.css), and the theme's ground behind the picture and its bars. An
 * embed in Paper lets the page around it show through; a theme's words are colored for the theme's own ground, so a
 * themed embed brings that ground with it.
 */
function embedRules(t: ThemeValues): string {
  const at = `.gx[data-look="${t.name}"]`;
  const own = (p: Palette): string =>
    (["bg", "surface", "surface-2", "ink", "ink-2", "ink-3", "line", "line-strong", "accent", "ok", "error", "gate", "loop-0", "loop-1", "loop-2", "loop-3"] as const).map((name) => `--gx-${name}:${p[name]}`).join(";") +
    `;--gx-focus:${p.accent}`;
  return (
    `${at}{${own(t.light)};background:var(--gx-bg)}` +
    (t.dark === t.light ? "" : `@media (prefers-color-scheme:dark){${at}:not([data-theme="light"]){${own(t.dark)}}}${at}[data-theme="dark"]{${own(t.dark)}}`)
  );
}

/** The five themes' rules for the canvas and for an embed, as one stylesheet. */
export const styles = (): string =>
  Object.values(THEME_VALUES)
    .map((t) => canvasRules(t) + embedRules(t))
    .join("");

// In a page, the rules are there from the moment the piece is. (A test reads `styles()` with no page at all.)
if (typeof document !== "undefined") {
  const sheet = document.createElement("style");
  sheet.textContent = styles();
  document.head.append(sheet);
}
