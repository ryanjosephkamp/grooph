/**
 * `grooph` — the command line shell around `@grooph/core`.
 *
 * Core is pure; this package reads and writes files (`docs/ARCHITECTURE.md`).
 * Exit codes: 0 fine · 1 the document is wrong, or the invocation is · 2 a crash.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { parse, resolve } from "node:path";
import { parseArgs } from "node:util";

import { KNOWN_TARGETS, TemplateError, type CompileTarget } from "@grooph/core";

import { adoptCommand, ADOPT_HELP } from "./commands/adopt.js";
import { applyCommand } from "./commands/apply.js";
import { canonicalizeCommand } from "./commands/canonicalize.js";
import { exportCommand } from "./commands/export.js";
import { explainCommand } from "./commands/explain.js";
import { APPLY_HELP, CANONICALIZE_HELP, EXPLAIN_HELP, EXPORT_HELP, NEW_HELP, VALIDATE_HELP, nearestCommand, overview } from "./commands/help.js";
import { glyphCommand, mermaidCommand, GLYPH_HELP, MERMAID_HELP } from "./commands/glyph.js";
import { eventsCommand, hooksCommand, sessionsCommand, EVENTS_HELP, HOOKS_HELP, SESSIONS_HELP } from "./commands/hooks.js";
import { imageCommand, outlineCommand, pageCommand, IMAGE_HELP, OUTLINE_HELP, PAGE_HELP } from "./commands/image.js";
import { newCommand } from "./commands/new.js";
import { pickCommand, PICK_HELP } from "./commands/pick.js";
import { runsBundleCommand, runsListCommand, runsShowCommand, RUNS_HELP } from "./commands/runs.js";
import { shapeCommand, SHAPE_HELP } from "./commands/shape.js";
import { embedCommand, EMBED_HELP } from "./commands/embed.js";
import { shareCommand, SHARE_HELP } from "./commands/share.js";
import { templateCommand, TEMPLATE_USAGE } from "./commands/template-args.js";
import { validateCommand } from "./commands/validate.js";
import { watchCommand, WATCH_HELP } from "./commands/watch.js";
import { parseSource } from "./events-io.js";
import { serve as serveMcp, toolNames } from "./mcp.js";
import { stdio, type Output } from "./print.js";
import { RegistryError, defaultRegistryEnv, type RegistryEnv } from "./registry.js";
import { LoadError, openUrl, type OpenUrl } from "./share-io.js";

/**
 * What a run may reach outside its arguments; tests replace any of it.
 * `signal` stops `grooph watch` (otherwise Ctrl-C does); `env` stands in for `process.env`.
 */
export type CliEnv = RegistryEnv & { openUrl: OpenUrl; signal?: AbortSignal; env?: NodeJS.ProcessEnv; /** where the command is run from, when not the process's own folder */ cwd?: string };

export const VERSION = "0.3.0";

