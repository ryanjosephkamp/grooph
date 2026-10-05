import { join } from "node:path";

import { CompileError, formatIssue, getProfile, isMapLike, parseGraphText, tryCompile, type CompileOptions, type CompileTarget, type Graph } from "@grooph/core";

import { readText, writeText } from "../io.js";
import { printIssues, printNext, plural, type Output } from "../print.js";

export type ExportFlags = { target: CompileTarget; into: string; models?: CompileOptions["models"]; modelsFrom?: string };

const TIERS = ["frontier", "strong", "fast"] as const;
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]*$/;

/**
 * The variable a machine names its tiers in, for each target. One for each harness, because a model's name is one
 * harness's: a map of Claude Code's models would otherwise be written into a Codex package, and the reverse
 * (decision 0030). `GROOPH_MODELS` is Claude Code's, as it was before there was a second target.
 */
export const MODELS_ENV: Record<CompileTarget, string> = { "claude-code": "GROOPH_MODELS", codex: "GROOPH_MODELS_CODEX" };

/**
 * What the tiers mean in this package, all three, and which the one exporting named, when they named any; then,
 * when two tiers a graph's agents use are one model, a line saying so. The validator's check that a critic differs
 * from the builder it checks (W_HOMOGENEOUS_CRITICS) reads tiers, so it cannot see two tiers that are the same model.
 * That happens when the one exporting names them so, and since handoff 0084 with nothing named: the target's own map
 * gives `strong` and `fast` one model.
 */
function tiersSaid(doc: Graph, target: CompileTarget, models: CompileOptions["models"], from: string): string[] {
  const stock = getProfile(target).models;
  const named = models ?? {};
  const means = (tier: (typeof TIERS)[number]): string => named[tier] ?? stock[tier];
  const lines = models ? [`tiers in this package: ${TIERS.map((tier) => `${tier} → ${means(tier)}${tier in named ? "" : " (the target's own)"}`).join(", ")}. Named by ${from}. A pin on a node still wins.`] : [];
  const used = new Set((doc.nodes ?? []).flatMap((node) => (node.kind === "agent" && node.model && !node.model.pin?.[target] ? [node.model.tier] : [])));
  const same = TIERS.flatMap((a, i) => TIERS.slice(i + 1).filter((b) => used.has(a) && used.has(b) && means(a) === means(b)).map((b) => `${a} and ${b} are both ${means(a)}`));
  if (same.length > 0) {
    lines.push(
      `note: ${same.join("; ")} in this package${models ? "" : ", by the target's own map"}, and this graph has agents on each. A critic and the builder it checks may ${models ? "now " : ""}share a model; the validator's check for that reads tiers and does not see it.${models ? "" : ` To keep them apart, name the tiers: --models, or ${MODELS_ENV[target]}.`}`,
    );
  }
  return lines;
}

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
    // A model's name goes into a file's frontmatter as written, so it is held to what a name is made of.
    if (!MODEL_NAME.test(model)) return { error: `the tier ${tier} needs a model name (letters, digits and . _ - : / [ ]): ${tier}=opus; tiers are separated by commas` };
    if (tier in models) return { error: `the tier ${tier} is named twice` };
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
 * `grooph export <file> --target <harness> --into <dir>`
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
  for (const line of tiersSaid(parsed.doc, flags.target, flags.models, flags.modelsFrom ?? "--models")) io.out(line);

  if (compiled.warnings.length > 0) {
    io.out("");
    io.out(`${plural(compiled.warnings.length, "warning")}, carried into the lead brief:`);
    for (const warning of compiled.warnings) io.out(`  ${formatIssue(warning)}`);
  }

  io.out("");
  io.out(`Kickoff — paste this into a ${getProfile(flags.target).title} session opened in ${flags.into}:`);
  io.out("");
  io.out(compiled.kickoff.trimEnd());
  printNext(io, `open a ${flags.target} session in ${flags.into} and paste the kickoff above`);
  return 0;
}
