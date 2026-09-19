/**
 * `grooph` — the command line shell around `@grooph/core`.
 *
 * Core is pure; this package reads and writes files (`docs/ARCHITECTURE.md`).
 * Exit codes: 0 fine · 1 the document is wrong, or the invocation is · 2 a crash.
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { KNOWN_TARGETS, TemplateError, type CompileTarget } from "@grooph/core";

import { applyCommand } from "./commands/apply.js";
import { canonicalizeCommand } from "./commands/canonicalize.js";
import { exportCommand } from "./commands/export.js";
import { newCommand } from "./commands/new.js";
import { pickCommand, PICK_HELP } from "./commands/pick.js";
import { shapeCommand, SHAPE_HELP } from "./commands/shape.js";
import { shareCommand, SHARE_HELP } from "./commands/share.js";
import { templateCommand, TEMPLATE_USAGE } from "./commands/template-args.js";
import { validateCommand } from "./commands/validate.js";
import { stdio, type Output } from "./print.js";
import { RegistryError, defaultRegistryEnv, type RegistryEnv } from "./registry.js";
import { openUrl, type OpenUrl } from "./share-io.js";

/** What a run may reach outside its arguments; tests replace any of it. */
export type CliEnv = RegistryEnv & { openUrl: OpenUrl };

export const VERSION = "0.0.0";

const USAGE = `grooph ${VERSION} — build, check and compile graph documents into prompt packages.

Usage
  grooph new --name <name> [--goal <goal>] [--target <harness>] [--out <file>] [--force]
  grooph apply <file> --ops <ops.json | -> [--write] [--for-export] [--json]
  grooph validate <file> [--for-export] [--json]
  grooph canonicalize <file> [--write]
  grooph export <file> --target <harness> --into <dir>
  grooph shape <file> [--json]
  grooph share <graph | proposal set> [--base <url>] [--open] [--out <file>]
  grooph pick <proposal set> <candidate id | label> --out <graph file> [--force]
  grooph template list | show | use | insert | save | add …   (grooph template help)
  grooph <command> --help
  grooph --version

Commands
  new            Write a minimal canonical document: the id is the name's slug, no nodes yet.
                 Prints it, or writes --out (refusing to overwrite without --force).
  apply          Apply a JSON list of document operations ({"op": "addNode", ...}; the list is
                 in packages/core/README.md) read from a file, or from stdin with --ops -.
                 All or nothing: an op that cannot apply is named and nothing is written.
                 Prints the resulting issues; --write saves the result in canonical form
                 (never a result that fails the schema). Exits 1 while errors remain.
  validate       Check a document against the schema and the rules in docs/graph-ir.md §3.
                 Any graph document works, a run's working copy included. Exits 1 when
                 there are errors. --for-export also applies the export-only rules
                 (E_NO_TARGET, E_NO_GOAL); --json prints the issue list as JSON.
                 A proposal set is not a graph: grooph share checks one.
  canonicalize   Print the document in canonical form (graph-ir §7), or rewrite it with --write.
  export         Validate for export, then write the harness package into <dir> and print the
                 kickoff prompt. Refuses, with the reasons, when the document has errors.
  shape          Counts and brakes at a glance: agents, gates, loops, worst-case rounds, budgets.
  share          A link that opens a graph, or a proposal set of candidate graphs to compare, in
                 the app on any device. The document rides in the link; nothing is uploaded.
  pick           Write the chosen candidate of a proposal set out as a graph, ready to export.
  template       Reusable graphs and fragments by name: the built-in pattern library, your own
                 in .grooph/templates/ and ~/.grooph/templates/, and published registries.

Targets
  ${KNOWN_TARGETS.join(", ")}

grooph never runs a graph. The harness session is the runtime.`;

