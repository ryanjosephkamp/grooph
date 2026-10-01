import { estimateShape, formatIssue, isMapLike, mapShape, mapShapeLine, parseGraphText, parseMapText, shapeLine, tierLine } from "@grooph/core";

import { readText } from "../io.js";
import type { Output } from "../print.js";

export const SHAPE_HELP = `grooph shape <graph file> [--json]

The structure of a graph at a glance (docs/executive.md §1): agents, checks, gates, loops,
tiers, the worst-case number of loop rounds (nested loops multiplied; unknown when a loop
has no max-iterations stop) and each loop's budget. Counts and brakes, no dollar figures.
--json prints the shape as data.

For an operation map (*.grooph-map.json): lanes, sessions, handoffs, and how many of the
handoffs a person carries.`;

/** `grooph shape <file> [--json]`. Exit 1 when the file is not a graph document. */
export function shapeCommand(io: Output, file: string, flags: { json?: boolean } = {}): number {
  const text = readText(file);
  const asMap = (() => {
    try {
      return isMapLike(JSON.parse(text)) ? parseMapText(text) : undefined;
    } catch {
      return undefined;
    }
  })();
  if (asMap) {
    if (!asMap.map) {
      io.err(`grooph: ${file} is not an operation map grooph can read`);
      for (const issue of asMap.issues) io.err(formatIssue(issue));
      return 1;
    }
    const shape = mapShape(asMap.map);
    io.out(flags.json === true ? JSON.stringify(shape, null, 2) : `${asMap.map.id}: ${mapShapeLine(shape)}`);
    return 0;
  }
  const parsed = parseGraphText(text);
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
