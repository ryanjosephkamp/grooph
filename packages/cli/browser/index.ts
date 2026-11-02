/**
 * grooph on a page: a graph or an operation map drawn inline as SVG, from its document, with no frame, no server and
 * nothing fetched. It is core's own drawing, as `grooph image` makes it, built for a browser by `scripts/browser.mjs`
 * into an ES module and a script that sets one `grooph` global (docs/exports.md, "On any page, without an iframe").
 *
 *   render(doc, options)          → { svg, width, height }, or a thrown GroophError with a code
 *   mount(element, doc, options)  → draws into the element, picks the phone layout below 640 pixels and the wide
 *                                   one again from 680, redraws when it changes, and shows an error as text;
 *                                   { update(doc), destroy() }
 *   drawAll(options)              → mounts every <pre class="grooph"> and <script type="application/grooph+json">
 */

import {
  STILL_VIEWS,
  mapPicture,
  mapSequence,
  mapStill,
  mapWide,
  overLimit,
  parseGraph,
  parseMap,
  picture,
  readTheme,
  still,
  themed,
  type Graph,
  type IssueLike,
  type OperationMap,
  type StillView,
} from "@grooph/core";

export type Layout = "wide" | "phone";
/** A 3D still, of a graph or (the stairs) of a map; or a map's sequence. */
export type View = StillView | "sequence";
export type RenderOptions = {
  /** `paper` (the default), `blueprint`, `ink`, `phosphor`, `transit` or `chalk`, optionally `-light` or `-dark`; or `light`, `dark`, `auto` */
  theme?: string;
  /** `phone`, 400 units wide, or `wide`: a map's lanes side by side, and a 3D still 800 units wide. A graph's flat picture has one layout. */
  layout?: Layout;
  view?: View;
};
export type Rendered = { svg: string; width: number; height: number };
export type ErrorCode = "bad-json" | "not-grooph" | "too-large" | "bad-option";

/** What `render` throws: a `code` to act on, and a message in plain words, to show as text and never as HTML: it can quote the document. */
export class GroophError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "GroophError";
    this.code = code;
  }
}

const VIEWS: readonly string[] = [...STILL_VIEWS, "sequence"];
const first = (issues: readonly IssueLike[]): string => (issues[0] ? issues[0].message : "it does not match the document's schema");

/** The SVG of a graph or an operation map, given as its document or its JSON text. */
export function render(doc: unknown, options: RenderOptions = {}): Rendered {
  let json = doc;
  if (typeof doc === "string") {
    try {
      json = JSON.parse(doc);
    } catch (err) {
      throw new GroophError("bad-json", `This is not JSON, so there is no grooph document in it: ${(err as Error).message}`);
    }
  }
  const kind = json !== null && typeof json === "object" && !Array.isArray(json) ? ("groophMap" in json ? "map" : "grooph" in json ? "graph" : undefined) : undefined;
  if (kind === undefined) throw new GroophError("not-grooph", 'This is not a grooph document: a graph starts with "grooph": 0 and an operation map with "groophMap": 0.');
  const over = overLimit(json, kind);
  if (over) throw new GroophError("too-large", `This ${kind === "map" ? "operation map" : "graph"} is too large to draw: ${over.message}.`);

  const asked = readTheme(options.theme ?? "paper");
  if (!asked) throw new GroophError("bad-option", `There is no theme "${String(options.theme)}": paper, blueprint, ink, phosphor, transit or chalk, or light, dark or auto.`);
  if (options.layout !== undefined && options.layout !== "wide" && options.layout !== "phone") throw new GroophError("bad-option", `The layout is wide or phone, not "${String(options.layout)}".`);
  const view = options.view;
  if (view !== undefined && !VIEWS.includes(view)) throw new GroophError("bad-option", `There is no view "${String(view)}": ${VIEWS.join(", ")}.`);
  if (view === "sequence" && kind !== "map") throw new GroophError("bad-option", "The sequence is a view of an operation map; this is a graph.");
  if (view !== undefined && view !== "sequence" && view !== "stairs" && kind === "map") throw new GroophError("bad-option", `A map has the stairs in three dimensions, not ${view}.`);

  // A theme is added to the picture core draws to follow the viewer, as `grooph image` does.
  const drawn = { theme: asked.name !== "paper" ? ("auto" as const) : (asked.form ?? "auto") };
  const form = asked.form ?? "auto";
  let svg: string;
  if (kind === "map") {
    const parsed = parseMap(json);
    if (!parsed.map) throw new GroophError("not-grooph", `This is not an operation map grooph can draw: ${first(parsed.issues)}.`);
    const map: OperationMap = parsed.map;
    svg = view === "stairs" ? mapStill(map, { ...drawn, layout: options.layout ?? "wide" }) : view === "sequence" ? mapSequence(map, drawn) : (options.layout === "wide" ? mapWide : mapPicture)(map, drawn);
  } else {
    const parsed = parseGraph(json);
    if (!parsed.doc) throw new GroophError("not-grooph", `This is not a graph grooph can draw: ${first(parsed.issues)}.`);
    const graph: Graph = parsed.doc;
    svg = view !== undefined ? still(graph, { ...drawn, view: view as StillView, layout: options.layout ?? "wide" }) : picture(graph, drawn);
  }
  if (asked.name !== "paper") svg = themed(svg, asked.name, form);
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  return { svg, width: Number(box?.[1] ?? 0), height: Number(box?.[2] ?? 0) };
}

