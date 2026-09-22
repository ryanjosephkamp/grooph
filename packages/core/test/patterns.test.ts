/**
 * The pattern library (docs/templates.md §5): the twenty documents under
 * patterns/ (sixteen from spec §10, four from prior art since slice 0017), the
 * rules every one of them follows, and the generated index.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalize, canonicalizeWithoutLayout } from "../src/canonicalize.js";
import { indexGraph } from "../src/graph-index.js";
import { parseGraphText } from "../src/parse.js";
import { isCriticFamily, loopMode } from "../src/semantics.js";
import { findSlots, insertFragment, instantiate, slotKeys, templateIndexEntry } from "../src/template.js";
import type { AgentNode, Graph, Profile, TemplateKind } from "../src/types.js";
import { DOC_SIZE_LIMIT, validate } from "../src/validate.js";
import { expectedIssues, read, repoRoot } from "./helpers.js";

const patternsDir = join(repoRoot, "patterns");

/** The four templates adopted from prior art (decision 0010, slice 0017), each with a credit that says what was taken. */
const PRIOR_ART = ["ralph-loop", "patrol-pulse", "gauntlet-decomposed", "merge-queue"];

/** docs/templates.md §5, the table: id → kind and profile (cost · speed · rigor). */
const TABLE: Record<string, { kind: TemplateKind; profile: `${Profile["cost"]} ${Profile["speed"]} ${Profile["rigor"]}` }> = {
  "grind-loop": { kind: "graph", profile: "low fast light" },
  "review-gate": { kind: "graph", profile: "medium medium standard" },
  "taste-polish": { kind: "graph", profile: "high slow high" },
  "spec-then-loop": { kind: "graph", profile: "medium medium high" },
  "metric-sandwich": { kind: "graph", profile: "medium medium standard" },
  "dual-bar": { kind: "graph", profile: "medium medium standard" },
  "specialist-critic-bank": { kind: "graph", profile: "high medium high" },
  "heterogeneous-critic": { kind: "graph", profile: "medium medium high" },
  "ownership-not-swarm": { kind: "graph", profile: "medium medium standard" },
  "tournament-then-judge": { kind: "graph", profile: "medium fast standard" },
  "contradiction-seeker": { kind: "graph", profile: "low fast standard" },
  "red-team-loop": { kind: "graph", profile: "medium medium high" },
  "debate-then-build": { kind: "graph", profile: "medium medium standard" },
  "human-gated-irreversible": { kind: "fragment", profile: "low fast standard" },
  "retrospective-rewrite": { kind: "graph", profile: "low medium standard" },
  "fresh-grind-rare-judge": { kind: "graph", profile: "medium medium high" },
  "ralph-loop": { kind: "graph", profile: "low fast light" },
  "patrol-pulse": { kind: "graph", profile: "low fast standard" },
  "gauntlet-decomposed": { kind: "graph", profile: "high slow high" },
  "merge-queue": { kind: "fragment", profile: "low medium standard" },
};

/** docs/templates.md §5: the patterns whose shape or name comes from someone's published work (decision 0010). */
const CREDITED = new Set(["taste-polish", "ownership-not-swarm", "spec-then-loop", ...PRIOR_ART]);
/** Slice 0014 added a credit to three existing patterns (version 2); slice 0017's four were born credited (version 1). */
const CREDITED_IN_0014 = new Set(["taste-polish", "ownership-not-swarm", "spec-then-loop"]);

const files = readdirSync(patternsDir).filter((name) => name.endsWith(".grooph.json")).sort();

const load = (file: string): Graph => {
  const parsed = parseGraphText(read(join(patternsDir, file)));
  assert.deepEqual(parsed.issues, [], `${file} matches the schema`);
  return parsed.doc!;
};

const examples = (doc: Graph): Record<string, string> =>
  Object.fromEntries((doc.template?.slots ?? []).map((slot) => [slot.key, slot.example]));