export async function run(
  argv: string[],
  io: Output = stdio,
  readStdin: () => string = () => readFileSync(0, "utf8"),
  env: Partial<CliEnv> = {},
): Promise<number> {
  const [command, ...rest] = argv;

  // `grooph help <command>` is `grooph <command> --help`.
  if (command === "help" && rest[0] !== undefined) {
    const page = COMMAND_HELP[rest[0]];
    if (page === undefined) return unknownCommand(io, rest[0]);
    io.out(page);
    return 0;
  }
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    io.out(overview(VERSION));
    return command === undefined ? 1 : 0;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    io.out(VERSION);
    return 0;
  }

  if (command !== "template" && (rest.includes("--help") || rest.includes("-h"))) {
    if (COMMAND_HELP[command] === undefined) return unknownCommand(io, command);
    io.out(COMMAND_HELP[command]);
    return 0;
  }

  /** A wrong invocation: the message, the command's usage line, and where the full page is. */
  const usageError = (out: Output, message: string): number => {
    out.err(`grooph: ${message}`);
    const first = (COMMAND_HELP[command] ?? "").split("\n")[0];
    out.err(first ? `Usage: ${first}` : `Usage: grooph <command> (grooph --help lists them)`);
    if (COMMAND_HELP[command] !== undefined) out.err(`More: grooph help ${command}`);
    return 1;
  };

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

      case "glyph": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { out: { type: "string" }, scale: { type: "string" } } });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "glyph needs a file: grooph glyph <graph file> [--out <svg file>]");
        const scale = values["scale"] === undefined ? undefined : Number(values["scale"]);
        if (scale !== undefined && !(scale > 0)) return usageError(io, `--scale must be a positive number, got "${values["scale"]}"`);
        return glyphCommand(io, file, { ...(values["out"] !== undefined ? { out: values["out"] } : {}), ...(scale !== undefined ? { scale } : {}) });
      }

      case "mermaid": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { out: { type: "string" } } });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "mermaid needs a file: grooph mermaid <graph file> [--out <file>]");
        return mermaidCommand(io, file, values["out"] !== undefined ? { out: values["out"] } : {});
      }

      case "image": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { out: { type: "string" }, theme: { type: "string" }, scale: { type: "string" }, events: { type: "string", multiple: true } } });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "image needs a file: grooph image <graph | operation map> [--out <file.svg | file.png>]");
        const scale = values["scale"] === undefined ? undefined : Number(values["scale"]);
        if (scale !== undefined && !(scale > 0 && scale <= 8)) return usageError(io, `--scale must be a number above 0 and at most 8, got "${values["scale"]}"`);
        return await imageCommand(io, file, {
          ...(values["out"] !== undefined ? { out: values["out"] } : {}),
          ...(values["theme"] !== undefined ? { theme: values["theme"] } : {}),
          ...(scale !== undefined ? { scale } : {}),
          ...(values["events"] ? { events: values["events"].map(parseSource) } : {}),
        });
      }

      case "outline": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { out: { type: "string" } } });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "outline needs a file: grooph outline <graph | operation map> [--out <file.md>]");
        return outlineCommand(io, file, values["out"] !== undefined ? { out: values["out"] } : {});
      }

      case "page": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { out: { type: "string" }, events: { type: "string", multiple: true } } });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "page needs a file: grooph page <graph | operation map> --out <file.html>");
        if (values["out"] === undefined) return usageError(io, "page needs --out <file.html>, the one file to write");
        return pageCommand(io, file, { out: values["out"], version: VERSION, ...(values["events"] ? { events: values["events"].map(parseSource) } : {}) });
      }

      case "embed": {
        const { positionals, values } = parseArgs({
          args: rest,
          allowPositionals: true,
          options: { theme: { type: "string" }, height: { type: "string" }, frame: { type: "boolean" }, play: { type: "boolean" }, base: { type: "string" } },
        });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "embed needs a file: grooph embed <graph | map | run> (grooph embed --help)");
        if (values["theme"] !== undefined && values["theme"] !== "light" && values["theme"] !== "dark") {
          return usageError(io, `--theme is light or dark; got "${values["theme"]}"`);
        }
        return embedCommand(io, file, {
          ...(values["theme"] !== undefined ? { theme: values["theme"] as "light" | "dark" } : {}),
          ...(values["height"] !== undefined ? { height: Number(values["height"]) } : {}),
          ...(values["base"] !== undefined ? { base: values["base"] } : {}),
          frame: values["frame"] === true,
          play: values["play"] === true,
        });
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
          options: { into: { type: "string" }, write: { type: "boolean" } },
        });
        if (positionals[0] === undefined) return usageError(io, "adopt needs a run folder: grooph adopt .grooph/<graph-id>/runs/<run-id> [--write]");
        return adoptCommand(io, positionals[0], { ...(values["into"] !== undefined ? { into: values["into"] } : {}), write: values["write"] === true });
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

      case "hooks": {
        const [sub, ...args] = rest;
        const { values } = parseArgs({ args, allowPositionals: true, options: { dir: { type: "string" }, harness: { type: "string" }, tools: { type: "boolean" }, local: { type: "boolean" }, push: { type: "boolean" }, "push-branch": { type: "string" } } });
        return hooksCommand(io, sub, {
          ...(values["dir"] !== undefined ? { dir: values["dir"] } : {}),
          ...(values["harness"] !== undefined ? { harness: values["harness"] } : {}),
          tools: values["tools"] === true,
          local: values["local"] === true,
          push: values["push"] === true,
          ...(values["push-branch"] !== undefined ? { pushBranch: values["push-branch"] } : {}),
          ...(env.env !== undefined ? { env: env.env } : {}),
          ...(env.cwd !== undefined ? { cwd: env.cwd } : {}),
        });
      }

      case "events": {
        // --dir is grooph's; the rest are the script's own and are passed through as written.
        const [sub, ...args] = rest;
        const at = args.indexOf("--dir");
        const dir = at >= 0 ? args[at + 1] : undefined;
        return eventsCommand(io, sub, at >= 0 ? [...args.slice(0, at), ...args.slice(at + 2)] : args, dir);
      }

      case "sessions": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { json: { type: "boolean" } } });
        return sessionsCommand(io, positionals, { json: values["json"] === true });
      }

      case "mcp": {
        const { values } = parseArgs({ args: rest, allowPositionals: false, options: { dir: { type: "string" }, harness: { type: "string" }, chat: { type: "boolean" } } });
        const chat = values["chat"] === true;
        if (chat && values["dir"] !== undefined) return usageError(io, "--chat writes no file, so it takes no --dir; leave one of them out");
        const e = env.env ?? process.env;
        const project = resolve(values["dir"] ?? e["CLAUDE_PROJECT_DIR"] ?? process.cwd());
        // A chat app starts a server wherever it likes, often in the file system's root or the home folder. A folder
        // nobody chose is not a project: there the tools still return every document, and write no file.
        const chosen = values["dir"] !== undefined || e["CLAUDE_PROJECT_DIR"] !== undefined;
        const writes = !chat && (chosen || (project !== parse(project).root && project !== resolve(homedir())));
        // The harness does not always tell an MCP server which session it serves; then the id is this server's own.
        const session = e["CLAUDE_CODE_SESSION_ID"] ?? e["CODEX_SESSION_ID"] ?? `mcp-${Date.now().toString(36)}-${process.pid}`;
        const harness = values["harness"] ?? (e["CLAUDECODE"] ? "claude-code" : e["CODEX_HOME"] || e["CODEX_SESSION_ID"] ? "codex" : "unknown");
        await serveMcp({ project, writes, ...(chat ? { chat } : {}), version: VERSION, harness: chat && values["harness"] === undefined ? "chat" : harness, session, now: () => new Date() });
        return 0;
      }

      case "template": {
        const outcome = await templateCommand(io, rest, { ...defaultRegistryEnv(), ...env });
        if (typeof outcome === "number") return outcome;
        io.err(`grooph: ${outcome.usage}`);
        io.err("");
        io.err(TEMPLATE_USAGE);
        return 1;
      }

      case "explain": {
        const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { json: { type: "boolean" } } });
        const file = positionals[0];
        if (file === undefined) return usageError(io, "explain needs a file: grooph explain <graph file>");
        return explainCommand(io, file, { json: values["json"] === true });
      }

      default:
        return unknownCommand(io, command);
    }
  } catch (err) {
    if (err instanceof RegistryError || err instanceof TemplateError) {
      io.err(`grooph: ${err.message}`);
      return 1;
    }
    if (err instanceof LoadError) {
      io.err(`grooph: ${err.message}`);
      for (const line of err.lines) io.err(line);
      return 1;
    }
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      io.err(`grooph: no such file: ${error.path ?? "(unknown)"}`);
      return 1;
    }
    if (error.name === "TypeError" && /Unknown option|Option/.test(error.message)) {
      return usageError(io, error.message);
    }
    io.err(`grooph: ${error.message}`);
    return 2;
  }
}

