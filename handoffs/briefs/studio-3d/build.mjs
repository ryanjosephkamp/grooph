#!/usr/bin/env node
/**
 * Build the 3D studio (slice 0094): one page of sketches for the owner, other ways of seeing a loop graph in three
 * dimensions, each drawn from the same four real documents.
 *
 *   pnpm --filter @grooph/core build && node handoffs/briefs/studio-3d/build.mjs           write ../studio-3d.html
 *   node handoffs/briefs/studio-3d/build.mjs --check                                        exit 1 if it is stale
 *
 * The page fetches nothing, so what it draws is worked out here, by core's own functions, and put in the page as
 * data: the rows of the layout (`layerNodes`, `autoLayout`), a stop in a person's words (`describeStop`), an edge's
 * condition (`edgeWhenLabel`), a role's name (`roleName`), and a run's notes as steps with their captions
 * (`buildRunBundle`, `replaySteps`). What core has no function to call for is worked out below, the way the code
 * that does it works it out, and said on the page: the order of a first pass (`firstPass` in
 * `apps/web/src/ui/canvas/graph-views.tsx`), which loop is inside which, what a full round of a loop costs in
 * dispatches (`dispatchesPerRound` in `packages/core/src/compile/claude-code/lead.ts`: each member that is an agent
 * or a check, once), and how long each dispatch of the run took by the stamps on its notes.
 *
 * The page is `page.html` with `page.css`, the data and `views.js` put where it says. Nothing here is in the product.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const core = await import(join(root, "packages/core/dist/src/index.js")).catch(() => {
  console.error("studio-3d: core is not built. Run `pnpm --filter @grooph/core build` first.");
  process.exit(1);
});
const { parseGraphText, layerNodes, autoLayout, describeStop, edgeWhen, edgeWhenLabel, roleName, buildRunBundle, replaySteps } = core;

const KIND = { "human-gate": "Human gate", check: "Check", merge: "Merge", stop: "Stop" };
const read = (path) => readFileSync(join(root, path), "utf8");
const graphAt = (path) => {
  const parsed = parseGraphText(read(path));
  if (!parsed.doc) throw new Error(`${path} is not a graph document`);
  return parsed.doc;
};

/** The edges of a first pass, in the order of the graph's rows, and then each loop's back edges: one turn of each. */
function firstPass(doc) {
  const rank = new Map(layerNodes(doc).flat().map((id, k) => [id, k]));
  const back = new Map(doc.loops.flatMap((loop) => loop.back.map((id) => [id, loop.id])));
  const forward = doc.edges.filter((e) => !back.has(e.id)).sort((a, b) => rank.get(a.from) - rank.get(b.from) || rank.get(a.to) - rank.get(b.to));
  return [...forward.map((e) => ({ edge: e.id })), ...doc.loops.flatMap((loop) => loop.back.map((id) => ({ edge: id, loop: loop.id })))];
}

/** What a view needs of a document, and nothing a view could get wrong by working it out again. */
function model(doc, about) {
  const rows = layerNodes(doc);
  const rank = new Map(rows.flat().map((id, k) => [id, k]));
  const at = autoLayout(doc, 3);
  const name = (id) => doc.nodes.find((n) => n.id === id)?.name || id;
  // A loop is inside another when its members are some of the other's, and not all of them.
  const inside = (loop) =>
    doc.loops
      .filter((outer) => outer.id !== loop.id && outer.members.length > loop.members.length && loop.members.every((m) => outer.members.includes(m)))
      .sort((a, b) => a.members.length - b.members.length)[0]?.id ?? null;
  const loops = doc.loops.map((loop) => {
    const stop = (kind) => loop.stops.find((s) => s.kind === kind);
    return {
      id: loop.id,
      name: loop.name || loop.id,
      inside: inside(loop),
      // In the order a first pass meets them.
      members: [...loop.members].sort((a, b) => rank.get(a) - rank.get(b)),
      back: loop.back,
      stops: loop.stops.map((s) => ({ kind: s.kind, words: describeStop(s) })),
      cap: stop("max-iterations")?.n ?? null,
      budget: stop("budget") ? { measure: stop("budget").measure, limit: stop("budget").limit } : null,
      // A person is asked every so many rounds (a `human` stop with `every`).
      human: stop("human")?.every ?? null,
      // What the compiler tells a lead a full round costs: each member that is an agent or a check, once. A loop
      // inside this one is in that count at one round of its own; every further round of it adds its own on top,
      // and a node dispatched twice in a round (invalid evidence) counts twice.
      perRound: loop.members.filter((id) => ["agent", "check"].includes(doc.nodes.find((n) => n.id === id)?.kind)).length,
    };
  });
  // The nodes that are a loop's own: its members that are in no loop inside it.
  for (const loop of loops) loop.own = loop.members.filter((m) => !loops.some((inner) => inner.inside === loop.id && inner.members.includes(m)));
  const innermost = (id) => loops.filter((l) => l.members.includes(id)).sort((a, b) => a.members.length - b.members.length)[0]?.id ?? null;
  const back = new Map(doc.loops.flatMap((loop) => loop.back.map((id) => [id, loop.id])));
  return {
    id: doc.id,
    name: doc.name || doc.id,
    about,
    rows,
    nodes: doc.nodes.map((n) => ({
      id: n.id,
      name: n.name || n.id,
      kind: n.kind,
      line: n.kind === "agent" ? [roleName(n), n.model?.tier ?? "session default", n.effort].filter(Boolean).join(" · ") : KIND[n.kind],
      tier: n.kind === "agent" ? (n.model?.tier ?? "unset") : null,
      loop: innermost(n.id),
      group: (doc.groups ?? []).find((g) => g.members.includes(n.id))?.id ?? null,
      at: [at[n.id].x, at[n.id].y],
    })),
    edges: doc.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, when: edgeWhen(e) ? edgeWhenLabel(e) : "", back: back.get(e.id) ?? null })),
    loops,
    groups: (doc.groups ?? []).map((g) => ({ id: g.id, name: g.name || g.id, from: g.from ?? null, members: g.members })),
    pass: firstPass(doc).map(({ edge, loop }) => {
      const e = doc.edges.find((x) => x.id === edge);
      return { edge, loop: loop ?? null, says: `${name(e.from)} to ${name(e.to)}${edgeWhen(e) ? ` · ${edgeWhenLabel(e)}` : ""}${loop ? ` · back into ${loops.find((l) => l.id === loop).name}: another round` : ""}` };
    }),
  };
}