export type Mounted = {
  /** Draw another document in the same place. */
  update(doc: unknown): void;
  /** Stop following the element's width, and empty it. */
  destroy(): void;
};

/** Below this width, in CSS pixels, a mounted drawing takes the phone layout. */
export const PHONE_BELOW = 640;
/**
 * From this width a drawing in the phone layout takes the wide one again. The gap keeps a drawing from flipping
 * back and forth at one width, as when the taller phone drawing brings a scroll bar that narrows the element.
 */
export const WIDE_FROM = 680;

/**
 * Draw into an element. The SVG is parsed and appended as an element, never set as HTML. An error is shown as text
 * in the drawing's place (a `<p class="grooph-error" role="alert">`). With no layout given, the phone layout is
 * taken while the element is narrower than `PHONE_BELOW`, and the wide one again from `WIDE_FROM`; an element with
 * no width (hidden) keeps the layout it has. After `destroy`, nothing is drawn there again.
 */
export function mount(element: Element, doc: unknown, options: RenderOptions = {}): Mounted {
  let current = doc;
  let layout: Layout | undefined;
  let gone = false;
  const page = element.ownerDocument;
  const fits = (): Layout => {
    if (options.layout) return options.layout;
    const width = element.clientWidth;
    if (width <= 0) return layout ?? "wide";
    return width < (layout === "phone" ? WIDE_FROM : PHONE_BELOW) ? "phone" : "wide";
  };
  const draw = (): void => {
    if (gone) return;
    layout = fits();
    try {
      const { svg } = render(current, { ...options, layout });
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
      const root = parsed.documentElement;
      if (root.nodeName !== "svg" || parsed.getElementsByTagName("parsererror").length > 0) throw new Error("The drawing could not be read as SVG.");
      const node = page.importNode(root, true) as unknown as SVGSVGElement;
      node.style.maxWidth = "100%";
      node.style.height = "auto";
      element.replaceChildren(node);
    } catch (err) {
      const said = page.createElement("p");
      said.className = "grooph-error";
      said.setAttribute("role", "alert");
      said.textContent = err instanceof Error ? err.message : String(err);
      element.replaceChildren(said);
    }
  };
  draw();
  const watcher = options.layout === undefined && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => void (fits() !== layout && draw())) : undefined;
  watcher?.observe(element);
  return {
    update(next) {
      current = next;
      draw();
    },
    destroy() {
      gone = true;
      watcher?.disconnect();
      element.replaceChildren();
    },
  };
}

/**
 * Draw every `<pre class="grooph">` and `<script type="application/grooph+json">` under `root` (the page by default),
 * each holding a document's JSON: each is replaced by a `<div class="grooph">` with the drawing in it. A script
 * keeps the JSON exactly as written; a `<pre>` is read as its text. `data-theme`, `data-layout` and `data-view` on
 * either set its options over those given here. Call it once the page is read; it draws only what it finds then.
 */
export function drawAll(options: RenderOptions & { root?: ParentNode } = {}): Mounted[] {
  const { root = document, ...given } = options;
  return [...root.querySelectorAll('pre.grooph, script[type="application/grooph+json"]')].map((found) => {
    const holder = found.ownerDocument.createElement("div");
    holder.className = "grooph";
    const data = (found as HTMLElement).dataset;
    const own: RenderOptions = {
      ...given,
      ...(data["theme"] ? { theme: data["theme"] } : {}),
      ...(data["layout"] ? { layout: data["layout"] as Layout } : {}),
      ...(data["view"] ? { view: data["view"] as View } : {}),
    };
    const text = found.textContent ?? "";
    found.replaceWith(holder);
    return mount(holder, text, own);
  });
}
