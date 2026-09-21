import { glyph, type Graph } from "@grooph/core";
import { useMemo } from "react";

/**
 * The glyph of a graph (slice 0015), inline so the theme's colours apply:
 * core draws it, byte for byte what `grooph glyph` prints and what the
 * pattern write-ups show. Wordless; the graph's name is its `<title>`.
 * `decorative` hides it from assistive technology, for a row whose name is
 * written right beside it.
 */
export function Glyph({ doc, className, decorative = false }: { doc: Graph; className?: string; decorative?: boolean }) {
  const svg = useMemo(() => glyph(doc), [doc]);
  return <span className={`glyph${className ? ` ${className}` : ""}`} aria-hidden={decorative || undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
}
