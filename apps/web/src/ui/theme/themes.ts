/**
 * The pictures' themes in the app (handoff 0086; docs/themes.md), all of them: the five that are not Paper, the
 * list of six a person chooses from, the choice and where it is kept, and every way a screen takes a theme. It is
 * one piece of the app, fetched when a theme other than Paper was kept or is named in an address, or when a person
 * presses a control that offers the themes (decision 0021; `doc/look.ts` asks for it, and the page names it so the
 * service worker holds it for a visit with no network, `vite.config.ts`).
 *
 * Nothing else in the app knows there are themes. The screens draw Paper, as they always did, and this piece
 * dresses what they drew: it marks each picture, canvas, map frame and embed in the page with `data-look`, sets a
 * theme's ground into each picture, and carries one stylesheet whose rules are all kept to what is so marked. It
 * watches the page for what is drawn later. So an address in Paper runs none of this, and a screen needs no code
 * to be themed.
 *
 * So that fetching it moves nothing else, this file imports only core's themes, which import nothing, and builds
 * its list with the page's own elements. Its styles ride in the script: a stylesheet of its own would be asked for
 * at every address.
 */
import { PICTURE_THEMES, THEME_VALUES, themeParts, themed, themedPage, type PictureThemeName, type ThemeValues } from "@grooph/core/themes";

export type LookId = PictureThemeName;

/** Where the choice is kept. `doc/look.ts` reads the same place, to know whether to fetch this piece at all. */
const KEY = "groophPicture";
/** Each theme's swatch in the list. */
const SWATCH: Record<LookId, string> = { paper: "#1f5f4a", blueprint: "#24467e", ink: "#1c1c1c", phosphor: "#5dff8a", transit: "#0057b8", chalk: "#a94e08" };
export const labelOf = (id: LookId): string => (id === "paper" ? "Paper" : THEME_VALUES[id].label);
const known = (value: string | null | undefined): LookId | undefined => PICTURE_THEMES.find((id) => id === value);
const page = typeof document !== "undefined";

let chosen: LookId = (() => {
  try {
    return known(localStorage.getItem(KEY)) ?? "paper";
  } catch {
    return "paper";
  }
})();

/**
 * The theme an address names: the first `theme=` on a share link or an embed, a name alone or with `-light`,
 * `-dark` or `-auto` after it, as `--theme` takes it. A name that is none of the six is Paper. Undefined when the
 * address names no theme: `theme=dark` alone is an embed's light or dark, as it always was.
 */
export function lookNamed(hash: string): LookId | undefined {
  const value = /^#\/(?:open|embed)\?(?:[^&]*&)*?theme=([^&]*)/.exec(hash)?.[1]?.replace(/(?:^|-)(?:light|dark|auto)$/, "");
  return value ? (known(value) ?? "paper") : undefined;
}

/** The theme in effect here: the one the address names; else the one chosen, except in an embed, which is somebody else's page. */
export const lookNow = (hash: string = location.hash): LookId => lookNamed(hash) ?? (hash.startsWith("#/embed") ? "paper" : chosen);

/** An address without the theme it names: every `theme=` goes, and the rest stays as it was. */
export function withoutLook(hash: string): string {
  if (lookNamed(hash) === undefined) return hash;
  const [path, query = ""] = [hash.slice(0, hash.indexOf("?")), hash.slice(hash.indexOf("?") + 1)];
  const rest = query.split("&").filter((pair) => !pair.startsWith("theme="));
  return rest.length ? `${path}?${rest.join("&")}` : path;
}

/** Choose a theme for the pictures, keep the choice in this browser, and dress the page in it. */
export function choose(id: LookId): void {
  chosen = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* shown, not kept */
  }
  // A theme named in the address would bring the old one back on the next load. Only the part after the # is
  // touched: a ?theme= before it is the site's look.
  const hash = withoutLook(location.hash);
  if (hash !== location.hash) history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
  apply();
}

/**
 * The theme in effect, for Keep a copy: a picture core drew to follow the viewer, or an offline page, comes back in
 * the theme. Undefined in Paper, where the files are made as they always were.
 */
export function look(): { id: LookId; picture(svg: string, form: "light" | "dark"): string; page(html: string): string } | undefined {
  const id = lookNow();
  return id === "paper" ? undefined : { id, picture: (svg, form) => themed(svg, id, form), page: (html) => themedPage(html, id) };
}

