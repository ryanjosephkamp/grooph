/**
 * `grooph template list | show | use | insert | save | add` (docs/templates.md §4).
 *
 * Every command resolves names through the registries in `../registry.ts`;
 * the document work is core's (`instantiate`, `insertFragment`,
 * `extractTemplate`), so the web app and the MCP server can do the same.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  canonicalize,
  describeStop,
  entryNodeIds,
  extractTemplate,
  findSlots,
  hasErrors,
  indexGraph,
  insertFragment,
  instantiate,
  parseGraph,
  parseGraphText,
  validate,
  type Graph,
  type Issue,
  type Profile,
  type SlotValues,
  type TemplateKind,
} from "@grooph/core";

import { readText, writeText } from "../io.js";
import { plural, printIssues, type Output } from "../print.js";
import {
  RegistryError,
  fetchIndex,
  fetchTemplate,
  isUrl,
  projectDir,
  resolveRemote,
  resolveTemplate,
  saveToRegistry,
  scanLocal,
  type Found,
  type RegistryEnv,
} from "../registry.js";

export const profileText = (p: Profile): string => `${p.cost} · ${p.speed} · ${p.rigor}`;

const where = (found: Found): string => (found.source === "remote" ? found.location : `${found.source}: ${found.location}`);

/** `--set key=value …` into slot values. */
export function parseSets(sets: readonly string[]): SlotValues {
  const values: SlotValues = {};
  for (const set of sets) {
    const eq = set.indexOf("=");
    if (eq <= 0) throw new RegistryError(`--set needs key=value, got "${set}"`);
    values[set.slice(0, eq).trim()] = set.slice(eq + 1);
  }
  return values;
}

/** The questions for slots still unfilled in `doc`, on stderr (docs/templates.md §4). */
function askForSlots(io: Output, doc: Graph, template: Graph): void {
  const slots = template.template?.slots ?? [];
  const order = (key: string): number => {
    const i = slots.findIndex((s) => s.key === key);
    return i === -1 ? slots.length : i;
  };
  const unfilled = findSlots(doc).sort((a, b) => order(a.key) - order(b.key));
  if (unfilled.length === 0) return;
  const width = Math.max(...unfilled.map((use) => use.key.length)) + 6;
  io.err(`${plural(unfilled.length, "slot")} still unfilled; the document holds ${unfilled.length === 1 ? "it" : "them"} as {{key}}:`);
  for (const use of unfilled) {
    const slot = slots.find((s) => s.key === use.key);
    io.err(`  ${`{{${use.key}}}`.padEnd(width)}${slot ? `${slot.ask}  (e.g. ${slot.example})` : "(the template gives no question for it)"}`);
  }
  io.err(`Fill ${unfilled.length === 1 ? "it" : "them"} with --set key=value, by editing the file, or with grooph apply; export refuses unfilled slots (E_UNFILLED_SLOT).`);
}

/** A document as grooph would write it, or the schema issues that stop it being written. */
function checkWritable(doc: Graph): { doc: Graph; issues: Issue[] } | { schema: Issue[] } {
  const parsed = parseGraph(JSON.parse(canonicalize(doc)));
  if (!parsed.doc) return { schema: parsed.issues };
  return { doc: parsed.doc, issues: validate(parsed.doc) };
}

// ─── list ─────────────────────────────────────────────────────────────────

export type ListFlags = { json?: boolean; registries: string[] };

