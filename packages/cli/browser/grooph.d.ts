/**
 * grooph on a page: a graph or an operation map drawn inline as SVG, from its document, with nothing fetched.
 * https://ryanjosephkamp.github.io/grooph/docs/exports/#on-any-page-without-an-iframe
 */

export type Layout = "wide" | "phone";
/** A 3D still, of a graph or (the stairs) of a map; or a map's sequence. */
export type View = "stairs" | "panes" | "spiral" | "rings" | "columns" | "sequence";
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
export declare class GroophError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string);
}

/** The SVG of a graph or an operation map, given as its document or its JSON text. */
export declare function render(doc: unknown, options?: RenderOptions): Rendered;

export type Mounted = {
  /** Draw another document in the same place. */
  update(doc: unknown): void;
  /** Stop following the element's width, and empty it. */
  destroy(): void;
};

/** Below this width, in CSS pixels, a mounted drawing takes the phone layout. */
export declare const PHONE_BELOW: number;
/** From this width, in CSS pixels, a mounted drawing in the phone layout takes the wide one again. */
export declare const WIDE_FROM: number;

/** Draw into an element; an error is shown as text in the drawing's place. After `destroy`, nothing is drawn there again. */
export declare function mount(element: Element, doc: unknown, options?: RenderOptions): Mounted;

/** Draw every `<pre class="grooph">` and `<script type="application/grooph+json">` under `root` (the page by default). */
export declare function drawAll(options?: RenderOptions & { root?: ParentNode }): Mounted[];
