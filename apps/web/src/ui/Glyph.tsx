import { glyph, type Graph } from "@grooph/core";

/** A drawing wider than this (in the glyph's own units, 60 per rank) is a sliver in a thumbnail box: five ranks or more in a row. */
const LONG = 300;

const drawn = new WeakMap<Graph, { svg: string; long: boolean }>();
function draw(doc: Graph): { svg: string; long: boolean } {
  let d = drawn.get(doc);
  if (!d) {
    const svg = glyph(doc);
    const width = Number(/viewBox="\S+ \S+ (\S+) \S+"/.exec(svg)?.[1] ?? 0);
    d = { svg, long: width > LONG };
    drawn.set(doc, d);
  }
  return d;
}

/**
 * Whether a graph's glyph is too long for a thumbnail beside a row's text (review item 13: `gauntlet-decomposed`
 * drew at a seventh of its size). A row gives such a glyph a band of its own, the row's full width, above the text.
 */
export const hasLongGlyph = (doc: Graph): boolean => draw(doc).long;

/**
 * The glyph of a graph (slice 0015), inline so the theme's colors apply:
 * core draws it, byte for byte what `grooph glyph` prints and what the
 * pattern write-ups show. Wordless; the graph's name is its `<title>`.
 * `decorative` hides it from assistive technology, for a row whose name is
 * written right beside it.
 */
export function Glyph({ doc, className, decorative = false }: { doc: Graph; className?: string; decorative?: boolean }) {
  return <GlyphDrawn {...draw(doc)} className={className} decorative={decorative} />;
}

/**
 * A glyph from a drawing already made: what `Glyph` writes, for a place that has the drawing and not the graph
 * (the front page's tiles, drawn ahead of time; `landing/front.generated.ts`).
 */
export function GlyphDrawn({ svg, long, className, decorative = false }: { svg: string; long: boolean; className?: string | undefined; decorative?: boolean }) {
  return (
    <span
      className={`glyph${className ? ` ${className}` : ""}${long ? " is-long" : ""}`}
      aria-hidden={decorative || undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
