import { hasErrors, parseGraphText, validate } from "@grooph/core";

import { readText } from "../io.js";
import { printIssues, type Output } from "../print.js";

export type ValidateFlags = { forExport?: boolean; json?: boolean };

/** `grooph validate <file>` — exit 1 when the document has errors. */
export function validateCommand(io: Output, file: string, flags: ValidateFlags = {}): number {
  const parsed = parseGraphText(readText(file));
  const issues = parsed.doc ? validate(parsed.doc, { forExport: flags.forExport === true }) : parsed.issues;

  if (flags.json === true) {
    io.out(JSON.stringify({ file, ok: !hasErrors(issues), issues }, null, 2));
  } else {
    printIssues(io, issues, file);
  }
  return hasErrors(issues) ? 1 : 0;
}