// ─── the rules ────────────────────────────────────────────────────────────

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
  // A node the keyboard is on, that is picked or under the pointer, or that a replay has reached; one not reached
  // yet keeps the theme's own outline, dimmed.
  const marked = [`${node}:focus-visible`, `${node}.is-picked`, `${node}:hover`, ...["running", "passed", "failed", "halted"].map((state) => `${at}[data-replay] g[data-node][data-state="${state}"]`)];
  // After the states and as particular as they are, so the step a replay is on is the heaviest, as in Paper.
  const step = [`${at}[data-replay] g[data-node][data-focus]`];
  // Each said twice: for a card, and for a gate's card, whose own outline is the heavier in every theme.
  const weigh = (nodes: string[], more: number): string =>
    `${nodes.map((n) => `${n} rect[data-card]`).join(",")}{stroke-width:${Math.max(2.5, c.border + more)}px}` + `${nodes.map((n) => `${n} rect[data-card][stroke-width="1.8"]`).join(",")}{stroke-width:${Math.max(2.5, c.gate + more)}px}`;
  return (
    // A theme with one form says its colors where embed.css says dark's, and one attribute more, so it is the one
    // that holds whichever sheet comes later.
    (t.dark === t.light
      ? `${at},${at}:not([data-theme="light"]),${at}[data-theme]{${own(t.light)};background:var(--gx-bg)}`
      : `${at}{${own(t.light)};background:var(--gx-bg)}@media (prefers-color-scheme:dark){${at}:not([data-theme="light"]){${own(t.dark)}}}${at}[data-theme="dark"]{${own(t.dark)}}`) +
    weigh(marked, 0.9) +
    weigh(step, 1.9) +
    `${at}[data-replay] g[data-edge][data-focus] path:first-child{stroke-width:${Math.max(3, c.edge + 1.5)}px}`
  );
}

/**
 * The stylesheet: for each of the five, the rules a picture in it carries (core's, for a picture that follows the
 * viewer), then the canvas's, the map frame's and an embed's. And one rule for a control that offers the themes
 * in words: it says the one in effect after its own name, a little lighter, as a value beside its label.
 */
export const styles = (): string =>
  Object.values(THEME_VALUES)
    .map((t) => themeParts(t.name)!.css + canvasRules(t) + mapRules(t) + embedRules(t))
    .join("") + `[data-pictures][data-now]::after{content:attr(data-now);opacity:.72}`;

// ─── dressing the page ────────────────────────────────────────────────────

/** On what this piece set into a picture, so it can be taken out again. */
const SET = "data-of-look";

/** A picture the app drew, in Paper as it always is, put into a theme or back out of one. */
function dress(svg: SVGSVGElement, id: LookId | undefined): void {
  if (svg.dataset["look"] === id) return;
  svg.querySelector(`:scope > [${SET}]`)?.remove();
  if (!id) return void delete svg.dataset["look"];
  svg.dataset["look"] = id;
  // What the theme's rules refer to, and its ground, go in after the picture's own background, in the picture: so
  // they are colored by the picture's own variables, whichever of light and dark it is held to.
  const parts = themeParts(id)!;
  const more = `${parts.defs ? `<defs>${parts.defs}</defs>` : ""}${parts.ground}`;
  if (more) svg.querySelector(":scope > rect")?.insertAdjacentHTML("afterend", `<g ${SET}="">${more}</g>`);
}

/**
 * Dress everything in the page in the theme in effect, or undress it for Paper: each picture, each canvas's stage,
 * each map's frame and each embed, the controls that offer the themes, and the front page's recorded run, which is
 * an embed in a frame and takes its theme from its address. It changes only what is not already so, so it can be
 * called as often as the page changes.
 */
export function apply(): void {
  const now = lookNow();
  const id = now === "paper" ? undefined : now;
  for (const svg of document.querySelectorAll<SVGSVGElement>("svg.grooph-picture")) dress(svg, id);
  for (const el of document.querySelectorAll<HTMLElement>("main.stage,.map-picture,.gx")) {
    // A view in three dimensions is Paper in every theme, and whole (docs/themes.md). While a stage or a map's frame
    // holds one it is not dressed: a theme's variables would reach the view's own controls through it, and its
    // slider, which is the browser's, takes its color from one of them.
    const worn = el.querySelector('[data-picture="space"]') ? undefined : id;
    if (el.dataset["look"] !== worn) worn ? (el.dataset["look"] = worn) : delete el.dataset["look"];
  }
  // A list left open where it is no longer shown (at the dot, when a graph is turned to three dimensions by the
  // keyboard) is closed: nobody could see it to close it.
  if (opened && opened.host.getClientRects().length === 0) opened.shut();
  for (const el of document.querySelectorAll<HTMLElement>("[data-pictures]")) {
    el.style.setProperty("--dot", SWATCH[now]);
    // A control with words says the theme after them; one that is a dot alone says it in its name.
    const said = el.hasAttribute("aria-label") ? "aria-label" : "data-now";
    const words = said === "aria-label" ? `Picture theme: ${labelOf(now)}` : labelOf(now);
    if (el.getAttribute(said) !== words) el.setAttribute(said, words);
  }
  for (const frame of document.querySelectorAll<HTMLIFrameElement>("iframe.land-run-frame")) {
    const src = frame.getAttribute("src") ?? "";
    const named = src.replace(/&theme=[^&]*/, "") + (id ? `&theme=${id}` : "");
    if (named !== src) frame.setAttribute("src", named);
  }
}

