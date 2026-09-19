/**
 * Proposal sets (docs/executive.md §1): the schema and its published JSON
 * Schema, the set rules with one fixture per code, and `estimateShape`.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

import { parseGraphText } from "../src/parse.js";
import {
  canonicalizeProposals,
  estimateShape,
  findCandidates,
  isCandidateFile,
  parseProposalSetText,
  shapeLine,
  tierLine,
  validateProposalSet,
  type ProposalIssueCode,
} from "../src/proposals.js";
import { graphJsonSchema } from "../src/schema/graph.js";
import { PROPOSALS_SCHEMA_PATH } from "../src/schema/path.js";
import { PROPOSALS_SCHEMA_ID, proposalsJsonSchema } from "../src/schema/proposals.js";
import type { Graph, Loop, Node, ProposalSet } from "../src/types.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const root = join(fixturesDir, "proposals");
const SET = /\.grooph-proposals\.json$/;

const setsIn = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? setsIn(join(dir, entry.name)) : SET.test(entry.name) ? [join(dir, entry.name)] : [],
      )
    : [];

const validSets = setsIn(join(root, "valid"));
const invalidSets = readdirSync(join(root, "invalid")).flatMap((code) => setsIn(join(root, "invalid", code)).map((path) => ({ code, path })));

const load = (path: string): ProposalSet => {
  const parsed = parseProposalSetText(read(path));
  assert.deepEqual(parsed.issues, [], `${path} matches the schema`);
  return parsed.set!;
};

/** What `grooph share` does before validating: `{ file }` candidates read from beside the set. */
const inlined = (path: string): ProposalSet => {
  const set = load(path);
  return {
    ...set,
    candidates: set.candidates.map((c) => {
      if (!isCandidateFile(c.graph)) return c;
      const graph = parseGraphText(read(join(dirname(path), c.graph.file)));
      assert.deepEqual(graph.issues, [], `${c.graph.file} is a graph document`);
      return { ...c, graph: graph.doc! };
    }),
  };
};

const PROPOSAL_CODES: ProposalIssueCode[] = ["E_SCHEMA", "E_DUPLICATE_ID", "E_DUPLICATE_LABEL", "E_DANGLING_REF", "E_CANDIDATE_INVALID", "W_UNKNOWN_KEY"];

// ─── schema ───────────────────────────────────────────────────────────────

test("the committed proposal set schema is what the types generate", () => {
  assert.equal(read(PROPOSALS_SCHEMA_PATH), proposalsJsonSchema(), "run `pnpm --filter @grooph/core run schema:write`");
  assert.equal(JSON.parse(proposalsJsonSchema()).$id, PROPOSALS_SCHEMA_ID);
});

test("the JSON Schema and parseProposalSet agree on every proposal fixture, with graphs by $ref", () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  ajv.addSchema(JSON.parse(graphJsonSchema()));
  const validateJson = ajv.compile(JSON.parse(proposalsJsonSchema()));
  for (const path of [...validSets, ...invalidSets.map((f) => f.path)]) {
    const bySchema = validateJson(JSON.parse(read(path))) === true;
    const byParse = parseProposalSetText(read(path)).issues.length === 0;
    assert.equal(bySchema, byParse, `${path}: schema ${bySchema} vs parse ${byParse} ${bySchema ? "" : ajv.errorsText(validateJson.errors)}`);
  }
  // A broken inline graph fails both, and parse names the path inside it.
  const set = inlined(validSets.find((p) => p.includes("csv-export"))!);
  delete (set.candidates[1]!.graph as { nodes?: unknown }).nodes;
  assert.equal(validateJson(set), false);
  const parsed = parseProposalSetText(JSON.stringify(set));
  assert.match(parsed.issues[0]!.message, /^\/candidates\/1\/graph\/nodes: missing required property "nodes"/);
});

test("proposal fixtures are stored in canonical form", () => {
  for (const path of [...validSets, ...invalidSets.map((f) => f.path)]) {
    const parsed = parseProposalSetText(read(path));
    if (parsed.set) assert.equal(canonicalizeProposals(parsed.set), read(path), path);
  }
});

// ─── rules ────────────────────────────────────────────────────────────────

test("every proposal set rule has a failing fixture, and every fixture folder is a rule", () => {
  const folders = new Set(invalidSets.map((f) => f.code));
  assert.deepEqual([...folders].sort(), [...PROPOSAL_CODES].sort());
});

for (const path of validSets) {
  test(`${path.slice(repoRoot.length + 1)} validates clean once its files are inlined`, () => {
    assert.deepEqual(validateProposalSet(load(path)), [], "as written, with { file } candidates");
    assert.deepEqual(validateProposalSet(inlined(path), { requireInline: true }), [], "inlined, as a link carries it");
  });
}

for (const { code, path } of invalidSets) {
  test(`${path.slice(repoRoot.length + 1)} reports exactly ${code}`, () => {
    const parsed = parseProposalSetText(read(path));
    const issues = parsed.set ? validateProposalSet(parsed.set) : parsed.issues;
    assert.deepEqual([...new Set(issues.map((i) => i.code))], [code]);
    assert.ok(issues.every((i) => i.severity === (code.startsWith("E_") ? "error" : "warning")));
  });
}