const MCP_HELP = `grooph mcp [--dir <project>] [--harness <name>] [--chat]

Run grooph's MCP server on standard input and output, for an agent to call: in a coding
session, or in a chat app that runs local servers. No model is called and nothing leaves
the machine.

To author a graph with tool calls alone (docs/agents.md). A document goes in and comes
back as JSON, so no file has to exist; path reads a file and out writes one:

  grooph_templates      the library with when to use each; one template in full by id
  grooph_use_template   a graph from a template: id, name, slot values
  grooph_new            an empty graph
  grooph_apply          a graph and typed operations: the graph, or the failing one by index
  grooph_validate       the issues by code, with what to do about each
  grooph_explain        what bounds it: rounds, budgets, who must say go, the worst case
  grooph_shape          counts and brakes on one line
  grooph_share          a link the app opens on any device, and the embed line
  grooph_picture        the picture as SVG text, and a PNG when asked
  grooph_export         the prompt package's files, returned or written into the project

For a session's lead, beside what the event hook sees (docs/subagents.md §7):

  grooph_plan      declare the subagents the session is about to start
  grooph_note      leave a short note for whoever is watching
  grooph_running   what the event hook has seen: sessions, subagents, what is running,
                   and each declared plan with how much of it has started

A tool writes a file only when it is given a name for one, and only inside the project
folder. A plan and a note are appended to <project>/.grooph/events/said-<session>.jsonl.

Add it to a harness:
  Claude Code   claude mcp add grooph -- grooph mcp
                or in .mcp.json: { "mcpServers": { "grooph": { "command": "grooph", "args": ["mcp"] } } }
  Codex         in ~/.codex/config.toml:  [mcp_servers.grooph]
                                          command = "grooph"
                                          args = ["mcp", "--harness", "codex"]
  Claude's desktop app, in a chat (docs/chat.md), in claude_desktop_config.json:
                { "mcpServers": { "grooph": { "command": "npx", "args": ["-y", "grooph", "mcp", "--chat"] } } }

  --dir <project>   the project (default: CLAUDE_PROJECT_DIR, else the folder it starts in).
                    Started in the file system's root or a home folder with no --dir, the
                    tools return every document and write no file.
  --harness <name>  claude-code or codex, when it cannot be told from the environment
  --chat            for a chat app: only the authoring tools, and no file is ever written;
                    every document, picture and package comes back in the reply`;