/** A recorded run: its working copy as the model, and its notes as core replays them. */
function run(folder, about) {
  const dir = join(root, folder);
  const one = readdirSync(join(dir, "runs")).sort()[0];
  const working = graphAt(join(folder, "runs", one, "graph.grooph.json"));
  const bundle = buildRunBundle({ source: graphAt(join(folder, "graph.grooph.json")), working, notesText: read(join(folder, "runs", one, "notes.jsonl")), run: one });
  const replay = replaySteps(bundle.notes, working);
  const m = model(working, about);
  const minutes = (a, b) => Math.round(((Date.parse(b) - Date.parse(a)) / 60000) * 100) / 100;
  // How long each dispatch took, by the stamps on the notes: from the end of the dispatch before it (for the first,
  // from its own start) to its own end. A note's own `started` is not used past the first: two of this run's are
  // later than their `ended`, as the lead wrote them.
  let last;
  const dispatches = [];
  m.steps = replay.steps.slice(1).map((step) => {
    const note = step.note;
    const focus = step.focus ?? { kind: "graph" };
    // The note's own words, cut at a word: a note about the run or about an edge is not a move, and core's short
    // caption for it says less than the note does.
    const own = note.proposal?.summary ?? note.amendment?.summary ?? note.text ?? "";
    const words = own.length > 150 ? `${own.slice(0, own.lastIndexOf(" ", 150))} …` : own;
    const out = { says: step.caption, about: focus.kind, id: focus.id ?? null, round: note.round ?? null, outcome: note.outcome ?? null, what: note.proposal ? "proposal" : note.amendment ? "amendment" : null, words };
    const node = focus.kind === "node" ? working.nodes.find((n) => n.id === focus.id) : undefined;
    if (node && ["agent", "check"].includes(node.kind) && note.ended) {
      const took = minutes(last ?? note.started ?? note.ended, note.ended);
      last = note.ended;
      out.dispatch = dispatches.push({ node: node.id, round: note.round ?? 0, outcome: note.outcome ?? null, minutes: took, noted: note.cost ? `${note.cost.amount} ${note.cost.measure}` : null }) - 1;
    }
    return out;
  });
  const spent = [...bundle.notes].reverse().find((n) => n.at === "graph" && n.cost);
  m.run = {
    id: one,
    end: replay.end.line,
    dispatches,
    loops: replay.end.loops.map((l) => ({ loop: l.loop, round: l.round ?? null, fired: l.fired ?? null })),
    spent: spent ? { measure: spent.cost.measure, amount: spent.cost.amount } : null,
  };
  return m;
}

const data = [
  model(graphAt("patterns/review-gate.grooph.json"), "A small template: one loop, four nodes."),
  model(graphAt("patterns/gauntlet-decomposed.grooph.json"), "A large template: ten nodes, and a loop inside a loop."),
  model(graphAt("fixtures/valid/subgrooph-in-a-graph.grooph.json"), "A graph with a subgrooph: the review gate placed in it as a unit, inside a plain group."),
  run("fixtures/runs/slice-0007-sandwich", "A recorded run: slice 0007, rounds 0 and 1 of one loop, with its fifteen notes."),
];

const page = readFileSync(join(here, "page.html"), "utf8")
  .replace("/*CSS*/", () => readFileSync(join(here, "page.css"), "utf8").trimEnd())
  .replace("/*DATA*/", () => JSON.stringify(data).replace(/</g, "\\u003c"))
  .replace("/*VIEWS*/", () => readFileSync(join(here, "views.js"), "utf8").trimEnd());
const out = join(here, "..", "studio-3d.html");
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== page) {
    console.error("studio-3d: handoffs/briefs/studio-3d.html is not what its sources build. Run node handoffs/briefs/studio-3d/build.mjs");
    process.exit(1);
  }
  console.log("studio-3d: the page is what its sources build");
} else if (process.argv.includes("--data")) {
  console.log(JSON.stringify(data, null, 1));
} else {
  writeFileSync(out, page);
  console.log(`studio-3d: wrote handoffs/briefs/studio-3d.html, ${Math.ceil(Buffer.byteLength(page) / 1024)} KB`);
}
