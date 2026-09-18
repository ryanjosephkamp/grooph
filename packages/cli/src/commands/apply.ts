import { applyOps, canonicalize, formatOpError, hasErrors, parseGraph, parseGraphText, validate } from "@grooph/core";

import { readText, writeText } from "../io.js";
import { plural, printIssues, type Output } from "../print.js";

export type ApplyFlags = { ops: string; write?: boolean; forExport?: boolean; json?: boolean };

/**
 * `grooph apply <file> --ops <ops.json | -> [--write] [--for-export] [--json]`
 *
 * Applies a JSON list of document operations (packages/core/README.md) through
 * `applyOps`, then validates the result and prints its issues.
 *
 * - An op that cannot apply: its error, exit 1, nothing written.
 * - A result that fails the schema: its `E_SCHEMA` issues, exit 1, nothing
 *   written — so every file grooph writes can be read by the next `apply`.
 * - Otherwise, with `--write`, the file is rewritten in canonical form even
 *   when rule errors remain (a graph can be built in steps); the exit code is
 *   1 while there are errors, as for `validate`. Without `--write` nothing is
 *   written.
 */
export function applyCommand(io: Output, file: string, flags: ApplyFlags, readStdin: () => string): number {
  const report = (payload: Record<string, unknown>): void => {
    if (flags.json === true) io.out(JSON.stringify({ file, ...payload }, null, 2));
  };

  const parsed = parseGraphText(readText(file));
  if (!parsed.doc) {
    if (flags.json === true) report({ ok: false, written: false, issues: parsed.issues });
    else {
      io.err(`cannot apply ops to ${file}: it does not match the schema; fix it by hand, or start again with grooph new`);
      printIssues(io, parsed.issues, file);
    }
    return 1;
  }

  const source = flags.ops === "-" ? "stdin" : flags.ops;
  let ops: unknown;
  try {
    ops = JSON.parse(flags.ops === "-" ? readStdin() : readText(flags.ops));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw err;
    return opsProblem(io, flags, report, `${source} is not valid JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(ops)) {
    return opsProblem(io, flags, report, `${source} must hold a JSON list of ops, like [{"op": "addNode", "kind": "agent", "name": "Builder"}]`);
  }

  const result = applyOps(parsed.doc, ops);
  if (!result.ok) {
    if (flags.json === true) report({ ok: false, written: false, error: result.error });
    else {
      io.err(`grooph: ${formatOpError(result.error)}`);
      io.err(`no op was applied and ${file} is unchanged`);
    }
    return 1;
  }

  const schema = parseGraph(JSON.parse(canonicalize(result.doc)));
  if (!schema.doc) {
    if (flags.json === true) report({ ok: false, written: false, ids: result.ids, issues: schema.issues });
    else {
      io.err(`the ops applied, but the result does not match the schema, so ${file} is unchanged:`);
      printIssues(io, schema.issues, file);
    }
    return 1;
  }

  const issues = validate(schema.doc, { forExport: flags.forExport === true });
  const written = flags.write === true;
  if (written) writeText(file, canonicalize(schema.doc));

  if (flags.json === true) {
    report({ ok: !hasErrors(issues), written, applied: ops.length, ids: result.ids, issues });
  } else {
    printIssues(io, issues, file);
    io.out(
      written
        ? `applied ${plural(ops.length, "op")}; wrote ${file}`
        : `applied ${plural(ops.length, "op")}; ${file} not written (dry run — pass --write to save)`,
    );
  }
  return hasErrors(issues) ? 1 : 0;
}

function opsProblem(io: Output, flags: ApplyFlags, report: (p: Record<string, unknown>) => void, message: string): number {
  if (flags.json === true) report({ ok: false, written: false, error: { index: -1, op: "", message } });
  else io.err(`grooph: ${message}`);
  return 1;
}
