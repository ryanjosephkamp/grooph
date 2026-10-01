import { canonicalize, canonicalizeMap, isMapLike, parseGraphText, parseMapText } from "@grooph/core";

import { readText, writeText } from "../io.js";
import { printIssues, type Output } from "../print.js";

const isMap = (text: string): boolean => {
  try {
    return isMapLike(JSON.parse(text));
  } catch {
    return false;
  }
};

/** `grooph canonicalize <file> [--write]` — canonical form on stdout, or in place. */
export function canonicalizeCommand(io: Output, file: string, flags: { write?: boolean } = {}): number {
  const original = readText(file);
  let canonical: string;
  if (isMap(original)) {
    const parsed = parseMapText(original);
    if (!parsed.map) {
      printIssues(io, parsed.issues, file);
      return 1;
    }
    canonical = canonicalizeMap(parsed.map);
  } else {
    const parsed = parseGraphText(original);
    if (!parsed.doc) {
      printIssues(io, parsed.issues, file);
      return 1;
    }
    canonical = canonicalize(parsed.doc);
  }

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