/** A pattern made concrete with its slot examples: instantiated, or (a fragment) inserted into a host with a goal and target. */
function concrete(doc: Graph): Graph {
  if (doc.template?.kind === "fragment") {
    const host: Graph = { grooph: 0, id: "host", name: "Host", version: 1, goal: "Ship it.", target: { harness: "claude-code" }, nodes: [], edges: [], loops: [] };
    return insertFragment(host, doc, { values: examples(doc) }).doc;
  }
  return instantiate(doc, { name: "Try it", values: examples(doc) });
}

test("patterns/ holds exactly the twenty patterns of docs/templates.md §5", () => {
  assert.deepEqual(files.map((f) => f.replace(/\.grooph\.json$/, "")), Object.keys(TABLE).sort());
});

for (const file of files) {
  const id = file.replace(/\.grooph\.json$/, "");

  test(`patterns/${file} instantiates with its slot examples and validates for export as its sidecar says`, () => {
    const doc = load(file);
    assert.equal(canonicalize(doc), read(join(patternsDir, file)), "stored in canonical form");
    assert.deepEqual(validate(doc).filter((i) => i.severity === "error"), [], "the template itself has no errors");

    const graph = concrete(doc);
    assert.deepEqual(findSlots(graph), [], "every slot has an example");
    const issues = validate(graph, { forExport: true });
    assert.deepEqual(issues.filter((i) => i.severity === "error"), [], "no errors once filled");
    assert.deepEqual(issues.map((i) => i.code), expectedIssues(join(patternsDir, file)) ?? [], "warnings exactly as the sidecar lists");
  });

  test(`patterns/${file} follows the §5 rules`, () => {
    const doc = load(file);
    const block = doc.template!;
    assert.equal(doc.id, id, "named after its id");
    assert.equal(block.kind, TABLE[id]!.kind);
    assert.equal(`${block.profile.cost} ${block.profile.speed} ${block.profile.rigor}`, TABLE[id]!.profile);
    assert.equal(doc.version, CREDITED_IN_0014.has(id) ? 2 : 1, "version 1, or 2 where slice 0014 added a credit");
    assert.equal(doc.layout, undefined, "layout-free: the app places nodes");

    // Credits (docs/templates.md §1 and §5, decision 0010): the three patterns that owe one carry it, and every credit is complete with a web link.
    assert.equal((block.credits ?? []).length > 0, CREDITED.has(id), `${id} ${CREDITED.has(id) ? "credits its source" : "owes no credit"}`);
    for (const credit of block.credits ?? []) {
      assert.ok(credit.name.trim() && credit.url.trim() && credit.note.trim(), `${id}: a credit names the source, its URL and what was taken`);
      assert.match(credit.url, /^https?:\/\/\S+$/, `${id}: credit URL is a web link`);
      assert.doesNotMatch(credit.note, /\bendors/i, `${id}: a credit says what was taken, never endorsement`);
    }
    // Half the budget, except the one composite (nine nodes, two nested loops, two gates) that slice 0017 trimmed to three fifths.
    assert.ok(canonicalizeWithoutLayout(doc).length < DOC_SIZE_LIMIT * (id === "gauntlet-decomposed" ? 0.6 : 0.5), "well under the W_DOC_TOO_LARGE budget");

    // Slots: every one declared is used, every one used is declared, and each has a question and an example.
    const declared = (block.slots ?? []).map((slot) => slot.key);
    assert.deepEqual(slotKeys(doc), declared, "no undeclared {{key}}");
    for (const key of declared) assert.ok(findSlots(doc).some((use) => use.key === key), `slot ${key} is used`);
    for (const slot of block.slots ?? []) assert.ok(slot.ask.trim() && slot.example.trim(), `slot ${slot.key} has an ask and an example`);
    if (block.kind === "graph") assert.ok(declared.includes("task"), "a graph pattern asks for the task");

    // Adaptive unless the pattern says otherwise.
    assert.equal(doc.adaptation, id === "retrospective-rewrite" ? "propose" : undefined);

    // Latitude: briefs are purpose, limits and outputs in a few sentences, no step lists.
    for (const node of doc.nodes.filter((n): n is AgentNode => n.kind === "agent")) {
      const sentences = node.brief.split(/(?<=[.?!])\s+(?=[A-Z`{])/).length;
      assert.ok(sentences <= 4, `${node.id}: brief has ${sentences} sentences`);
      assert.doesNotMatch(node.brief, /(^|\s)(1\.|2\.|- )/, `${node.id}: no step list`);
    }

    // Critics are fresh, have evidence, may write their report, and may not edit.
    const index = indexGraph(doc);
    for (const node of doc.nodes.filter(isCriticFamily) as AgentNode[]) {
      assert.ok(node.allow?.includes("write-outputs"), `${node.id} may write its report`);
      assert.ok(node.deny?.includes("edit-files"), `${node.id} may not edit files`);
      for (const edge of index.incoming.get(node.id) ?? []) {
        assert.notEqual(edge.isolation, "shared", `${edge.id} into ${node.id} is fresh`);
        assert.ok((edge.evidence ?? []).length > 0, `${edge.id} into ${node.id} lists evidence`);
      }
    }

    // Every loop is braked: a budget the lead can count (dispatches or minutes, handoff 0010), and a max-iterations of 5 or fewer, besides its real stop.
    for (const loop of doc.loops) {
      const budget = loop.stops.find((s) => s.kind === "budget");
      assert.ok(budget && (budget.measure === "dispatches" || budget.measure === "minutes"), `${loop.id} has a budget stop in dispatches or minutes`);
      const cap = loop.stops.find((s) => s.kind === "max-iterations");
      assert.ok(cap && cap.n <= 5, `${loop.id} has max-iterations ≤ 5`);
      if (loopMode(index, loop) === "judgment") assert.ok(loop.bar, `${loop.id} is a judgment loop with a bar`);
      // A dispatch is one node run, so a dispatches budget is sized against what the round cap already allows:
      // at least the members that run each pass times the cap, at most a repair or two more (the shape line stays honest).
      if (budget.measure === "dispatches") {
        const dispatchable = (members: string[]) => members.filter((m) => ["agent", "check"].includes(doc.nodes.find((n) => n.id === m)!.kind));
        const inner = doc.loops.filter((other) => other !== loop && other.members.every((m) => loop.members.includes(m)) && other.members.length < loop.members.length);
        const innerMembers = new Set(inner.flatMap((other) => other.members));
        // One pass of this loop: its own members once, plus each nested loop run to its cap (graph-ir §2, nested loops).
        const perPass =
          dispatchable(loop.members.filter((m) => !innerMembers.has(m))).length +
          inner.reduce((n, other) => n + dispatchable(other.members).length * (other.stops.find((s) => s.kind === "max-iterations") as { n: number }).n, 0);
        const floor = perPass * cap.n;
        assert.ok(budget.limit >= floor && budget.limit <= floor + 2, `${loop.id}: ${budget.limit} dispatches against ${perPass} per pass × ${cap.n} rounds = ${floor}`);
      }
    }
  });
}

test("patterns the §5 table singles out keep their point", () => {
  const byId = (id: string): Graph => load(`${id}.grooph.json`);

  const hetero = byId("heterogeneous-critic");
  assert.ok(!validate(hetero).some((i) => i.code === "W_HOMOGENEOUS_CRITICS"), "heterogeneous-critic does not raise W_HOMOGENEOUS_CRITICS");
  assert.match(hetero.description ?? "", /stage 11/, "and says cross-family judging needs a dual-harness node");

  const spec = byId("spec-then-loop");
  assert.equal(spec.loops[0]!.bar?.answerKeyFrom, "planner");

  const sandwich = byId("metric-sandwich");
  assert.equal(sandwich.loops.length, 1);
  assert.equal(sandwich.loops[0]!.back.length, 2, "one loop, two back edges");

  const bank = byId("specialist-critic-bank");
  assert.ok(bank.policies?.some((p) => p.kind === "concurrency-cap" && p.params?.["max"] === 4));
  assert.equal(bank.nodes.filter((n) => n.kind === "agent" && n.role === "critic").length, 4);

  const swarm = byId("ownership-not-swarm");
  const owners = swarm.nodes.filter((n): n is AgentNode => n.kind === "agent" && n.coupled === true);
  assert.equal(owners.length, 2);
  assert.notDeepEqual(owners[0]!.owns, owners[1]!.owns, "coupled owners own distinct subsystems");
  const fanOut = swarm.edges.filter((e) => (e.concurrency?.max ?? 1) > 1);
  assert.ok(fanOut.length > 0 && fanOut.every((e) => !swarm.nodes.find((n) => n.id === e.to)?.coupled), "fan-out only into uncoupled work");

  const tournament = byId("tournament-then-judge");
  assert.deepEqual(tournament.loops, [], "the tournament runs once");

  const seeker = byId("contradiction-seeker");
  assert.ok(seeker.loops[0]!.stops.some((s) => s.kind === "budget" && s.measure === "dispatches"));
  assert.ok(seeker.loops[0]!.stops.some((s) => s.kind === "max-iterations" && s.n === 3));
  assert.doesNotMatch(seeker.description ?? "", /budget is the point/, "the hunt's bound is the critic's brief, not the loop budget (0009 finding)");
  assert.match((seeker.nodes.find((n) => n.id === "critic") as AgentNode).brief, /about ten distinct attempts/, "and the brief names it");
  assert.ok((seeker.nodes.find((n) => n.id === "critic") as AgentNode).allow?.includes("run-commands"), "the hunter runs the code");

  const redTeam = byId("red-team-loop");
  assert.deepEqual((redTeam.nodes.find((n) => n.id === "red-team") as AgentNode).owns, ["traces"]);
  assert.ok(redTeam.loops[0]!.stops.some((s) => s.kind === "diminishing-returns" && s.rounds === 2));

  const debate = byId("debate-then-build");
  assert.ok(debate.loops.find((l) => l.id === "debate")!.stops.some((s) => s.kind === "max-iterations" && s.n === 2));

  const gated = byId("human-gated-irreversible");
  const act = gated.nodes.find((n) => n.kind === "agent" && (n.irreversible ?? []).length > 0)!;
  assert.ok((indexGraph(gated).incoming.get(act.id) ?? []).every((e) => gated.nodes.find((n) => n.id === e.from)?.kind === "human-gate"));

  const phased = byId("fresh-grind-rare-judge");
  assert.equal(phased.loops.length, 2, "an inner grind loop and an outer judgment loop");

  const taste = byId("taste-polish");
  const kinds = taste.loops[0]!.stops.map((s) => s.kind);
  assert.deepEqual(kinds, ["bar-passed", "diminishing-returns", "human", "max-iterations", "budget"]);
  assert.ok(taste.nodes.some((n) => n.kind === "check" && n.check.kind === "evidence"), "evidence quality is gated before judging");
});

test("handoff 0010: builders get the checklist; critics and judges that assess a change see the repository as the change leaves it", () => {
  const REPO = "the repository as the change leaves it, read-only";
  const byId = (id: string): Graph => load(`${id}.grooph.json`);
  const agent = (doc: Graph, id: string): AgentNode => doc.nodes.find((n) => n.id === id) as AgentNode;

  for (const id of ["review-gate", "metric-sandwich", "heterogeneous-critic"]) {
    assert.ok(agent(byId(id), "builder").inputs?.includes("{{checklist}}"), `${id}: the checklist is among the builder's inputs`);
  }
  assert.ok(agent(byId("spec-then-loop"), "builder").inputs?.includes("ACCEPTANCE.md"));
  assert.ok(agent(byId("fresh-grind-rare-judge"), "builder").inputs?.includes("{{phase-checklist}}"));

  const sees: [string, string, string][] = [
    ["review-gate", "critic", "e-builder-critic"],
    ["metric-sandwich", "critic", "e-checks-critic"],
    ["heterogeneous-critic", "critic", "e-builder-critic"],
    ["spec-then-loop", "critic", "e-builder-critic"],
    ["dual-bar", "critic", "e-builder-critic"],
    ["specialist-critic-bank", "correctness", "e-builder-correctness"],
    ["specialist-critic-bank", "security", "e-builder-security"],
    ["specialist-critic-bank", "performance", "e-builder-performance"],
    ["specialist-critic-bank", "taste", "e-builder-taste"],
    ["fresh-grind-rare-judge", "judge", "e-tests-judge"],
    ["contradiction-seeker", "critic", "e-builder-critic"],
  ];
  for (const [id, nodeId, edgeId] of sees) {
    const doc = byId(id);
    assert.ok(agent(doc, nodeId).inputs?.includes(REPO), `${id}/${nodeId}: the repository is an input`);
    assert.ok(doc.edges.find((e) => e.id === edgeId)?.evidence?.includes(REPO), `${id}/${edgeId}: and inbound evidence`);
  }
  for (const doc of files.map(load)) assert.ok(!JSON.stringify(doc).includes("at the head commit"), `${doc.id}: no "head commit" wording (two leads had to reinterpret it)`);
  for (const id of ["contradiction-seeker", "red-team-loop"]) {
    const hunter = byId(id).nodes.find((n) => n.kind === "agent" && isCriticFamily(n)) as AgentNode;
    assert.ok(hunter.allow?.includes("run-commands"), `${id}: ${hunter.id} may run the code`);
  }
});

test("slice 0017: the four prior-art templates keep their point and their credits", () => {
  const byId = (id: string): Graph => load(`${id}.grooph.json`);
  const agent = (doc: Graph, id: string): AgentNode => doc.nodes.find((n) => n.id === id) as AgentNode;
  const creditUrls = (doc: Graph): string[] => (doc.template?.credits ?? []).map((c) => c.url);

  // ralph-loop: the plan file is the unit of work; the plan check counts unchecked items; the builder commits.
  const ralph = byId("ralph-loop");
  assert.deepEqual(creditUrls(ralph), ["https://ghuntley.com/ralph/"]);
  const planCheck = ralph.nodes.find((n) => n.id === "plan-check");
  assert.equal(planCheck?.kind, "check");
  assert.match(planCheck!.kind === "check" ? planCheck.check.run ?? "" : "", /grep -c '\^- \\\[ \\\]' \{\{plan-file\}\}/, "the plan check counts `- [ ]` lines in the plan file");
  assert.deepEqual(ralph.loops[0]!.back, ["e-tests-fail", "e-plan-check-fail"], "a failing test and a remaining item both return to the builder");
  assert.equal(loopMode(indexGraph(ralph), ralph.loops[0]!), "grind");
  assert.ok(agent(ralph, "builder").allow?.includes("run-commands"), "the builder may commit");
  assert.ok(agent(ralph, "builder").inputs?.includes("{{agent-file}}") && agent(ralph, "builder").inputs?.includes("{{plan-file}}"));
  assert.ok(ralph.loops[0]!.stops.some((s) => s.kind === "diminishing-returns"), "the same failure twice stops it");

  // patrol-pulse: no loop; a read-only investigator; a writer that owns only the ticket store; a gate before the end.
  const pulse = byId("patrol-pulse");
  assert.equal(creditUrls(pulse).length, 2, "the secondary write-up and Gas Town");
  assert.match(pulse.template!.credits![0]!.name, /secondary source/, "the write-up is named as a secondary source");
  assert.deepEqual(pulse.loops, [], "one pulse is one run");
  const investigator = agent(pulse, "investigator");
  assert.equal(investigator.role, "critic");
  assert.ok(investigator.deny?.includes("edit-files") && !investigator.allow?.includes("edit-files"), "the investigator never edits");
  assert.ok(investigator.allow?.includes("run-commands"), "but may run what it needs");
  assert.deepEqual(agent(pulse, "ticket-writer").owns, ["{{ticket-store}}"]);
  assert.ok(pulse.nodes.some((n) => n.kind === "human-gate" && n.id === "prioritise"));
  assert.equal(pulse.nodes.filter((n) => n.kind === "stop").length, 2, "a clean stop and a done stop");

  // gauntlet-decomposed: two loops, the inner nested in the outer, the outer bar on PIECES.md; a gate on the cut and one on the release.
  const gauntlet = byId("gauntlet-decomposed");
  assert.deepEqual(creditUrls(gauntlet), ["https://github.com/mshumer/Claude-of-Duty"]);
  const [polish, pieces] = gauntlet.loops.map((l) => l.id) as [string, string];
  assert.deepEqual([polish, pieces], ["polish", "pieces"]);
  const inner = gauntlet.loops[0]!;
  const outer = gauntlet.loops[1]!;
  assert.ok(inner.members.every((m) => outer.members.includes(m)) && inner.members.length < outer.members.length, "polish nests inside pieces");
  assert.ok(outer.bar?.inspects.some((e) => e.kind === "checklist" && e.ref === "PIECES.md"), "the outer bar is the piece checklist");
  assert.equal(outer.stops.find((s) => s.kind === "bar-passed")?.then, "integrator", "every piece done continues at the integrator");
  assert.ok(outer.stops.some((s) => s.kind === "human"), "the human checks in on the outer loop");
  assert.equal(gauntlet.nodes.filter((n) => n.kind === "human-gate").length, 2);
  assert.equal(gauntlet.nodes.filter((n) => n.kind === "agent" && n.role === "critic" && n.model?.tier === "frontier").length, 2, "a fresh frontier critic per piece and for the whole");
  for (const id of ["critic", "final-critic"]) assert.match(agent(gauntlet, id).brief, /labels stripped and in random order/, `${id} compares blind`);
  assert.doesNotMatch(JSON.stringify(gauntlet), /until it beats/i, "never 'until it beats the reference'");
  assert.equal(gauntlet.edges.find((e) => e.id === "e-next-piece-pass")?.to, "owner", "a remaining piece returns to the owner");
  assert.equal(gauntlet.edges.find((e) => e.id === "e-next-piece-fail")?.to, "integrator");

  // merge-queue: a fragment that inserts into a grind-loop host before its stop node, as human-gated-irreversible does.
  const queue = byId("merge-queue");
  assert.equal(creditUrls(queue).length, 2, "Gas Town's Refinery and Bors");
  assert.equal(queue.template!.kind, "fragment");
  assert.deepEqual(agent(queue, "bisect").owns, ["{{queue-file}}"]);
  assert.deepEqual(agent(queue, "land").irreversible, ["merge"]);
  assert.equal(loopMode(indexGraph(queue), queue.loops[0]!), "grind");
  const host = instantiate(byId("grind-loop"), { name: "Host", values: examples(byId("grind-loop")) });
  const inserted = insertFragment(host, queue, { values: examples(queue) });
  const wired = { ...inserted.doc, edges: inserted.doc.edges.map((e) => (e.id === "e-tests-pass" ? { ...e, to: inserted.ids["integrate"]! } : e)).filter((e) => e.to !== "done" || e.from !== "tests") };
  const hostDone = wired.nodes.find((n) => n.id === "done")!;
  const withoutHostStop = { ...wired, nodes: wired.nodes.filter((n) => n !== hostDone) };
  const issues = validate(withoutHostStop, { forExport: true });
  assert.deepEqual(issues.filter((i) => i.severity === "error"), [], "the host with the queue before its end validates for export");
  assert.ok(withoutHostStop.loops.some((l) => l.id === "grind") && withoutHostStop.loops.some((l) => l.id === inserted.ids["queue"]), "both loops survive the insert");
});

test("patterns/index.json rows are templateIndexEntry of each pattern, and the generated files are current", () => {
  const index = JSON.parse(read(join(patternsDir, "index.json"))) as { grooph: number; templates: unknown[] };
  assert.equal(index.grooph, 0);
  assert.deepEqual(index.templates, files.map((file) => templateIndexEntry(load(file), file)));

  const script = join(repoRoot, "scripts", "patterns-index.mjs");
  assert.ok(existsSync(script));
  const check = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
  assert.equal(check.status, 0, `${check.stderr}${check.stdout}`);
});
