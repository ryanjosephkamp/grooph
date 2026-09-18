import { join } from "node:path";

import { CompileError, formatIssue, parseGraphText, tryCompile, type CompileTarget } from "@grooph/core";

import { readText, writeText } from "../io.js";
import { printIssues, plural, type Output } from "../print.js";

export type ExportFlags = { target: CompileTarget; into: string };

/**
 * `grooph export <file> --target claude-code --into <dir>`
 *
 * Refuses with the error list when the document does not validate for export
 * (spec §9), writes the package files, then prints the kickoff prompt.
 */
export function exportCommand(io: Output, file: string, flags: ExportFlags): number {
  const parsed = parseGraphText(readText(file));
  if (!parsed.doc) {
    io.err(`cannot export ${file}: it is not a graph document`);
    printIssues(io, parsed.issues, file);
    return 1;
  }

  let compiled;
  try {
    const attempt = tryCompile(parsed.doc, flags.target);
    if (!attempt.ok) {
      io.err(`cannot export ${file} for ${flags.target}: fix these first`);
      printIssues(io, attempt.issues, file);
      return 1;
    }
    compiled = attempt.result;
  } catch (err) {
    if (err instanceof CompileError) {
      printIssues(io, err.issues, file);
      return 1;
    }
    io.err(`cannot export ${file}: ${(err as Error).message}`);
    return 2;
  }

  const paths = Object.keys(compiled.files);
  for (const path of paths) writeText(join(flags.into, path), compiled.files[path]!);

  io.out(`wrote ${plural(paths.length, "file")} into ${flags.into}`);
  for (const path of paths) io.out(`  ${path}`);

  if (compiled.warnings.length > 0) {
    io.out("");
    io.out(`${plural(compiled.warnings.length, "warning")}, carried into the lead brief:`);
    for (const warning of compiled.warnings) io.out(`  ${formatIssue(warning)}`);
  }

  io.out("");
  io.out(`Kickoff — paste this into a Claude Code session opened in ${flags.into}:`);
  io.out("");
  io.out(compiled.kickoff.trimEnd());
  return 0;
}
