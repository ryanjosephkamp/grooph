/**
 * `grooph sub add | list | update | extract`: subgroophs (amendment A-018, decision 0025; docs/templates.md §4).
 *
 * A subgrooph is a template placed inside a graph as a unit: a group that remembers the template and version it
 * came from. The document work is core's (`placeSubgrooph`, `listGroups`, `refreshSubgrooph`, `extractGroup`); this
 * file finds the template, reads and writes the file, and prints.
 */

import { parseArgs } from "node:util";

import {
  canonicalize,
  extractGroup,
  findSlots,
  hasErrors,
  listGroups,
  parseGraph,
  parseGraphText,
  placeSubgrooph,
  refreshSubgrooph,
  validate,
  type Graph,
  type Issue,
} from "@grooph/core";

import { readText, writeText } from "../io.js";
import { plural, printIssues, type Output } from "../print.js";
import { projectDir, resolveTemplate, saveToRegistry, type RegistryEnv } from "../registry.js";
import { parseSets } from "./template.js";

export const SUB_HELP = `grooph sub add <template> --into <file> --as <id> [--name <name>] [--set key=value …] [--after <node>] [--then <node>] [--write]
grooph sub list <file> [--json]
grooph sub update <file> [<group> …] [--allow <change> …] [--write]
grooph sub extract <file> <group> --id <id> --title <t> --summary <s> --when <w> [--to project|user] [--force]

A subgrooph is a template placed inside a graph as a unit: a group that remembers which
template and version it came from, and the values it was filled with. Its nodes are ordinary
nodes of the one document. Nothing is fetched or inlined when a package is compiled.

  add      Place a template in the graph as a group named --as. Everything that comes in gets an
           id that starts with it (review-builder). --after <node> leads into it from a node of the
           graph. --then <node> leads on from it: the edges that reached the template's own
           success stop go to that node, and that stop is dropped; a stop that halts stays.
           Every id that begins with --as and a dash is the subgrooph's own from then on, so an
           --as the graph already uses that way is refused, and so is a template with a lead
           node. If the graph kept a node behind a person and the subgrooph now leads to it
           around that person, that is said. Dry run unless --write.
  list     Every group: the template and version it came from if it is a subgrooph, how many
           nodes it holds, and the edges that lead in and out. --json prints the same as data.
  update   What a newer version of its template would change in each subgrooph (or in the ones
           named), then the graph with those changes. A change that removes or loosens a brake
           (a human gate, an approval, an irreversible marker, a budget or a round cap, a bar's
           acceptance, critic isolation) is listed first and NOT applied unless you ask for it by
           its name with --allow. The brakes are compared on the whole graph as it would be
           written, so one cannot be shed under a new id or in two changes: what a run could reach
           only by a gate, an approval or a critic's verdict, it may not reach without it afterwards.
           A change says every reason it is held for. Tightening applies with the rest. The shape moves as a whole: while a change to the
           nodes, edges or loop members is held back, the others wait for it. A node you added
           inside the box under another id is yours, and stays. Dry run unless --write.
  Neither add nor update writes a graph it would leave with an error the file does not have now.
  extract  Save any group as a template, in the project (default) or user folder.

A template is found as grooph template finds it: the project, then your home folder, then
the built-in library, then --registry <url> or the published library.

Example
  grooph sub add review-gate --into plan.grooph.json --as review --after plan --then release \\
    --set task="the checkout flow" --set test-command="pnpm test" --set checklist=docs/checklist.md --write`;

type Outcome = number | { usage: string };

const list = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/** The graph in `file`, or the exit code after saying why it cannot be read. */
function load(io: Output, file: string, doing: string): Graph | number {
  const parsed = parseGraphText(readText(file));
  if (parsed.doc) return parsed.doc;
  io.err(`grooph: cannot ${doing} ${file}: it does not match the schema`);
  printIssues(io, parsed.issues, file);
  return 1;
}

/** A document as grooph would write it, or the schema issues that stop it being written. */
function checkWritable(doc: Graph): { doc: Graph; issues: Issue[] } | { schema: Issue[] } {
  const parsed = parseGraph(JSON.parse(canonicalize(doc)));
  if (!parsed.doc) return { schema: parsed.issues };
  return { doc: parsed.doc, issues: validate(parsed.doc) };
}