test("E_CANDIDATE_INVALID names the candidate and the underlying codes; a { file } candidate needs inlining only when asked", () => {
  const broken = invalidSets.find((f) => f.code === "E_CANDIDATE_INVALID")!;
  const [only] = validateProposalSet(load(broken.path));
  assert.deepEqual(only!.at, ["lean"]);
  assert.match(only!.message, /candidate "lean" \(Lean\) has errors that block export: E_NO_GOAL/);

  const withFiles = load(validSets.find((p) => p.includes("csv-export"))!);
  const required = validateProposalSet(withFiles, { requireInline: true });
  assert.deepEqual(required.map((i) => [i.code, i.at]), [
    ["E_CANDIDATE_INVALID", ["lean"]],
    ["E_CANDIDATE_INVALID", ["reviewed"]],
    ["E_CANDIDATE_INVALID", ["rigorous"]],
  ]);
  assert.match(required[0]!.message, /points at lean\.grooph\.json instead of carrying its graph; grooph share inlines it/);
});

test("one to four candidates, and the schema says so at /candidates", () => {
  const set = inlined(validSets.find((p) => p.includes("csv-export"))!);
  const none = validateProposalSet({ ...set, candidates: [] });
  assert.deepEqual(none.map((i) => i.message), ["/candidates: expected at least 1 item(s), got 0"]);
  const four = { ...set, candidates: [...set.candidates, { ...set.candidates[0]!, id: "fourth", label: "Fourth" }] };
  assert.deepEqual(validateProposalSet(four), []);
});

test("findCandidates matches ids and labels without case, and reports both kinds of hit", () => {
  const set = load(validSets.find((p) => p.includes("csv-export"))!);
  assert.deepEqual(findCandidates(set, "LEAN").byId.map((c) => c.id), ["lean"]);
  assert.deepEqual(findCandidates(set, " reviewed ").byLabel.map((c) => c.id), ["reviewed"]);
  assert.deepEqual(findCandidates(set, "nothing"), { byId: [], byLabel: [] });
});

// ─── shape ────────────────────────────────────────────────────────────────

const agent = (id: string, tier?: "frontier" | "strong" | "fast"): Node =>
  ({ id, kind: "agent", name: id, role: "builder", ...(tier ? { model: { tier } } : {}), brief: "b", outputs: ["o"] }) as Node;

const graph = (nodes: Node[], loops: Loop[], extra: Partial<Graph> = {}): Graph => ({
  grooph: 0,
  id: "g",
  name: "G",
  version: 1,
  nodes,
  edges: [],
  loops,
  ...extra,
});

const loop = (id: string, members: string[], stops: Loop["stops"], name = id): Loop => ({ id, name, members, back: [], stops });

test("estimateShape on a flat loop: counts, tiers, rounds and the budget", () => {
  const lean = parseGraphText(read(join(root, "valid", "csv-export", "lean.grooph.json"))).doc!;
  const shape = estimateShape(lean);
  assert.deepEqual(shape, {
    agents: 1,
    checks: 1,
    gates: 0,
    loops: 1,
    tiers: { frontier: 0, strong: 0, fast: 1, unset: 0 },
    worstCaseRounds: 5,
    budgets: ["30 minutes"],
  });
  assert.equal(shapeLine(shape), "1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes");
  assert.equal(tierLine(shape), "1 fast");

  const reviewed = estimateShape(parseGraphText(read(join(root, "valid", "csv-export", "reviewed.grooph.json"))).doc!);
  assert.equal(shapeLine(reviewed), "2 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns");
});

test("estimateShape multiplies nested loops: the inner loop restarts on every outer round", () => {
  const nodes = [agent("a", "fast"), agent("b", "strong"), agent("c")];
  const nested = graph(nodes, [
    loop("outer", ["a", "b", "c"], [{ kind: "max-iterations", n: 3 }, { kind: "budget", measure: "minutes", limit: 90 }], "Outer"),
    loop("inner", ["a", "b"], [{ kind: "max-iterations", n: 5 }, { kind: "max-iterations", n: 4 }, { kind: "budget", measure: "usd", limit: 5 }], "Inner"),
    loop("innermost", ["a"], [{ kind: "max-iterations", n: 2 }], "Innermost"),
  ]);
  const shape = estimateShape(nested);
  // outer 3 + inner 3×4 + innermost 3×4×2; the smaller of inner's two caps counts.
  assert.equal(shape.worstCaseRounds, 3 + 12 + 24);
  assert.deepEqual(shape.budgets, ["Outer: 90 minutes", "Inner: $5"], "each loop's budget, named once more than one loop has one");
  assert.deepEqual(shape.tiers, { frontier: 0, strong: 1, fast: 1, unset: 1 });
  assert.equal(tierLine(shape), "1 strong · 1 fast · 1 session default");

  // Loops side by side, or over the same members, add.
  const siblings = graph(nodes, [loop("x", ["a"], [{ kind: "max-iterations", n: 2 }]), loop("y", ["b"], [{ kind: "max-iterations", n: 3 }]), loop("z", ["b"], [{ kind: "max-iterations", n: 1 }])]);
  assert.equal(estimateShape(siblings).worstCaseRounds, 6);
});

test("estimateShape: a loop with no max-iterations makes the worst case unknown, not zero", () => {
  const open = graph([agent("a")], [loop("l", ["a"], [{ kind: "budget", measure: "turns", limit: 20 }])]);
  const shape = estimateShape(open);
  assert.equal(shape.worstCaseRounds, null);
  assert.equal(shapeLine(shape), "1 agent · 1 loop · no round cap · 20 turns");
  assert.equal(shapeLine(estimateShape(graph([agent("a")], []))), "1 agent · no loop");
});

test("estimateShape counts approval edges as gates", () => {
  const doc = graph([agent("a"), agent("b")], [], {
    nodes: [agent("a"), agent("b"), { id: "g1", kind: "human-gate", name: "G", prompt: "ok?" }],
    edges: [{ id: "e", from: "a", to: "b", approval: true }],
  });
  assert.equal(estimateShape(doc).gates, 2);
});
