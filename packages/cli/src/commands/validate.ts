import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { byHandLines, hasErrors, isMapLike, isProposalSetLike, mapShape, mapShapeLine, parseGraphText, parseMapText, validate, validateMap } from "@grooph/core";

import { readText } from "../io.js";
import { printIssues, printNext, type Output } from "../print.js";
import { onlyAPlansLacks } from "./plan.js";

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
    else io.err(`grooph: ${message}`);
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
    const shape = parsed.map ? mapShape(parsed.map) : undefined;
    if (flags.json === true) io.out(JSON.stringify({ file, ok: !hasErrors(issues), kind: "map", issues, ...(shape ? { byHand: shape.byHand } : {}) }, null, 2));
    else {
      if (parsed.map && shape) io.out(`${parsed.map.id}: ${mapShapeLine(shape)}`);
      printIssues(io, issues, file);
      // Said after the issues and never counted among them (docs/operation-map.md §3).
      if (shape) for (const line of byHandLines(shape)) io.out(line);
    }
    return hasErrors(issues) ? 1 : 0;
  }

  const parsed = parseGraphText(text);
  const issues = parsed.doc ? validate(parsed.doc, { forExport: flags.forExport === true }) : parsed.issues;

  if (flags.json === true) {
    io.out(JSON.stringify({ file, ok: !hasErrors(issues), issues }, null, 2));
  } else {
    printIssues(io, issues, file);
    // A graph with a person's step, asked whether a package could be made of it: where that step is all that stands
    // in the way, it is nothing to repair, and the next thing is the plan (as the tools say it).
    if (parsed.doc && onlyAPlansLacks(issues)) printNext(io, `this graph has a step that is a person's, so it is a plan, and none of that is a fault of one: grooph plan ${file}`);
    else if (hasErrors(issues)) printNext(io, `fix what is listed (docs/rules.md explains each code), then grooph validate ${flags.forExport === true ? "--for-export " : ""}${file}`);
    else if (flags.forExport === true) printNext(io, `grooph export ${file} --target <harness> --into .`);
    else printNext(io, `grooph validate --for-export ${file}`);
  }
  return hasErrors(issues) ? 1 : 0;
}
