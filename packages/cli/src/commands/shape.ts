import { estimateShape, formatIssue, parseGraphText, shapeLine, tierLine } from "@grooph/core";

import { readText } from "../io.js";
import type { Output } from "../print.js";

export const SHAPE_HELP = `grooph shape <graph file> [--json]

The structure of a graph at a glance (docs/executive.md §1): agents, checks, gates, loops,
tiers, the worst-case number of loop rounds (nested loops multiplied; unknown when a loop
has no max-iterations stop) and each loop's budget. Counts and brakes, no dollar figures.
--json prints the shape as data.`;

/** `grooph shape <file> [--json]`. Exit 1 when the file is not a graph document. */
export function shapeCommand(io: Output, file: string, flags: { json?: boolean } = {}): number {
  const parsed = parseGraphText(readText(file));
  if (!parsed.doc) {
    io.err(`grooph: ${file} is not a graph document`);
    for (const issue of parsed.issues) io.err(formatIssue(issue));
    return 1;
  }
  const shape = estimateShape(parsed.doc);
  if (flags.json === true) {
    io.out(JSON.stringify(shape, null, 2));
    return 0;
  }
  io.out(`${parsed.doc.id}: ${shapeLine(shape)}`);
  if (shape.agents > 0) io.out(`tiers: ${tierLine(shape)}`);
  return 0;
}