// ─── the list ─────────────────────────────────────────────────────────────

const CHECK = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/** The list that is open, if one is: where it was opened, and how to close it. */
let opened: { at: Element; host: HTMLElement; shut: () => void } | undefined;

/**
 * Open the list of six at a control that offers the themes: a menu as the header's is, drawn by the header's own
 * rules (`.site-theme-list`), set beside the control. The arrows move, Enter or Space chooses, Escape closes and
 * gives the keyboard back; a press anywhere else closes it, and so does a second press on the control.
 */
export function open(at: Element): void {
  const same = opened?.at === at;
  opened?.shut();
  if (same) return;
  const host = (at.closest(".site-theme") ?? at.parentElement) as HTMLElement;
  // The header's entry is inside the site's own menu, which has closed: its button is the one this list belongs to
  // now, for the keyboard and for anyone told whether a menu is open.
  const button = host.querySelector<HTMLElement>(".site-theme-toggle") ?? (at as HTMLElement);
  const now = lookNow();
  const list = document.createElement("ul");
  list.className = "site-theme-list";
  list.setAttribute("role", "menu");
  list.setAttribute("aria-label", "Picture theme");
  list.innerHTML = PICTURE_THEMES.map(
    (id) => `<li role="none"><button type="button" role="menuitemradio" aria-checked="${id === now}" tabindex="-1" data-id="${id}"><span class="site-theme-dot" style="--dot:${SWATCH[id]}" aria-hidden="true"></span>${labelOf(id)}${CHECK}</button></li>`,
  ).join("");
  host.append(list);
  button.setAttribute("aria-expanded", "true");
  // Over a sheet that may cover the lower half of a canvas on a phone (--z-chrome is 40), while it is open; and no
  // taller than the room under it, so a short window scrolls the list and cuts nothing off. The dot on a canvas is
  // known by its name: where it stands is in a stylesheet (ui/canvas/look.css), not on the element.
  const over = host.classList.contains("look-dot");
  if (over) host.style.zIndex = "50";
  list.style.maxHeight = `${Math.max(140, innerHeight - list.getBoundingClientRect().top - 8)}px`;
  list.style.overflowY = "auto";
  const items = [...list.querySelectorAll("button")];
  // A press on the control itself is the control's to answer: it closes the list, above.
  const away = (e: Event): void => {
    if (!list.contains(e.target as Node) && !at.contains(e.target as Node)) close(false);
  };
  const close = (keyboard: boolean): void => {
    list.remove();
    document.removeEventListener("pointerdown", away);
    if (over) host.style.zIndex = "";
    button.setAttribute("aria-expanded", "false");
    opened = undefined;
    if (keyboard) button.focus();
  };
  opened = { at, host, shut: () => close(false) };
  list.addEventListener("click", (e) => {
    const item = (e.target as Element).closest("button");
    if (!item) return;
    choose(item.dataset["id"] as LookId);
    close(true);
  });
  list.addEventListener("keydown", (e) => {
    const here = items.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === "ArrowDown" ? (here + 1) % items.length : e.key === "ArrowUp" ? (here - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (to >= 0) {
      e.preventDefault();
      items[to]!.focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") close(false);
  });
  document.addEventListener("pointerdown", away);
  items[PICTURE_THEMES.indexOf(now)]!.focus();
}

// In a page, the rules are there from the moment the piece is, the page is dressed, and whatever is drawn later is
// dressed as it arrives. (A test reads this file with no page at all.)
if (page) {
  const sheet = document.createElement("style");
  sheet.textContent = styles();
  document.head.append(sheet);
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("hashchange", apply);
}
