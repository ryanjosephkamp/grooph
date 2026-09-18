/**
 * `compile(doc, target)` — the whole export path.
 *
 * Spec §9: an invalid graph fails export with named reasons. Compilers are pure
 * (`docs/ARCHITECTURE.md`): placing files on disk is a shell concern.
 */

import { hasErrors, type Issue } from "../issues.js";
import { KNOWN_TARGETS } from "../targets/index.js";
import { validate } from "../validate.js";
import type { Graph } from "../types.js";
import { compileClaudeCode } from "./claude-code/index.js";

export type CompileTarget = "claude-code";

export type CompileResult = {
  /** path relative to the project root → file contents */
  files: Record<string, string>;
  /** the single prompt that starts the run */
  kickoff: string;
  warnings: Issue[];
};

/** Thrown when the document does not validate for export. */
export class CompileError extends Error {
  readonly issues: Issue[];
  constructor(issues: Issue[]) {
    const errors = issues.filter((issue) => issue.severity === "error");
    super(
      `cannot export: ${errors.length} validation error${errors.length === 1 ? "" : "s"} — ${errors
        .map((issue) => issue.code)
        .join(", ")}`,
    );
    this.name = "CompileError";
    this.issues = issues;
  }
}

export function compile(doc: Graph, target: CompileTarget): CompileResult {
  const issues = validate(doc, { forExport: true });
  if (hasErrors(issues)) throw new CompileError(issues);

  const warnings = issues.filter((issue) => issue.severity === "warning");

  switch (target) {
    case "claude-code": {
      const pkg = compileClaudeCode(doc, warnings);
      return { files: pkg.files, kickoff: pkg.kickoff, warnings };
    }
    default: {
      const unknown: never = target;
      throw new Error(`unknown compile target "${String(unknown)}"; known targets: ${KNOWN_TARGETS.join(", ")}`);
    }
  }
}

/** Non-throwing form, for shells that would rather branch than catch. */
export function tryCompile(
  doc: Graph,
  target: CompileTarget,
): { ok: true; result: CompileResult } | { ok: false; issues: Issue[] } {
  try {
    return { ok: true, result: compile(doc, target) };
  } catch (err) {
    if (err instanceof CompileError) return { ok: false, issues: err.issues };
    throw err;
  }
}
