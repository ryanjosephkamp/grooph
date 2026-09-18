import { canonicalize, parseGraphText } from "@grooph/core";

import { readText, writeText } from "../io.js";
import { printIssues, type Output } from "../print.js";

/** `grooph canonicalize <file> [--write]` — canonical form on stdout, or in place. */
export function canonicalizeCommand(io: Output, file: string, flags: { write?: boolean } = {}): number {
  const original = readText(file);
  const parsed = parseGraphText(original);
  if (!parsed.doc) {
    printIssues(io, parsed.issues, file);
    return 1;
  }

  const canonical = canonicalize(parsed.doc);
  if (flags.write !== true) {
    process.stdout.write(canonical);
    return 0;
  }

  if (canonical === original) {
    io.out(`${file} is already canonical`);
    return 0;
  }
  writeText(file, canonical);
  io.out(`${file} rewritten in canonical form`);
  return 0;
}
