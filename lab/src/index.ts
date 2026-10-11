/**
 * `grooph-lab`: the command of grooph's lab (decision 0032; `lab/README.md`).
 *
 * The lab is what directs a session: the compilers and their packages, brakes a run obeys, adoption, run folders.
 * It stays in the repository, builds and is tested, and is in nothing grooph publishes. Its command is a superset
 * of `grooph`: what has left the product is handled here, and every other command is the product's own, handed to
 * the product's `run()` exactly as it was typed.
 *
 * Here: `export`, `adopt`, `runs`, `watch` with a run to follow, and `share` and `embed` of a run folder, with the
 * pages `grooph --help` and `grooph help <command>` gave for them. Each case below is the one `grooph` had, moved.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { parseArgs } from "node:util";

import { KNOWN_TARGETS, PICTURE_THEMES, parseGraphText, readTheme, type CompileTarget } from "@grooph/core";

import { VERSION, run as grooph } from "@grooph/cli";
import { embedCommand } from "@grooph/cli/commands/embed";
import { MODELS_ENV, PLAN_STILL, exportCommand, parseModels } from "@grooph/cli/commands/export";
import { nearestCommand } from "@grooph/cli/commands/help";
import { shareCommand } from "@grooph/cli/commands/share";
import { parseSource } from "@grooph/cli/events-io";
import { stdio, type Output } from "@grooph/cli/print";
import { oneLine } from "@grooph/cli/reply";
import { LoadError, openUrl, type Loaded } from "@grooph/cli/share-io";

import { adoptCommand, ADOPT_HELP } from "./commands/adopt.js";
import { runsBundleCommand, runsListCommand, runsShowCommand, RUNS_HELP } from "./commands/runs.js";
import { watchCommand, WATCH_HELP } from "./commands/watch.js";
import { COMMANDS, EMBED_HELP, EXPORT_HELP, SHARE_HELP, overview } from "./help.js";
import { isRunDir, readRun } from "./run-io.js";

/** The product's own signature: the arguments, where output goes, standard input, and what a run may reach. */
export type Run = typeof grooph;

/** The pages the lab answers itself: of what left the product, and of the three commands that read a run folder here. */
const HELP: Record<string, string> = {
  export: EXPORT_HELP,
  adopt: ADOPT_HELP,
  runs: RUNS_HELP,
  watch: WATCH_HELP,
  share: SHARE_HELP,
  embed: EMBED_HELP,
};

/** What is not a command's name and is the product's to answer. */
const NOT_A_COMMAND: readonly string[] = ["help", "--help", "-h", "--version", "-v", "version"];

/**
 * A run folder, read into the bundle the product's `share` and `embed` take in place of a file; nothing for a file,
 * which is theirs to read. A folder that is not a run's is refused in the words it was.
 */
function runIn(file: string, takes: string): Loaded | undefined {
  if (!existsSync(file) || !statSync(file).isDirectory()) return undefined;
  if (!isRunDir(file)) throw new LoadError(`${file} is a folder but not a run folder; ${takes}`);
  return { kind: "run", doc: readRun(file).bundle };
}

