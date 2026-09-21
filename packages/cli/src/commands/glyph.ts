import { formatIssue, glyph, mermaid, parseGraphText } from "@grooph/core";

import { readText, writeText } from "../io.js";
import type { Output } from "../print.js";

export const GLYPH_HELP = `grooph glyph <graph file> [--out <svg file>] [--scale <n>]

The glyph of a graph: a small SVG of its shape with no words, the same picture the
app's template list, the compare cards and the pattern write-ups show. Node kinds
and role families are shapes (writer square, critic diamond, check hexagon, human
gate octagon, merge circle, stop dot; an irreversible step carries a bar), edges are
lines styled by their condition (pass solid, fail dashed, a verdict dotted, approval
doubled), a loop is a dashed hull with its back edges drawn returning. Deterministic:
the same document gives the same bytes. Colours are CSS variables with fallbacks, so
the file reads on its own and inline in either theme.

Prints the SVG, or writes it with --out. --scale multiplies the width and height
attributes (the viewBox is unchanged). Uses the document's own layout when it has
one, otherwise a layered layout, left to right.`;

export const MERMAID_HELP = `grooph mermaid <graph file> [--out <file>]

A Mermaid projection of a graph (spec §6): a flowchart LR with one subgraph per loop
(nested when loops nest), node labels shaped by kind and role family, edge labels
from the edge's condition and approval, a loop's back edges dotted, and a note per
stop. One way only: Mermaid has no loops, stops, bars or brakes, so this text cannot
be read back into a document, and its header says so. Edit the graph document, never
the projection.

Prints the text, or writes it with --out.`;

type Flags = { out?: string; scale?: number };

function load(io: Output, file: string) {
  const parsed = parseGraphText(readText(file));
  if (!parsed.doc) {
    io.err(`grooph: ${file} is not a graph document`);
    for (const issue of parsed.issues) io.err(formatIssue(issue));
  }
  return parsed.doc;
}

/** `grooph glyph <file> [--out <svg>] [--scale <n>]`. Exit 1 when the file is not a graph document. */
export function glyphCommand(io: Output, file: string, flags: Flags = {}): number {
  const doc = load(io, file);
  if (!doc) return 1;
  const svg = glyph(doc, flags.scale !== undefined ? { scale: flags.scale } : {});
  if (flags.out !== undefined) {
    writeText(flags.out, `${svg}\n`);
    io.out(`wrote ${flags.out}`);
    return 0;
  }
  io.out(svg);
  return 0;
}

/** `grooph mermaid <file> [--out <file>]`. Exit 1 when the file is not a graph document. */
export function mermaidCommand(io: Output, file: string, flags: Flags = {}): number {
  const doc = load(io, file);
  if (!doc) return 1;
  const text = mermaid(doc);
  if (flags.out !== undefined) {
    writeText(flags.out, text);
    io.out(`wrote ${flags.out}`);
    return 0;
  }
  io.out(text.replace(/\n$/, ""));
  return 0;
}