export async function templateList(io: Output, env: RegistryEnv, flags: ListFlags): Promise<number> {
  const { found, skipped } = scanLocal(env);
  const rows: (Found & { shadowedBy?: string })[] = [];
  const winner = new Map<string, Found>();
  for (const f of found) {
    const first = winner.get(f.doc.id);
    if (first) rows.push({ ...f, shadowedBy: first.source });
    else {
      winner.set(f.doc.id, f);
      rows.push(f);
    }
  }

  const remoteErrors: string[] = [];
  const remote: { url: string; entry: Found["entry"]; shadowedBy?: string }[] = [];
  for (const registry of flags.registries) {
    try {
      const index = await fetchIndex(registry, env);
      for (const entry of index.templates) {
        const first = winner.get(entry.id);
        remote.push({ url: index.url, entry, ...(first ? { shadowedBy: first.source } : {}) });
      }
    } catch (err) {
      if (!(err instanceof RegistryError)) throw err;
      remoteErrors.push(err.message);
    }
  }

  if (flags.json === true) {
    io.out(
      JSON.stringify(
        {
          templates: [
            ...rows.map((r) => ({ ...r.entry, source: r.source, location: r.location, ...(r.shadowedBy ? { shadowedBy: r.shadowedBy } : {}) })),
            ...remote.map((r) => ({ ...r.entry, source: "remote", location: new URL(r.entry.file, r.url).href, ...(r.shadowedBy ? { shadowedBy: r.shadowedBy } : {}) })),
          ],
          skipped,
          errors: remoteErrors,
        },
        null,
        2,
      ),
    );
    return remoteErrors.length > 0 ? 1 : 0;
  }

  const width = Math.max(24, ...rows.map((r) => r.doc.id.length), ...remote.map((r) => r.entry.id.length)) + 2;
  const line = (id: string, kind: TemplateKind, profile: Profile, shadowedBy: string | undefined, when: string): void => {
    io.out(`  ${id.padEnd(width)}${kind.padEnd(10)}${profileText(profile)}${shadowedBy ? `   (shadowed by the ${shadowedBy} one)` : ""}`);
    io.out(`      ${when}`);
  };
  const groups: [string, (Found & { shadowedBy?: string })[]][] = (["project", "user", "built-in"] as const).map((source) => [
    source,
    rows.filter((r) => r.source === source),
  ]);
  for (const [source, list] of groups) {
    if (list.length === 0) continue;
    io.out(`${source} (${list[0]!.location.slice(0, list[0]!.location.lastIndexOf("/") + 1)})`);
    for (const r of list) line(r.doc.id, r.entry.kind, r.entry.profile, r.shadowedBy, r.entry.whenToUse);
    io.out("");
  }
  for (const url of [...new Set(remote.map((r) => r.url))]) {
    io.out(`remote (${url})`);
    for (const r of remote.filter((x) => x.url === url)) line(r.entry.id, r.entry.kind, r.entry.profile, r.shadowedBy, r.entry.whenToUse);
    io.out("");
  }
  for (const s of skipped) io.err(`skipped ${s.location}: it ${s.reason}`);
  for (const message of remoteErrors) io.err(`grooph: ${message}`);
  const count = winner.size + remote.filter((r) => !r.shadowedBy).length;
  io.out(`${plural(count, "template")}. Read one: grooph template show <name>. Start from one: grooph template use <name> --name "<graph name>".`);
  return remoteErrors.length > 0 ? 1 : 0;
}

// ─── show ─────────────────────────────────────────────────────────────────

export type ShowFlags = { json?: boolean; registries: string[] };

export async function templateShow(io: Output, env: RegistryEnv, name: string, flags: ShowFlags): Promise<number> {
  const found = await resolveTemplate(name, env, flags.registries);
  const { doc, entry } = found;
  const block = doc.template!;
  if (flags.json === true) {
    io.out(JSON.stringify({ source: found.source, location: found.location, entry, template: doc }, null, 2));
    return 0;
  }

  io.out(`${doc.id} · ${block.title} (${block.kind}, version ${doc.version})`);
  io.out(`from ${where(found)}`);
  io.out("");
  io.out(block.summary);
  io.out("");
  io.out(`When to use: ${block.whenToUse}`);
  if (block.notFor !== undefined) io.out(`Not for: ${block.notFor}`);
  io.out(`Profile: cost ${block.profile.cost} · speed ${block.profile.speed} · rigor ${block.profile.rigor}`);
  if (block.tags !== undefined && block.tags.length > 0) io.out(`Tags: ${block.tags.join(", ")}`);
  // decision 0010: what was taken from whose published work, with the link; never an endorsement.
  for (const credit of block.credits ?? []) io.out(`Inspired by: ${credit.name} <${credit.url}> — ${credit.note}`);

  const slots = block.slots ?? [];
  if (slots.length > 0) {
    io.out("");
    io.out("Slots:");
    const width = Math.max(...slots.map((s) => s.key.length)) + 2;
    for (const slot of slots) io.out(`  ${slot.key.padEnd(width)}${slot.ask}\n  ${"".padEnd(width)}e.g. ${slot.example}`);
  }

  io.out("");
  io.out("Nodes:");
  for (const node of doc.nodes) {
    const detail =
      node.kind === "agent"
        ? `${typeof node.role === "string" ? node.role : node.role.custom}${node.model ? `, ${node.model.tier}` : ""}${
            (node.irreversible ?? []).length > 0 ? `, irreversible: ${node.irreversible!.join(", ")}` : ""
          }`
        : node.kind;
    io.out(`  ${node.id} (${detail})`);
  }
  io.out("Edges:");
  for (const edge of doc.edges) {
    const when = edge.when === undefined || edge.when === "always" ? "" : typeof edge.when === "string" ? ` [${edge.when}]` : ` [verdict ${edge.when.verdict}]`;
    io.out(`  ${edge.from} → ${edge.to}${when}${edge.concurrency ? ` (up to ${edge.concurrency.max} at a time)` : ""}${edge.approval ? " (needs approval)" : ""}`);
  }
  for (const loop of doc.loops) {
    io.out(`Loop ${loop.id}: ${loop.members.join(", ")}; stops: ${loop.stops.map(describeStop).join(", ")}`);
    if (loop.bar) io.out(`  bar: ${loop.bar.acceptance}`);
  }
  if (doc.adaptation !== undefined) io.out(`Adaptation: ${doc.adaptation}`);

  io.out("");
  const sets = slots.map((s) => ` --set ${s.key}="…"`).join("");
  io.out(
    block.kind === "fragment"
      ? `Insert it: grooph template insert ${doc.id} --into <graph.grooph.json>${sets} --write`
      : `Use it: grooph template use ${doc.id} --name "<graph name>"${sets} --out <file>`,
  );
  return 0;
}

