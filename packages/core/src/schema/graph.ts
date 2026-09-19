/**
 * The graph document schema, declared once.
 *
 * Field order in every `obj` below is the order `docs/graph-ir.md` §1 lists the
 * fields, which makes it the canonical key order (§7) as well. On every node
 * `kind` comes second, right after `id`, then the rest of `NodeBase`, then the
 * variant's own fields (§7). Stops lead with `kind`, as the union reads.
 *
 * The assertions at the bottom fail the build if this schema and the normative
 * types in `../types.ts` ever describe different shapes.
 */

import type {
  Adaptation,
  Capability,
  Effort,
  Graph,
  HarnessId,
  PolicyScope,
  Role,
  RunNoteAt,
  TemplateKind,
  Tier,
} from "../types.js";
import {
  ID_PATTERN,
  anyOf,
  any,
  arr,
  bool,
  enumOf,
  id,
  lit,
  num,
  obj,
  openEnum,
  opt,
  rec,
  str,
  tagged,
  toJsonSchema,
  type Sch,
  type TypeOf,
} from "./dsl.js";

const typedStr = <T extends string>(pattern: RegExp, patternName: string): Sch<T> =>
  str({ pattern, patternName }) as unknown as Sch<T>;

const idRef = () => id();

const harness = openEnum<HarnessId>(["claude-code", "codex"], "harness id");
const capability = openEnum<Capability>(
  ["read-files", "edit-files", "write-outputs", "run-commands", "run-tests", "web", "spawn-agents"],
  "capability",
);
const tier = enumOf<Tier>("frontier", "strong", "fast");
const effort = enumOf<Effort>("low", "medium", "high", "max");
const role = enumOf<Role>(
  "lead",
  "planner",
  "builder",
  "critic",
  "tester",
  "researcher",
  "red-team",
  "judge",
  "synthesizer",
);

/** graph-ir §7: `id`, then `kind`, then the rest of `NodeBase`, then the variant's fields. */
const nodeHead = <K extends string>(kind: K) =>
  ({
    id: id(),
    kind: lit(kind),
    name: str(),
    description: opt(str()),
    coupled: opt(bool()),
  }) as const;

const agentNode = obj(
  {
    ...nodeHead("agent"),
    role: anyOf([role, obj({ custom: str() })], { describe: "role name or { custom }" }),
    model: opt(obj({ tier, pin: opt(rec(str(), { keyName: "harness id" })) })),
    effort: opt(effort),
    brief: str(),
    inputs: opt(arr(str())),
    outputs: arr(str(), { minItems: 1 }),
    allow: opt(arr(capability)),
    deny: opt(arr(capability)),
    owns: opt(arr(str())),
    irreversible: opt(arr(str())),
  },
  { name: "AgentNode" },
);

const humanGateNode = obj(
  { ...nodeHead("human-gate"), prompt: str(), options: opt(arr(str())) },
  { name: "HumanGateNode" },
);

const checkNode = obj(
  {
    ...nodeHead("check"),
    check: obj({
      kind: enumOf("command", "tests", "diff", "metric", "evidence"),
      run: opt(str()),
      pass: str(),
      threshold: opt(num()),
    }),
  },
  { name: "CheckNode" },
);

const mergeNode = obj(
  { ...nodeHead("merge"), merges: arr(str()), strategy: opt(str()) },
  { name: "MergeNode" },
);

const stopNode = obj(
  { ...nodeHead("stop"), outcome: opt(enumOf("success", "halt")) },
  { name: "StopNode" },
);

const node = tagged(
  "kind",
  {
    agent: agentNode,
    "human-gate": humanGateNode,
    check: checkNode,
    merge: mergeNode,
    stop: stopNode,
  },
  { name: "Node", label: "node" },
);

const edge = obj(
  {
    id: id(),
    from: idRef(),
    to: idRef(),
    when: opt(
      anyOf([enumOf("always", "pass", "fail"), obj({ verdict: str() })], {
        describe: "always | pass | fail | { verdict }",
      }),
    ),
    isolation: opt(enumOf("fresh", "shared")),
    concurrency: opt(obj({ max: num({ integer: true, minimum: 1 }) })),
    retry: opt(obj({ max: num({ integer: true, minimum: 0 }) })),
    evidence: opt(arr(str())),
    approval: opt(bool()),
    label: opt(str()),
  },
  { name: "Edge" },
);

const evidence = obj(
  {
    kind: enumOf("file", "url", "metric", "checklist", "answer-key", "artifact"),
    ref: str(),
    note: opt(str()),
  },
  { name: "Evidence" },
);

const bar = obj(
  {
    name: str(),
    inspects: arr(evidence),
    acceptance: str(),
    aspiration: opt(str()),
    answerKeyFrom: opt(idRef()),
  },
  { name: "Bar" },
);

const budgetMeasure = enumOf("usd", "minutes", "turns", "tokens");

const stop = tagged(
  "kind",
  {
    human: obj({ kind: lit("human"), every: opt(num({ integer: true, minimum: 1 })), then: opt(idRef()) }),
    budget: obj({ kind: lit("budget"), measure: budgetMeasure, limit: num({ minimum: 0 }), then: opt(idRef()) }),
    "bar-passed": obj({ kind: lit("bar-passed"), then: opt(idRef()) }),
    "diminishing-returns": obj({
      kind: lit("diminishing-returns"),
      rounds: num({ integer: true, minimum: 1 }),
      metric: opt(str()),
      threshold: opt(num()),
      then: opt(idRef()),
    }),
    "evidence-invalid": obj({
      kind: lit("evidence-invalid"),
      rounds: num({ integer: true, minimum: 1 }),
      then: opt(idRef()),
    }),
    "max-iterations": obj({
      kind: lit("max-iterations"),
      n: num({ integer: true, minimum: 1 }),
      then: opt(idRef()),
    }),
  },
  { name: "Stop", label: "stop" },
);