export const run: Run = async (argv, io = stdio, readStdin = () => readFileSync(0, "utf8"), env = {}) => {
  const [command, ...rest] = argv;

  // The overview as it was, with the commands that left in it.
  if (command === undefined || (command === "help" && rest[0] === undefined) || command === "--help" || command === "-h") {
    io.out(overview(VERSION));
    return command === undefined ? 1 : 0;
  }
  // `help <command>` and `<command> --help`, for the pages the lab has.
  const about = command === "help" ? rest[0]! : command;
  if (!NOT_A_COMMAND.includes(about) && !(COMMANDS as readonly string[]).includes(about) && (command === "help" || command !== "template")) return unknownCommand(io, about);
  if (Object.hasOwn(HELP, about) && (command === "help" || rest.includes("--help") || rest.includes("-h"))) {
    io.out(HELP[about]!);
    return 0;
  }
  // Everything else is the product's, as typed.
  if (command === "help" || !Object.hasOwn(HELP, command)) return grooph(argv, io, readStdin, env);

  /** A wrong invocation: the message, the command's usage line, and where the full page is. */
  const usageError = (out: Output, message: string): number => {
    // The message echoes what was typed (an option, a target, a tier): one line, whatever it holds.
    out.err(oneLine(`grooph: ${message}`));
    out.err(`Usage: ${HELP[command]!.split("\n")[0]}`);
    out.err(`More: grooph help ${command}`);
    return 1;
  };

  try {
    switch (command) {
      case "export": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { target: { type: "string" }, into: { type: "string" }, models: { type: "string" }, "change-models": { type: "boolean" }, allow: { type: "string", multiple: true }, uncompared: { type: "boolean" } },
        });
        const file = positionals[0];
        if (file === undefined) {
          return usageError(io, "export needs a file: grooph export <file> --target <harness> --into <dir>");
        }
        const target = values["target"];
        // Which model a tier means, for this export: the flag, typed for this export whichever its target; or else
        // the machine's own map for this target's harness, so a machine can say it once. A machine's map names one
        // harness's models, so each target reads a variable of its own and never another's (decision 0030):
        // a map of Claude Code's models in GROOPH_MODELS does not reach a Codex package, nor the reverse.
        const modelsEnv = target !== undefined && Object.hasOwn(MODELS_ENV, target) ? MODELS_ENV[target as CompileTarget] : undefined;
        const fromEnv = modelsEnv === undefined ? undefined : (env.env ?? process.env)[modelsEnv];
        const modelsText = values["models"] ?? (fromEnv !== undefined && fromEnv.trim() !== "" ? fromEnv : undefined);
        const modelsFrom = values["models"] !== undefined ? "--models" : (modelsEnv ?? "--models");
        const tierMap = modelsText === undefined ? undefined : parseModels(modelsText);
        if (tierMap && "error" in tierMap) return usageError(io, `${modelsFrom}: ${tierMap.error}`);
        if (target === undefined) return usageError(io, `export needs --target (${KNOWN_TARGETS.join(", ")})`);
        if (!KNOWN_TARGETS.includes(target)) {
          // A harness grooph has no compiler for: no package, and the document is a plan as it is.
          const code = usageError(io, `unknown target "${target}"; known targets: ${KNOWN_TARGETS.join(", ")}`);
          let reads = false;
          try {
            reads = parseGraphText(readFileSync(file, "utf8")).doc !== undefined;
          } catch {
            reads = false;
          }
          if (reads) io.err(oneLine(PLAN_STILL(file)));
          return code;
        }
        const into = values["into"];
        if (into === undefined || into === "") return usageError(io, "export needs --into <dir>, the project to write the package into");
        return exportCommand(io, file, { target: target as CompileTarget, into, ...(tierMap ? { models: tierMap.models, modelsFrom } : {}), changeModels: values["change-models"] === true, allow: values["allow"] ?? [], uncompared: values["uncompared"] === true });
      }


      case "embed": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { theme: { type: "string" }, height: { type: "string" }, frame: { type: "boolean" }, play: { type: "boolean" }, base: { type: "string" } },
        });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "embed needs a file: grooph embed <graph | map | run> (grooph embed --help)");
        // What the frame's address says: a theme's name unless it is Paper, the default, and light or dark when asked.
        const asked = values["theme"] === undefined ? undefined : readTheme(values["theme"]);
        if (values["theme"] !== undefined && (!asked || asked.form === "auto")) {
          return usageError(io, `--theme is one of ${PICTURE_THEMES.join(", ")}; or light or dark; or both, as chalk-dark. Got "${values["theme"]}"`);
        }
        const theme = asked ? [asked.name === "paper" ? "" : asked.name, asked.form ?? ""].filter(Boolean).join("-") : "";
        // The flags are judged before the folder is read, as they were: the product's command says what is wrong with one.
        const flags = {
          ...(theme ? { theme } : {}),
          ...(values["height"] !== undefined ? { height: Number(values["height"]) } : {}),
          ...(values["base"] !== undefined ? { base: values["base"] } : {}),
          frame: values["frame"] === true,
          play: values["play"] === true,
        };
        if ((flags.height !== undefined && !(Number.isInteger(flags.height) && flags.height >= 120 && flags.height <= 4000)) || (flags.base !== undefined && !URL.canParse(flags.base))) return embedCommand(io, file, flags);
        return embedCommand(io, file, flags, runIn(file, "embed takes a graph, a run folder (.grooph/<graph-id>/runs/<run-id>/), a run bundle, an operation map or a proposal set"));
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
          runIn(file, "share takes a graph, a proposal set, a run folder (.grooph/<graph-id>/runs/<run-id>/) or a run bundle"),
        );
      }

      case "runs": {
        const [sub, ...args] = rest;
        const { positionals, values } = parseArgs({
          args,
          allowPositionals: true,
          options: { json: { type: "boolean" }, out: { type: "string" } },
        });
        if (sub === "list") return runsListCommand(io, positionals[0] ?? ".");
        if (sub === "show") {
          if (positionals[0] === undefined) return usageError(io, "runs show needs a run folder: grooph runs show .grooph/<graph-id>/runs/<run-id>");
          return runsShowCommand(io, positionals[0], { json: values["json"] === true });
        }
        if (sub === "bundle") {
          if (positionals[0] === undefined) return usageError(io, "runs bundle needs a run folder: grooph runs bundle <run dir> --out <file>");
          if (values["out"] === undefined) return usageError(io, "runs bundle needs --out <file>, for example run.grooph-run.json");
          return runsBundleCommand(io, positionals[0], values["out"]);
        }
        return usageError(io, sub === undefined ? "runs needs list, show or bundle (grooph runs --help)" : `unknown runs command "${sub}"; it is list, show or bundle`);
      }


      case "adopt": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { into: { type: "string" }, allow: { type: "string", multiple: true }, write: { type: "boolean" } },
        });
        if (positionals[0] === undefined) return usageError(io, "adopt needs a run folder: grooph adopt .grooph/<graph-id>/runs/<run-id> [--write]");
        return adoptCommand(io, positionals[0], { ...(values["into"] !== undefined ? { into: values["into"] } : {}), allow: values["allow"] ?? [], write: values["write"] === true });
      }


      case "watch": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { port: { type: "string" }, host: { type: "string" }, open: { type: "boolean" }, sessions: { type: "boolean" }, events: { type: "string", multiple: true }, map: { type: "string" } },
        });
        if (values["map"] !== undefined && !existsSync(values["map"])) return usageError(io, `--map ${values["map"]}: no such file`);
        const port = values["port"] === undefined ? 4174 : Number(values["port"]);
        if (!Number.isInteger(port) || port < 0 || port > 65535) return usageError(io, `--port must be a port number from 0 to 65535, got "${values["port"]}"`);
        const host = values["host"] ?? "127.0.0.1";
        if (host.trim() === "") return usageError(io, "--host needs an address, like 127.0.0.1 or 0.0.0.0");
        const events = (values["events"] ?? []).map(parseSource);
        for (const source of events) {
          if (source.ref === undefined && !existsSync(source.path)) return usageError(io, `--events ${source.path}: no such file or folder`);
        }
        return await watchCommand(io, positionals[0], { port, host, open: values["open"] === true, sessions: values["sessions"] === true || values["map"] !== undefined, ...(events.length > 0 ? { events } : {}), ...(values["map"] !== undefined ? { map: values["map"] } : {}) }, {
          openUrl: env.openUrl ?? openUrl,
          ...(env.signal ? { signal: env.signal } : {}),
          ...(env.env ? { env: env.env } : {}),
        });
      }

      default:
        return grooph(argv, io, readStdin, env);
    }
  } catch (err) {
    if (err instanceof LoadError) {
      io.err(`grooph: ${err.message}`);
      for (const line of err.lines) io.err(line);
      return 1;
    }
    const error = err as NodeJS.ErrnoException;
    // A file's name is echoed as it was typed: one line, whatever it holds.
    if (error.code === "ENOENT") {
      io.err(oneLine(`grooph: no such file: ${error.path ?? "(unknown)"}`));
      return 1;
    }
    if (error.code === "KEPT_GRAPH") {
      io.err(oneLine(`grooph: ${error.message}`));
      return 1;
    }
    if (error.name === "TypeError" && /Unknown option|Option/.test(error.message)) {
      return usageError(io, error.message);
    }
    io.err(oneLine(`grooph: ${error.message}`));
    return 2;
  }
};

function unknownCommand(io: Output, typed: string): number {
  const near = nearestCommand(typed, COMMANDS);
  io.err(`grooph: unknown command "${typed}".${near === undefined ? "" : ` Did you mean "${near}"?`}`);
  io.err("grooph --help lists the commands.");
  return 1;
}