// ─── use ──────────────────────────────────────────────────────────────────

export type UseFlags = { name: string; sets: string[]; out?: string; force?: boolean; registries: string[] };

export async function templateUse(io: Output, env: RegistryEnv, name: string, flags: UseFlags): Promise<number> {
  const found = await resolveTemplate(name, env, flags.registries);
  if (found.doc.template?.kind === "fragment") {
    throw new RegistryError(`"${name}" is a fragment, not a whole graph; insert it into a graph: grooph template insert ${name} --into <file>`);
  }
  if (flags.out !== undefined && existsSync(resolve(flags.out)) && flags.force !== true) {
    throw new RegistryError(`${flags.out} already exists; pass --force to overwrite it`);
  }
  const doc = instantiate(found.doc, { name: flags.name, values: parseSets(flags.sets) });
  const checked = checkWritable(doc);
  if ("schema" in checked) {
    io.err(`the graph made from "${name}" does not match the schema, so nothing was written:`);
    printIssues(io, checked.schema, flags.out ?? name);
    return 1;
  }

  // With no --out the document is the output, so everything else goes to stderr.
  const info: Output = flags.out === undefined ? { out: io.err, err: io.err } : io;
  if (flags.out === undefined) process.stdout.write(canonicalize(checked.doc));
  else writeText(flags.out, canonicalize(checked.doc));

  askForSlots(io, checked.doc, found.doc);
  printIssues(info, checked.issues, flags.out ?? checked.doc.id);
  if (flags.out !== undefined) {
    info.out(`wrote ${flags.out} (graph "${checked.doc.id}" from ${found.doc.id}@${found.doc.version}, ${found.source})`);
    info.out(`next: grooph validate --for-export ${flags.out}`);
  }
  return hasErrors(checked.issues) ? 1 : 0;
}

// ─── insert ───────────────────────────────────────────────────────────────

export type InsertFlags = { into: string; sets: string[]; prefix?: string; write?: boolean; registries: string[] };

export async function templateInsert(io: Output, env: RegistryEnv, name: string, flags: InsertFlags): Promise<number> {
  const host = parseGraphText(readText(flags.into));
  if (!host.doc) {
    io.err(`cannot insert into ${flags.into}: it does not match the schema`);
    printIssues(io, host.issues, flags.into);
    return 1;
  }
  const found = await resolveTemplate(name, env, flags.registries);
  const result = insertFragment(host.doc, found.doc, {
    values: parseSets(flags.sets),
    ...(flags.prefix !== undefined ? { prefix: flags.prefix } : {}),
  });
  const checked = checkWritable(result.doc);
  if ("schema" in checked) {
    io.err(`inserting "${name}" leaves ${flags.into} failing the schema, so it is unchanged:`);
    printIssues(io, checked.schema, flags.into);
    return 1;
  }

  const nodes = found.doc.nodes.length;
  const edges = found.doc.edges.length;
  io.out(`inserted ${found.doc.id}@${found.doc.version} (${found.source}): ${plural(nodes, "node")}, ${plural(edges, "edge")}, ${plural(found.doc.loops.length, "loop")}`);
  io.out("ids (template → graph):");
  for (const [from, to] of Object.entries(result.ids)) io.out(`  ${from} → ${to}${from === to ? "" : "   (renamed)"}`);

  const inserted = new Set(found.doc.nodes.map((n) => result.ids[n.id]!));
  const entries = entryNodeIds(indexGraph(checked.doc)).filter((id) => inserted.has(id));
  if (entries.length > 0) {
    io.out(
      `nothing leads into ${entries.map((id) => `"${id}"`).join(", ")} yet; connect it with grooph apply, e.g. [{"op": "connect", "from": "<node>", "to": "${entries[0]}"}]`,
    );
  }

  askForSlots(io, checked.doc, found.doc);
  printIssues(io, checked.issues, flags.into);
  if (flags.write === true) {
    writeText(flags.into, canonicalize(checked.doc));
    io.out(`wrote ${flags.into}`);
  } else {
    io.out(`${flags.into} not written (dry run — pass --write to save)`);
  }
  return hasErrors(checked.issues) ? 1 : 0;
}