/** `before` is the file as it stands: a template is someone else's work, and is not written into a graph it breaks. */
function finish(io: Output, file: string, doc: Graph, issues: Issue[], write: boolean, before: Graph): number {
  printIssues(io, issues, file);
  const said = (issue: Issue): string => `${issue.code} ${issue.message}`;
  const had = new Set(validate(before).filter((issue) => issue.severity === "error").map(said));
  const broken = [...new Set(issues.filter((issue) => issue.severity === "error" && !had.has(said(issue))).map((issue) => issue.code))];
  if (broken.length > 0) {
    io.err(`grooph: ${file} is ${write ? "unchanged" : "not written"}: this would leave it with ${broken.join(", ")}, which it does not have now`);
    return 1;
  }
  if (write) {
    writeText(file, canonicalize(doc));
    io.out(`wrote ${file}`);
  } else {
    io.out(`${file} not written (dry run — pass --write to save)`);
  }
  return hasErrors(issues) ? 1 : 0;
}

// ─── add ──────────────────────────────────────────────────────────────────

export type AddFlags = { into: string; as: string; name?: string; sets: string[]; after?: string; then?: string; write?: boolean; registries: string[] };

export async function subAdd(io: Output, env: RegistryEnv, name: string, flags: AddFlags): Promise<number> {
  const host = load(io, flags.into, "place a subgrooph in");
  if (typeof host === "number") return host;
  const found = await resolveTemplate(name, env, flags.registries);
  const placed = placeSubgrooph(host, found.doc, {
    as: flags.as,
    values: parseSets(flags.sets),
    ...(flags.name !== undefined ? { name: flags.name } : {}),
    ...(flags.after !== undefined ? { after: flags.after } : {}),
    ...(flags.then !== undefined ? { then: flags.then } : {}),
  });
  const checked = checkWritable(placed.doc);
  if ("schema" in checked) {
    io.err(`grooph: placing "${name}" leaves ${flags.into} failing the schema, so it is unchanged:`);
    printIssues(io, checked.schema, flags.into);
    return 1;
  }

  const group = placed.group;
  io.out(`placed ${group.from} (${found.source}) as "${group.id}": ${plural(group.members.length, "member")}, named "${group.name}"`);
  for (const id of placed.dropped) io.out(`  its stop "${id}" is dropped: what reached it leads to "${flags.then}"`);
  for (const id of placed.connected) {
    const edge = checked.doc.edges.find((e) => e.id === id)!;
    io.out(`  ${edge.from} → ${edge.to}   (${id})`);
  }
  const contents = listGroups(checked.doc).find((g) => g.id === group.id)!;
  if (contents.entries.length === 0) io.out(`  nothing leads into it yet: pass --after <node>, or connect it with grooph apply`);
  if (contents.exits.length === 0 && placed.dropped.length === 0 && flags.then === undefined) io.out(`  it leads on to nothing: its own stop ends the run. Pass --then <node> to go on from it`);

  const unfilled = [...new Set(findSlots(checked.doc).map((use) => use.key))];
  if (unfilled.length > 0) io.err(`${plural(unfilled.length, "slot")} still unfilled (${unfilled.map((key) => `{{${key}}}`).join(", ")}): fill with --set key=value; export refuses unfilled slots (E_UNFILLED_SLOT).`);
  for (const open of placed.opens) io.err(`  "${open.node}" was reached only by passing ${open.past}; the subgrooph now leads to it without. Put a gate or an approval on the way if that is not meant.`);
  return finish(io, flags.into, checked.doc, checked.issues, flags.write === true, host);
}

// ─── list ─────────────────────────────────────────────────────────────────

export function subList(io: Output, file: string, flags: { json?: boolean }): number {
  const doc = load(io, file, "list the groups of");
  if (typeof doc === "number") return doc;
  const groups = listGroups(doc);
  if (flags.json === true) {
    io.out(JSON.stringify(groups, null, 2));
    return 0;
  }
  if (groups.length === 0) {
    io.out(`${file} has no groups. Place a template as one: grooph sub add <template> --into ${file} --as <id>`);
    return 0;
  }
  for (const group of groups) {
    const where = group.from ? `${group.from.template}@${group.from.version}` : "a plain group";
    io.out(`${group.id}  "${group.name}"  ${where}  ${plural(group.nodes, "node")}${group.groups > 0 ? `, ${plural(group.groups, "group")} inside` : ""}${group.inside ? `  (inside "${group.inside}")` : ""}`);
    if (group.description !== undefined) io.out(`    ${group.description}`);
    io.out(`    in:  ${group.entries.length > 0 ? group.entries.map((e) => `${e.from} → ${e.to}`).join(", ") : "nothing leads in"}`);
    io.out(`    out: ${group.exits.length > 0 ? group.exits.map((e) => `${e.from} → ${e.to}`).join(", ") : "nothing leads out"}`);
  }
  return 0;
}