export async function run(
  argv: string[],
  io: Output = stdio,
  readStdin: () => string = () => readFileSync(0, "utf8"),
  env: Partial<CliEnv> = {},
): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    io.out(USAGE);
    return command === undefined ? 1 : 0;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    io.out(VERSION);
    return 0;
  }

  if (command !== "template" && (rest.includes("--help") || rest.includes("-h"))) {
    io.out(COMMAND_HELP[command] ?? USAGE);
    return 0;
  }

  try {
    switch (command) {
      case "new": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: {
            name: { type: "string" },
            goal: { type: "string" },
            target: { type: "string" },
            out: { type: "string" },
            force: { type: "boolean" },
          },
        });
        if (positionals.length > 0) return usageError(io, `new takes no positional arguments; did you mean --name "${positionals.join(" ")}"?`);
        const name = values["name"];
        if (name === undefined || name.trim() === "") return usageError(io, "new needs --name: grooph new --name <name>");
        if (values["target"] !== undefined && values["target"].trim() === "") return usageError(io, "--target needs a harness id");
        return newCommand(io, {
          name,
          ...(values["goal"] !== undefined ? { goal: values["goal"] } : {}),
          ...(values["target"] !== undefined ? { target: values["target"] } : {}),
          ...(values["out"] !== undefined ? { out: values["out"] } : {}),
          force: values["force"] === true,
        });
      }

      case "apply": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: {
            ops: { type: "string" },
            write: { type: "boolean" },
            "for-export": { type: "boolean" },
            json: { type: "boolean" },
          },
        });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "apply needs a file: grooph apply <file> --ops <ops.json | ->");
        const ops = values["ops"];
        if (ops === undefined) return usageError(io, "apply needs --ops <ops.json>, or --ops - to read the list from stdin");
        return applyCommand(
          io,
          file,
          { ops, write: values["write"] === true, forExport: values["for-export"] === true, json: values["json"] === true },
          readStdin,
        );
      }

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

      case "shape": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { json: { type: "boolean" } } });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "shape needs a file: grooph shape <graph file>");
        return shapeCommand(io, file, { json: values["json"] === true });
      }

      case "share": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { base: { type: "string" }, open: { type: "boolean" }, out: { type: "string" } },
        });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "share needs a file: grooph share <graph | proposal set> (grooph share --help)");
        if (values["base"] !== undefined && !/^(https?|file):\/\//.test(values["base"])) {
          return usageError(io, `--base must be an http(s) or file URL, like http://localhost:4173/grooph/; got "${values["base"]}"`);
        }
        return await shareCommand(
          io,
          file,
          {
            ...(values["base"] !== undefined ? { base: values["base"] } : {}),
            open: values["open"] === true,
            ...(values["out"] !== undefined ? { out: values["out"] } : {}),
          },
          env.openUrl ?? openUrl,
        );
      }

      case "pick": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { out: { type: "string" }, force: { type: "boolean" } },
        });
        const [file, ...name] = positionals;
        if (file === undefined || name.length === 0) {
          return usageError(io, "pick needs a proposal set and a candidate: grooph pick <proposal set> <candidate id | label> --out <graph file>");
        }
        const out = values["out"];
        if (out === undefined) return usageError(io, "pick needs --out <graph file>, for example .grooph/graphs/<graph-id>.grooph.json");
        return pickCommand(io, file, name.join(" "), { out, force: values["force"] === true });
      }

      case "template": {
        const outcome = await templateCommand(io, rest, { ...defaultRegistryEnv(), ...env });
        if (typeof outcome === "number") return outcome;
        io.err(`grooph: ${outcome.usage}`);
        io.err("");
        io.err(TEMPLATE_USAGE);
        return 1;
      }

      default:
        return usageError(io, `unknown command "${command}"`);
    }
  } catch (err) {
    if (err instanceof RegistryError || err instanceof TemplateError) {
      io.err(`grooph: ${err.message}`);
      return 1;
    }
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

/** `grooph <command> --help`: the command's own page where it has one, else the overview. */
const COMMAND_HELP: Record<string, string> = {
  share: SHARE_HELP,
  pick: PICK_HELP,
  shape: SHAPE_HELP,
};

function usageError(io: Output, message: string): number {
  io.err(`grooph: ${message}`);
  io.err("");
  io.err(USAGE);
  return 1;
}