/** `grooph <command> --help`: the command's own page where it has one, else the overview. */
const COMMAND_HELP: Record<string, string> = {
  new: NEW_HELP,
  apply: APPLY_HELP,
  validate: VALIDATE_HELP,
  canonicalize: CANONICALIZE_HELP,
  export: EXPORT_HELP,
  explain: EXPLAIN_HELP,
  template: TEMPLATE_USAGE,
  share: SHARE_HELP,
  embed: EMBED_HELP,
  runs: RUNS_HELP,
  adopt: ADOPT_HELP,
  watch: WATCH_HELP,
  pick: PICK_HELP,
  shape: SHAPE_HELP,
  glyph: GLYPH_HELP,
  mermaid: MERMAID_HELP,
  image: IMAGE_HELP,
  outline: OUTLINE_HELP,
  page: PAGE_HELP,
  hooks: HOOKS_HELP,
  sessions: SESSIONS_HELP,
  events: EVENTS_HELP,
  mcp: MCP_HELP,
};

void toolNames;

function unknownCommand(io: Output, typed: string): number {
  const near = nearestCommand(typed);
  io.err(`grooph: unknown command "${typed}".${near === undefined ? "" : ` Did you mean "${near}"?`}`);
  io.err("grooph --help lists the commands.");
  return 1;
}