// ─── update ───────────────────────────────────────────────────────────────

export type UpdateFlags = { groups: string[]; allow: string[]; write?: boolean; registries: string[] };

export async function subUpdate(io: Output, env: RegistryEnv, file: string, flags: UpdateFlags): Promise<number> {
  const start = load(io, file, "update the subgroophs of");
  if (typeof start === "number") return start;
  const all = listGroups(start);
  for (const id of flags.groups) {
    const group = all.find((g) => g.id === id);
    if (!group) {
      io.err(`grooph: ${file} has no group "${id}"; its groups are ${all.map((g) => g.id).join(", ") || "none"}`);
      return 1;
    }
    if (!group.from) {
      io.err(`grooph: group "${id}" is not a subgrooph: it does not say which template it came from`);
      return 1;
    }
  }
  const targets = all.filter((group) => group.from !== undefined && (flags.groups.length === 0 || flags.groups.includes(group.id)));
  if (targets.length === 0) {
    io.out(`${file} has no subgroophs to update.`);
    return 0;
  }

  let doc = start;
  let changed = 0;
  const heldBack: string[] = [];
  const asked = new Set(flags.allow);
  for (const target of targets) {
    const found = await resolveTemplate(target.from!.template, env, flags.registries);
    // A name asked for with --allow belongs to one subgrooph: give each only its own.
    const preview = refreshSubgrooph(doc, target.id, found.doc);
    const mine = flags.allow.filter((name) => preview.changes.some((change) => change.name === name));
    for (const name of mine) asked.delete(name);
    const result = mine.length > 0 ? refreshSubgrooph(doc, target.id, found.doc, { allow: mine }) : preview;

    io.out(`${target.id}  ${result.from.was} → ${result.from.now} (${found.source})${result.changes.length === 0 ? ": nothing to change" : ""}`);
    const width = Math.max(0, ...result.changes.map((change) => change.name.length)) + 2;
    const held = new Set(result.held.map((change) => change.name));
    const refused = result.held.filter((change) => change.waits === undefined);
    const waiting = result.held.filter((change) => change.waits !== undefined);
    if (refused.length > 0) {
      io.out(`  held back: each removes or loosens a brake. Apply one by its name: --allow ${refused[0]!.name}`);
      for (const change of refused) io.out(`    ${change.name.padEnd(width)}${change.loosens}`);
    }
    if (waiting.length > 0) {
      io.out(`  waiting for ${[...new Set(waiting.map((change) => change.waits!))].join(", ")}: the shape of a subgrooph moves as a whole`);
      for (const change of waiting) io.out(`    ${change.name.padEnd(width)}${change.summary}${change.loosens !== undefined ? `   (loosens a brake: ${change.loosens}; asked for by name)` : ""}`);
    }
    const applied = result.changes.filter((change) => !held.has(change.name));
    if (applied.length > 0) {
      io.out(result.held.length > 0 ? "  the rest:" : "  changes:");
      for (const change of applied) io.out(`    ${change.name.padEnd(width)}${change.summary}${change.loosens !== undefined ? `   (loosens a brake: ${change.loosens}; asked for by name)` : ""}`);
    }
    for (const note of result.notes) io.out(`  note: ${note}`);
    changed += applied.length + (result.from.was !== result.from.now ? 1 : 0);
    heldBack.push(...result.held.map((change) => change.name));
    doc = result.doc;
  }
  if (asked.size > 0) {
    io.err(`grooph: no change named ${[...asked].map((name) => `"${name}"`).join(", ")} in ${targets.map((t) => `"${t.id}"`).join(", ")}; the names are listed above`);
    return 1;
  }

  const checked = checkWritable(doc);
  if ("schema" in checked) {
    io.err(`grooph: the update leaves ${file} failing the schema, so it is unchanged:`);
    printIssues(io, checked.schema, file);
    return 1;
  }
  if (changed === 0) {
    io.out(heldBack.length > 0 ? `${file} is unchanged: every difference is held back` : `${file} is up to date`);
    return 0;
  }
  return finish(io, file, checked.doc, checked.issues, flags.write === true, start);
}

// ─── extract ──────────────────────────────────────────────────────────────

