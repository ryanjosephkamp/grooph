/**
 * Argument parsing for `grooph template <subcommand>` (docs/templates.md §4).
 * Returns the exit code, or `{ usage }` for an invocation that is wrong.
 */

import { parseArgs } from "node:util";

import type { Output } from "../print.js";
import type { RegistryEnv } from "../registry.js";
import { templateAdd, templateInsert, templateList, templateSave, templateShow, templateUse } from "./template.js";

export const TEMPLATE_USAGE = `Usage
  grooph template list [--json] [--registry <url>]
  grooph template show <name> [--json] [--registry <url>]
  grooph template use <name> --name <graph name> [--set key=value …] [--out <file>] [--force]
  grooph template insert <name> --into <file> [--set key=value …] [--prefix <p>] [--write]
  grooph template save <file> --id <id> --title <t> --summary <s> --when <w>
                       [--fragment --nodes a,b,c] [--to project|user] [--force]
  grooph template add <name | url> [--to project|user] [--registry <url>] [--force]

A name is a template id. It resolves, first hit wins, in .grooph/templates/ at the root of
the working tree, then ~/.grooph/templates/ ($GROOPH_HOME/templates), then the built-in
pattern library, and only then remotely: each --registry <url> (an index.json, or the folder
holding one), or else the published library (${"$"}GROOPH_REGISTRY overrides it).

  list     Every local template with its kind, profile and when-to-use line; --registry adds a
           remote registry's. A local template shadows a later one with the same id. --json
           adds each row's index entry, source and location, and \`glyph\`: the path or URL of
           its pre-drawn glyph where the registry keeps one (grooph glyph draws any other).
  show     One template: summary, when to use and not, profile, slots with their questions,
           nodes, edges and loops.
  use      A new graph from a whole-graph template: slots filled from --set, a new id and name,
           version 1, lineage naming the template. Prints the document, or writes --out
           (never over a file without --force). Questions for unfilled slots go to stderr.
  insert   Add a template's nodes, edges, loops and policies to a graph, renaming ids that
           collide (or prefixing them all with --prefix) and printing where each id landed.
           Nothing is connected to the graph's nodes. Dry run unless --write.
  save     Make a template from a graph, or with --fragment --nodes from some of its nodes,
           and write it to the project (default) or user folder, refreshing its index.json.
           Replacing an existing template needs --force and bumps its version.
  add      Copy a template from a remote registry (by name) or a URL into the project
           (default) or user folder, so it resolves locally from then on.`;

type Outcome = number | { usage: string };

const list = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

const destination = (value: string | undefined): "project" | "user" | undefined =>
  value === undefined || value === "project" ? "project" : value === "user" ? "user" : undefined;

export async function templateCommand(io: Output, argv: string[], env: RegistryEnv): Promise<Outcome> {
  const [sub, ...rest] = argv;
  // `grooph template <sub> --help` works like every other command's --help (0009 handback, D7).
  if (rest.includes("--help") || rest.includes("-h")) {
    io.out(TEMPLATE_USAGE);
    return 0;
  }
  switch (sub) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      io.out(TEMPLATE_USAGE);
      return sub === undefined ? 1 : 0;

    case "list": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { json: { type: "boolean" }, registry: { type: "string", multiple: true } },
      });
      if (positionals.length > 0) return { usage: "template list takes no name; did you mean grooph template show?" };
      return templateList(io, env, { json: values.json === true, registries: list(values.registry) });
    }

    case "show": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { json: { type: "boolean" }, registry: { type: "string", multiple: true } },
      });
      const name = positionals[0];
      if (name === undefined) return { usage: "template show needs a name: grooph template show <name>" };
      return templateShow(io, env, name, { json: values.json === true, registries: list(values.registry) });
    }

    case "use": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          name: { type: "string" },
          set: { type: "string", multiple: true },
          out: { type: "string" },
          force: { type: "boolean" },
          registry: { type: "string", multiple: true },
        },
      });
      const name = positionals[0];
      if (name === undefined) return { usage: "template use needs a template name: grooph template use <name> --name <graph name>" };
      const graphName = values.name;
      if (graphName === undefined || graphName.trim() === "") return { usage: `template use needs --name, the new graph's name: grooph template use ${name} --name "<graph name>"` };
      return templateUse(io, env, name, {
        name: graphName,
        sets: list(values.set),
        ...(values.out !== undefined ? { out: values.out } : {}),
        force: values.force === true,
        registries: list(values.registry),
      });
    }

    case "insert": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          into: { type: "string" },
          set: { type: "string", multiple: true },
          prefix: { type: "string" },
          write: { type: "boolean" },
          registry: { type: "string", multiple: true },
        },
      });
      const name = positionals[0];
      if (name === undefined) return { usage: "template insert needs a template name: grooph template insert <name> --into <file>" };
      if (values.into === undefined) return { usage: `template insert needs --into <file>, the graph to insert into` };
      return templateInsert(io, env, name, {
        into: values.into,
        sets: list(values.set),
        ...(values.prefix !== undefined ? { prefix: values.prefix } : {}),
        write: values.write === true,
        registries: list(values.registry),
      });
    }

    case "save": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          when: { type: "string" },
          fragment: { type: "boolean" },
          nodes: { type: "string" },
          to: { type: "string" },
          force: { type: "boolean" },
        },
      });
      const file = positionals[0];
      if (file === undefined) return { usage: "template save needs a graph file: grooph template save <file> --id <id> …" };
      const missing = (["id", "title", "summary", "when"] as const).filter((key) => values[key] === undefined || values[key]!.trim() === "");
      if (missing.length > 0) return { usage: `template save needs ${missing.map((key) => `--${key}`).join(", ")}` };
      if (values.fragment === true && values.nodes === undefined) return { usage: "--fragment needs --nodes a,b,c: the node ids the fragment keeps" };
      if (values.nodes !== undefined && values.fragment !== true) return { usage: "--nodes picks a fragment's nodes; pass --fragment with it" };
      const to = destination(values.to);
      if (to === undefined) return { usage: `--to is project or user, not "${values.to}"` };
      return templateSave(io, env, file, {
        id: values.id!,
        title: values.title!,
        summary: values.summary!,
        when: values.when!,
        fragment: values.fragment === true,
        ...(values.nodes !== undefined ? { nodes: values.nodes.split(",").map((id) => id.trim()).filter((id) => id !== "") } : {}),
        to,
        force: values.force === true,
      });
    }

    case "add": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { to: { type: "string" }, force: { type: "boolean" }, registry: { type: "string", multiple: true } },
      });
      const name = positionals[0];
      if (name === undefined) return { usage: "template add needs a name or a URL: grooph template add <name | url>" };
      const to = destination(values.to);
      if (to === undefined) return { usage: `--to is project or user, not "${values.to}"` };
      return templateAdd(io, env, name, { to, force: values.force === true, registries: list(values.registry) });
    }

    default:
      return { usage: `unknown template command "${sub}"; it is one of list, show, use, insert, save, add` };
  }
}
