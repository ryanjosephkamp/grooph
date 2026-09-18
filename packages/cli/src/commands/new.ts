import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalize, newGraph } from "@grooph/core";

import { writeText } from "../io.js";
import type { Output } from "../print.js";

export type NewFlags = { name: string; goal?: string; target?: string; out?: string; force?: boolean };

/**
 * `grooph new --name <n> [--goal <g>] [--target <h>] [--out <file>] [--force]`
 *
 * A minimal canonical document: the id is the name's slug, version 1, no
 * nodes yet. Printed to stdout, or written to `--out` (never over an existing
 * file unless `--force`).
 */
export function newCommand(io: Output, flags: NewFlags): number {
  const doc = newGraph({
    name: flags.name,
    ...(flags.goal !== undefined ? { goal: flags.goal } : {}),
    ...(flags.target !== undefined ? { target: flags.target } : {}),
  });
  const text = canonicalize(doc);

  if (flags.out === undefined) {
    process.stdout.write(text);
    return 0;
  }
  if (existsSync(resolve(flags.out)) && flags.force !== true) {
    io.err(`grooph: ${flags.out} already exists; pass --force to overwrite it`);
    return 1;
  }
  writeText(flags.out, text);
  io.out(`wrote ${flags.out} (graph "${doc.id}")`);
  io.out(`next: grooph apply ${flags.out} --ops <ops.json> --write`);
  return 0;
}
