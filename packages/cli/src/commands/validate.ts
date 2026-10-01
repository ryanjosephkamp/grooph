import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { hasErrors, isMapLike, isProposalSetLike, mapShape, mapShapeLine, parseGraphText, parseMapText, validate, validateMap } from "@grooph/core";

import { readText } from "../io.js";
import { printIssues, type Output } from "../print.js";

export type ValidateFlags = { forExport?: boolean; json?: boolean };

const looksLike = (text: string, test: (json: unknown) => boolean): boolean => {
  try {
    return test(JSON.parse(text));
  } catch {
    return false;
  }
};
const parsesAsProposalSet = (text: string): boolean => looksLike(text, isProposalSetLike);

/** `grooph validate <file>` — exit 1 when the document has errors. */
export function validateCommand(io: Output, file: string, flags: ValidateFlags = {}): number {
  const text = readText(file);

  // A proposal set is not a graph: say so, and point to the command that checks one (review 0006, finding 5).
  if (parsesAsProposalSet(text)) {
    const message =
      `${file} is a proposal set, not a graph document, so validate does not check it. ` +
      `Run \`grooph share ${file}\` to check the set and every candidate in it and get the link to compare them, ` +
      `or \`grooph pick ${file} <candidate> --out <graph file>\` to write one candidate out and validate it on its own.`;
    if (flags.json === true) io.out(JSON.stringify({ file, ok: false, kind: "proposal-set", message, issues: [] }, null, 2));
    else io.err(message);
    return 1;
  }

  // An operation map has its own rules (docs/operation-map.md §3). A `graph` pointer that is a path is looked up beside the map.
  if (looksLike(text, isMapLike)) {
    const parsed = parseMapText(text);
    const issues = parsed.map
      ? validateMap(parsed.map, {
          resolveGraph: (ref) => {
            if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref) || !/\.json$/i.test(ref)) return undefined;
            const path = resolve(dirname(resolve(file)), ref);
            return existsSync(path) && parseGraphText(readText(path)).doc !== undefined;
          },
        })
      : parsed.issues;
    if (flags.json === true) io.out(JSON.stringify({ file, ok: !hasErrors(issues), kind: "map", issues }, null, 2));
    else {
      if (parsed.map) io.out(`${parsed.map.id}: ${mapShapeLine(mapShape(parsed.map))}`);
      printIssues(io, issues, file);
    }
    return hasErrors(issues) ? 1 : 0;
  }

  const parsed = parseGraphText(text);
  const issues = parsed.doc ? validate(parsed.doc, { forExport: flags.forExport === true }) : parsed.issues;

  if (flags.json === true) {
    io.out(JSON.stringify({ file, ok: !hasErrors(issues), issues }, null, 2));
  } else {
    printIssues(io, issues, file);
  }
  return hasErrors(issues) ? 1 : 0;
}
