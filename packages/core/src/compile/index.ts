/**
 * `compile(doc, target)` — the whole export path.
 *
 * Spec §9: an invalid graph fails export with named reasons. Compilers are pure
 * (`docs/ARCHITECTURE.md`): placing files on disk is a shell concern.
 */

import { hasErrors, type Issue } from "../issues.js";
import { KNOWN_TARGETS } from "../targets/index.js";
import { validate } from "../validate.js";
import type { Graph, Tier } from "../types.js";
import { compileClaudeCode } from "./claude-code/index.js";

export type CompileTarget = "claude-code";

export type CompileResult = {
  /** path relative to the project root → file contents */
  files: Record<string, string>;
  /** the single prompt that starts the run */
  kickoff: string;
  warnings: Issue[];
};

/**
 * What the one exporting may say beside the document.
 *
 * `models` says which model a tier means, for this export only: a project that does not use the model the target
 * gives a tier names its own. A pin on a node still wins, as it says so in the document. The document does not change.
 */
export type CompileOptions = {
  models?: Partial<Record<Tier, string>>;
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

/**
 * The folders under `.grooph/` that grooph keeps for something else. A package lives in `.grooph/<graph id>/`, so a
 * graph with one of these ids would be placed among the saved graphs, the proposal sets, the templates, the events
 * or the hooks; and the graph a package keeps would sit where a saved graph may be written by anyone.
 */
const KEPT_FOLDERS: Record<string, string> = {
  graphs: "saved graphs",
  proposals: "proposal sets",
  templates: "the project's templates",
  events: "what the event hook records",
  hooks: "the event hook",
};

/**
 * Why a graph with this id is not exported, as one sentence, or undefined when it is. Not a rule of the document
 * (it has no code, and `validate` does not know it): a fact about where a package is placed. It is here so the
 * command line, the MCP tool and the app refuse in the same words.
 */
export function keptFolder(id: string): string | undefined {
  return Object.hasOwn(KEPT_FOLDERS, id)
    ? `A graph with the id "${id}" is not exported: its package would be placed in .grooph/${id}/, the folder grooph keeps ${KEPT_FOLDERS[id]} in.`
    : undefined;
}

export function compile(doc: Graph, target: CompileTarget, options: CompileOptions = {}): CompileResult {
  const issues = validate(doc, { forExport: true });
  if (hasErrors(issues)) throw new CompileError(issues);

  const warnings = issues.filter((issue) => issue.severity === "warning");

  switch (target) {
    case "claude-code": {
      const pkg = compileClaudeCode(doc, warnings, options);
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
  options: CompileOptions = {},
): { ok: true; result: CompileResult } | { ok: false; issues: Issue[] } {
  try {
    return { ok: true, result: compile(doc, target, options) };
  } catch (err) {
    if (err instanceof CompileError) return { ok: false, issues: err.issues };
    throw err;
  }
}
