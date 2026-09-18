/**
 * `grooph` — the command line shell around `@grooph/core`.
 *
 * Core is pure; this package reads and writes files (`docs/ARCHITECTURE.md`).
 * Exit codes: 0 fine · 1 the document is wrong, or the invocation is · 2 a crash.
 */

import { parseArgs } from "node:util";

import { KNOWN_TARGETS, type CompileTarget } from "@grooph/core";

import { canonicalizeCommand } from "./commands/canonicalize.js";
import { exportCommand } from "./commands/export.js";
import { validateCommand } from "./commands/validate.js";
import { stdio, type Output } from "./print.js";

export const VERSION = "0.0.0";

const USAGE = `grooph ${VERSION} — compile a graph document into a prompt package.

Usage
  grooph validate <file> [--for-export] [--json]
  grooph canonicalize <file> [--write]
  grooph export <file> --target <harness> --into <dir>
  grooph help | --help
  grooph --version

Commands
  validate       Check a document against the schema and the rules in docs/graph-ir.md §3.
                 Exits 1 when there are errors. --for-export also applies the export-only
                 rules (E_NO_TARGET, E_NO_GOAL); --json prints the issue list as JSON.
  canonicalize   Print the document in canonical form (graph-ir §7), or rewrite it with --write.
  export         Validate for export, then write the harness package into <dir> and print the
                 kickoff prompt. Refuses, with the reasons, when the document has errors.

Targets
  ${KNOWN_TARGETS.join(", ")}

grooph never runs a graph. The harness session is the runtime.`;

export async function run(argv: string[], io: Output = stdio): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    io.out(USAGE);
    return command === undefined ? 1 : 0;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    io.out(VERSION);
    return 0;
  }

  try {
    switch (command) {
      case "validate": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { "for-export": { type: "boolean" }, json: { type: "boolean" } },
        });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "validate needs a file: grooph validate <file>");
        return validateCommand(io, file, {
          forExport: values["for-export"] === true,
          json: values["json"] === true,
        });
      }

      case "canonicalize": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { write: { type: "boolean" } },
        });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "canonicalize needs a file: grooph canonicalize <file> [--write]");
        return canonicalizeCommand(io, file, { write: values["write"] === true });
      }

      case "export": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { target: { type: "string" }, into: { type: "string" } },
        });
        const file = positionals[0];
        if (file === undefined) {
          return usageError(io, "export needs a file: grooph export <file> --target <harness> --into <dir>");
        }
        const target = values["target"];
        if (target === undefined) return usageError(io, `export needs --target (${KNOWN_TARGETS.join(", ")})`);
        if (!KNOWN_TARGETS.includes(target)) {
          return usageError(io, `unknown target "${target}"; known targets: ${KNOWN_TARGETS.join(", ")}`);
        }
        const into = values["into"];
        if (into === undefined) return usageError(io, "export needs --into <dir>, the project to write the package into");
        return exportCommand(io, file, { target: target as CompileTarget, into });
      }

      default:
        return usageError(io, `unknown command "${command}"`);
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      io.err(`no such file: ${error.path ?? "(unknown)"}`);
      return 1;
    }
    if (error.name === "TypeError" && /Unknown option|Option/.test(error.message)) {
      return usageError(io, error.message);
    }
    io.err(`grooph: ${error.message}`);
    return 2;
  }
}

function usageError(io: Output, message: string): number {
  io.err(`grooph: ${message}`);
  io.err("");
  io.err(USAGE);
  return 1;
}
