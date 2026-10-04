import { join } from "node:path";

import { CompileError, formatIssue, isMapLike, parseGraphText, tryCompile, type CompileOptions, type CompileTarget } from "@grooph/core";

import { readText, writeText } from "../io.js";
import { printIssues, printNext, plural, type Output } from "../print.js";

export type ExportFlags = { target: CompileTarget; into: string; models?: CompileOptions["models"]; modelsFrom?: string };

const TIERS = ["frontier", "strong", "fast"] as const;

/**
 * `frontier=opus,strong=sonnet,fast=haiku` → which model each tier means for this export. A tier left out keeps the
 * target's own. Returns a message when the text is not that.
 */
export function parseModels(text: string): { models: NonNullable<CompileOptions["models"]> } | { error: string } {
  const models: NonNullable<CompileOptions["models"]> = {};
  for (const part of text.split(",").map((p) => p.trim()).filter((p) => p !== "")) {
    const at = part.indexOf("=");
    const tier = at < 0 ? part : part.slice(0, at).trim();
    const model = at < 0 ? "" : part.slice(at + 1).trim();
    if (!(TIERS as readonly string[]).includes(tier)) return { error: `"${tier}" is not a tier; the tiers are ${TIERS.join(", ")}` };
    if (model === "" || /\s/.test(model)) return { error: `the tier ${tier} needs a model name with no spaces: ${tier}=opus` };
    models[tier as (typeof TIERS)[number]] = model;
  }
  if (Object.keys(models).length === 0) return { error: "name at least one tier: frontier=opus,strong=sonnet,fast=haiku" };
  return { models };
}

const looksLikeMap = (text: string): boolean => {
  try {
    return isMapLike(JSON.parse(text));
  } catch {
    return false;
  }
};

/**
 * `grooph export <file> --target claude-code --into <dir>`
 *
 * Refuses with the error list when the document does not validate for export
 * (spec §9), writes the package files, then prints the kickoff prompt.
 */
export function exportCommand(io: Output, file: string, flags: ExportFlags): number {
  const text = readText(file);
  // Amendment A-011: a map is drawn and validated, never compiled. Say so, by name, before any schema path.
  if (looksLikeMap(text)) {
    io.err(
      `grooph: cannot export ${file}: it is an operation map, and a map is never compiled or run. ` +
        `Export the loop graph one of its sessions points at; draw the map with \`grooph image ${file}\` or share it with \`grooph share ${file}\`.`,
    );
    return 1;
  }
  const parsed = parseGraphText(text);
  if (!parsed.doc) {
    io.err(`grooph: cannot export ${file}: it is not a graph document`);
    printIssues(io, parsed.issues, file);
    return 1;
  }

  let compiled;
  try {
    const attempt = tryCompile(parsed.doc, flags.target, flags.models ? { models: flags.models } : {});
    if (!attempt.ok) {
      io.err(`grooph: cannot export ${file} for ${flags.target}: fix these first`);
      printIssues(io, attempt.issues, file);
      return 1;
    }
    compiled = attempt.result;
  } catch (err) {
    if (err instanceof CompileError) {
      printIssues(io, err.issues, file);
      return 1;
    }
    io.err(`grooph: cannot export ${file}: ${(err as Error).message}`);
    return 2;
  }

  const paths = Object.keys(compiled.files);
  for (const path of paths) writeText(join(flags.into, path), compiled.files[path]!);

  io.out(`wrote ${plural(paths.length, "file")} into ${flags.into}`);
  for (const path of paths) io.out(`  ${path}`);
  if (flags.models) {
    const said = Object.entries(flags.models).map(([tier, model]) => `${tier} → ${model}`).join(", ");
    io.out(`tiers: ${said} (${flags.modelsFrom ?? "--models"}); a tier not named keeps the target's own model, and a pin on a node still wins`);
  }

  if (compiled.warnings.length > 0) {
    io.out("");
    io.out(`${plural(compiled.warnings.length, "warning")}, carried into the lead brief:`);
    for (const warning of compiled.warnings) io.out(`  ${formatIssue(warning)}`);
  }

  io.out("");
  io.out(`Kickoff — paste this into a Claude Code session opened in ${flags.into}:`);
  io.out("");
  io.out(compiled.kickoff.trimEnd());
  printNext(io, `open a ${flags.target} session in ${flags.into} and paste the kickoff above`);
  return 0;
}