// ─── save ─────────────────────────────────────────────────────────────────

export type SaveFlags = {
  id: string;
  title: string;
  summary: string;
  when: string;
  fragment?: boolean;
  nodes?: string[];
  to: "project" | "user";
  force?: boolean;
};

const registryDir = (env: RegistryEnv, to: "project" | "user"): string => (to === "user" ? env.userDir : projectDir(env));

export function templateSave(io: Output, env: RegistryEnv, file: string, flags: SaveFlags): number {
  const parsed = parseGraphText(readText(file));
  if (!parsed.doc) {
    io.err(`cannot save ${file} as a template: it does not match the schema`);
    printIssues(io, parsed.issues, file);
    return 1;
  }
  const template = extractTemplate(parsed.doc, {
    kind: flags.fragment === true ? "fragment" : "graph",
    ...(flags.nodes !== undefined ? { nodeIds: flags.nodes } : {}),
    meta: { id: flags.id, title: flags.title, summary: flags.summary, whenToUse: flags.when },
  });
  const issues = validate(template);
  if (hasErrors(issues)) {
    io.err(`not saved: the template would carry these errors`);
    printIssues(io, issues, flags.id);
    const kept = new Set(template.nodes.map((node) => node.id));
    for (const loop of parsed.doc.loops) {
      const outside = loop.members.filter((id) => !kept.has(id));
      if (outside.length > 0 && outside.length < loop.members.length) {
        io.err(`loop "${loop.id}" stayed behind: a loop comes along only with all its members; add ${outside.join(", ")} to --nodes`);
      }
    }
    return 1;
  }

  const saved = saveToRegistry(registryDir(env, flags.to), template, { force: flags.force === true, bump: true });
  const block = saved.doc.template!;
  printIssues(io, issues, flags.id);
  io.out(
    `saved ${saved.doc.id}@${saved.doc.version} (${block.kind}: ${plural(saved.doc.nodes.length, "node")}, ${plural(
      saved.doc.edges.length,
      "edge",
    )}, ${plural(saved.doc.loops.length, "loop")}) to ${saved.path}${saved.replaced ? ", replacing the previous version" : ""}`,
  );
  io.out(`profile (estimated from the graph; edit the template block if it reads wrong): ${profileText(block.profile)}`);
  for (const slot of block.slots ?? []) io.out(`slot {{${slot.key}}} carried over; give it a real question and example in the file`);
  io.out(
    block.kind === "fragment"
      ? `insert it: grooph template insert ${saved.doc.id} --into <graph.grooph.json> --write`
      : `use it: grooph template use ${saved.doc.id} --name "<graph name>" --out <file>`,
  );
  return 0;
}

// ─── add ──────────────────────────────────────────────────────────────────

export type AddFlags = { to: "project" | "user"; force?: boolean; registries: string[] };

export async function templateAdd(io: Output, env: RegistryEnv, nameOrUrl: string, flags: AddFlags): Promise<number> {
  const found = isUrl(nameOrUrl)
    ? await fetchTemplate(nameOrUrl, env)
    : await resolveRemote(nameOrUrl, flags.registries.length > 0 ? flags.registries : [env.defaultRegistry], env);
  const issues = validate(found.doc);
  if (hasErrors(issues)) {
    io.err(`not added: ${found.location} carries errors`);
    printIssues(io, issues, found.doc.id);
    return 1;
  }
  const saved = saveToRegistry(registryDir(env, flags.to), found.doc, { force: flags.force === true });
  io.out(`added ${saved.doc.id}@${saved.doc.version} from ${found.location} to ${saved.path}${saved.replaced ? ", replacing the copy there" : ""}`);
  io.out(`it now resolves locally (${flags.to}), ahead of the built-in library: grooph template show ${saved.doc.id}`);
  return 0;
}