const loop = obj(
  {
    id: id(),
    name: str(),
    members: arr(idRef()),
    back: arr(idRef()),
    mode: opt(enumOf("grind", "judgment")),
    bar: opt(bar),
    stops: arr(stop),
  },
  { name: "Loop" },
);

const policy = obj(
  {
    id: id(),
    kind: anyOf(
      [
        enumOf(
          "critic-isolation",
          "no-self-grading",
          "owner-per-artifact",
          "concurrency-cap",
          "no-live-graph-rewrite",
          "evidence-required",
        ),
        obj({ custom: str() }),
      ],
      { describe: "policy kind or { custom }" },
    ),
    scope: typedStr<PolicyScope>(
      /^(graph|loop:[a-z][a-z0-9-]*|node:[a-z][a-z0-9-]*|edge:[a-z][a-z0-9-]*)$/,
      "scope (graph | loop:<id> | node:<id> | edge:<id>)",
    ),
    params: opt(rec(anyOf([str(), num(), bool()], { describe: "string | number | boolean" }))),
  },
  { name: "Policy" },
);

const group = obj(
  { id: id(), name: str(), members: arr(idRef()), coupled: opt(bool()) },
  { name: "Group" },
);

/** docs/templates.md §1; proposal candidates carry one too (docs/executive.md §1). */
export const profileSchema = obj(
  {
    cost: enumOf("low", "medium", "high"),
    speed: enumOf("fast", "medium", "slow"),
    rigor: enumOf("light", "standard", "high"),
  },
  { name: "Profile" },
);

/** docs/templates.md §1. */
const template = obj(
  {
    kind: enumOf<TemplateKind>("graph", "fragment"),
    title: str(),
    summary: str(),
    whenToUse: str(),
    notFor: opt(str()),
    profile: profileSchema,
    slots: opt(arr(obj({ key: str(), ask: str(), example: str() }, { name: "TemplateSlot" }))),
    tags: opt(arr(str())),
    demo: opt(str()),
  },
  { name: "Template" },
);

/** graph-ir §6. Exported for run notes read line by line (docs/runs.md §2) and for the run bundle schema. */
export const runNoteSchema = obj(
  {
    id: id(),
    run: str(),
    at: typedStr<RunNoteAt>(
      /^(graph|node:[a-z][a-z0-9-]*|edge:[a-z][a-z0-9-]*|loop:[a-z][a-z0-9-]*)$/,
      "run-note location (graph | node:<id> | edge:<id> | loop:<id>)",
    ),
    started: opt(str()),
    ended: opt(str()),
    outcome: opt(openEnum<"pass" | "fail" | "halt" | "invalid-evidence" | (string & {})>(
      ["pass", "fail", "halt", "invalid-evidence"],
      "outcome",
    )),
    verdict: opt(str()),
    round: opt(num({ integer: true, minimum: 0 })),
    evidence: opt(arr(str())),
    cost: opt(obj({ measure: budgetMeasure, amount: num() })),
    gaps: opt(arr(str())),
    proposal: opt(obj({ summary: str(), patch: opt(any()) })),
    amendment: opt(obj({ summary: str(), reason: str(), patch: opt(any()) })),
    text: opt(str()),
  },
  { name: "RunNote" },
);

export const graphSchema = obj(
  {
    grooph: lit(0),
    id: id(),
    name: str(),
    version: num({ integer: true, minimum: 0 }),
    goal: opt(str()),
    target: opt(obj({ harness })),
    constraints: opt(obj({ budget: opt(str()), time: opt(str()), other: opt(str()) })),
    adaptation: opt(enumOf<Adaptation>("adaptive", "propose", "fixed")),
    lineage: opt(obj({ pattern: opt(str()), from: opt(str()) })),
    template: opt(template),
    description: opt(str()),

    nodes: arr(node),
    edges: arr(edge),
    loops: arr(loop),
    policies: opt(arr(policy)),
    groups: opt(arr(group)),
    notes: opt(arr(runNoteSchema)),
    layout: opt(
      rec(
        obj({ x: num(), y: num(), w: opt(num()), h: opt(num()) }),
        { keyPattern: ID_PATTERN, keyName: "node id" },
      ),
    ),
  },
  { describe: "graph document" },
);

export const SCHEMA_ID = "https://grooph.dev/schema/grooph-0.schema.json";

/** The published JSON Schema, generated from the schema above. */
export function graphJsonSchema(): string {
  return toJsonSchema(graphSchema as Sch<unknown>, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: SCHEMA_ID,
    title: "grooph graph document v0",
    description:
      "A grooph graph document. Normative source: docs/graph-ir.md §1. Generated from packages/core/src/schema/graph.ts; do not edit by hand.",
  });
}

/* ------------------------------------------------------------------ *
 * Compile-time agreement between this schema and the normative types.
 * ------------------------------------------------------------------ */

type Assert<T extends true> = T;
type Schemad = TypeOf<typeof graphSchema>;

export type _SchemaMatchesTypes = [
  Assert<Schemad extends Graph ? true : false>,
  Assert<Graph extends Schemad ? true : false>,
];