export type ExtractFlags = { id: string; title: string; summary: string; when: string; to: "project" | "user"; force?: boolean };

export function subExtract(io: Output, env: RegistryEnv, file: string, group: string, flags: ExtractFlags): number {
  const doc = load(io, file, "save a group of");
  if (typeof doc === "number") return doc;
  const template = extractGroup(doc, group, { id: flags.id, title: flags.title, summary: flags.summary, whenToUse: flags.when });
  const issues = validate(template);
  if (hasErrors(issues)) {
    io.err(`grooph: not saved: the template would carry these errors`);
    printIssues(io, issues, flags.id);
    return 1;
  }
  const saved = saveToRegistry(flags.to === "user" ? env.userDir : projectDir(env), template, { force: flags.force === true, bump: true });
  printIssues(io, issues, flags.id);
  io.out(`saved ${saved.doc.id}@${saved.doc.version} (fragment: ${plural(saved.doc.nodes.length, "node")}, ${plural(saved.doc.edges.length, "edge")}, ${plural(saved.doc.loops.length, "loop")}) to ${saved.path}${saved.replaced ? ", replacing the previous version" : ""}`);
  io.out(`place it: grooph sub add ${saved.doc.id} --into <graph.grooph.json> --as <id> --write`);
  return 0;
}

// ─── arguments ────────────────────────────────────────────────────────────

export async function subCommand(io: Output, argv: string[], env: RegistryEnv): Promise<Outcome> {
  const [sub, ...rest] = argv;
  switch (sub) {
    case undefined:
    case "help":
      io.out(SUB_HELP);
      return sub === undefined ? 1 : 0;

    case "add": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          into: { type: "string" },
          as: { type: "string" },
          name: { type: "string" },
          set: { type: "string", multiple: true },
          after: { type: "string" },
          then: { type: "string" },
          write: { type: "boolean" },
          registry: { type: "string", multiple: true },
        },
      });
      const [name, ...extra] = positionals;
      if (name === undefined || extra.length > 0) return { usage: "sub add needs one template: grooph sub add <template> --into <file> --as <id>" };
      if (values.into === undefined) return { usage: "sub add needs --into <file>, the graph to place it in" };
      if (values.as === undefined) return { usage: `sub add needs --as <id>, the subgrooph's id in the graph, like --as ${name.split("-")[0]}` };
      return subAdd(io, env, name, {
        into: values.into,
        as: values.as,
        sets: list(values.set),
        write: values.write === true,
        registries: list(values.registry),
        ...(values.name !== undefined ? { name: values.name } : {}),
        ...(values.after !== undefined ? { after: values.after } : {}),
        ...(values.then !== undefined ? { then: values.then } : {}),
      });
    }

    case "list": {
      const { positionals, values } = parseArgs({ args: rest, allowPositionals: true, options: { json: { type: "boolean" } } });
      if (positionals.length !== 1) return { usage: "sub list needs a file: grooph sub list <file>" };
      return subList(io, positionals[0]!, { json: values.json === true });
    }

    case "update": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { allow: { type: "string", multiple: true }, write: { type: "boolean" }, registry: { type: "string", multiple: true } },
      });
      const [file, ...groups] = positionals;
      if (file === undefined) return { usage: "sub update needs a file: grooph sub update <file> [<group> …]" };
      return subUpdate(io, env, file, { groups, allow: list(values.allow), write: values.write === true, registries: list(values.registry) });
    }

    case "extract": {
      const { positionals, values } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { id: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, when: { type: "string" }, to: { type: "string" }, force: { type: "boolean" } },
      });
      const [file, group, ...extra] = positionals;
      if (file === undefined || group === undefined || extra.length > 0) return { usage: "sub extract needs a file and a group: grooph sub extract <file> <group> --id <id> --title <t> --summary <s> --when <w>" };
      const to = values.to === undefined || values.to === "project" ? "project" : values.to === "user" ? "user" : undefined;
      if (to === undefined) return { usage: `--to is project or user; got "${values.to}"` };
      for (const flag of ["id", "title", "summary", "when"] as const) {
        if (values[flag] === undefined) return { usage: `sub extract needs --${flag}` };
      }
      return subExtract(io, env, file, group, { id: values.id!, title: values.title!, summary: values.summary!, when: values.when!, to, force: values.force === true });
    }

    default:
      return { usage: `sub has no "${sub}"; it has add, list, update and extract` };
  }
}
