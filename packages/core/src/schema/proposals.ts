/**
 * The proposal set schema (docs/executive.md §1), declared once, like the graph
 * schema: runtime check, published JSON Schema, canonical key order.
 *
 * A candidate's graph is either a whole graph document, checked by the graph
 * schema and published as a `$ref` to it, or `{ file }`. Which one a value is
 * meant to be is read from its keys, so a broken inline graph is reported at
 * its own path (`/candidates/0/graph/nodes/2/brief`) rather than as "not a
 * graph or a file".
 */

import type { Candidate, ProposalSet, Shape } from "../types.js";
import { arr, either, external, id, lit, nul, num, obj, opt, str, anyOf, toJsonSchema, type Sch, type TypeOf } from "./dsl.js";
import { SCHEMA_ID, graphSchema, profileSchema } from "./graph.js";

const count = () => num({ integer: true, minimum: 0 });

const shapeSchema = obj(
  {
    agents: count(),
    checks: count(),
    gates: count(),
    loops: count(),
    tiers: obj({ frontier: count(), strong: count(), fast: count(), unset: count() }),
    worstCaseRounds: anyOf([count(), nul()], { describe: "integer or null" }),
    budgets: arr(str()),
  },
  { name: "Shape" },
);

const candidateFile = obj({ file: str({ minLength: 1 }) }, { name: "CandidateFile" });

/** An object with `file` and no `grooph` key is a file reference; anything else is checked as a graph. */
const isFileRef = (value: unknown): boolean =>
  typeof value === "object" && value !== null && !Array.isArray(value) && "file" in value && !("grooph" in value);

const candidateGraph = either(isFileRef, candidateFile, external(graphSchema, SCHEMA_ID), {
  describe: "graph document or { file }",
});

const candidate = obj(
  {
    id: id(),
    label: str({ minLength: 1 }),
    graph: candidateGraph,
    basedOn: opt(str()),
    rationale: str(),
    pros: arr(str()),
    cons: arr(str()),
    profile: profileSchema,
    shape: opt(shapeSchema),
  },
  { name: "Candidate" },
);

export const proposalSetSchema = obj(
  {
    groophProposals: lit(0),
    id: id(),
    title: str(),
    brief: str(),
    candidates: arr(candidate, { minItems: 1, maxItems: 4 }),
    recommendation: opt(obj({ candidate: id(), why: str() })),
  },
  { describe: "proposal set" },
);

export const PROPOSALS_SCHEMA_ID = "https://grooph.dev/schema/grooph-proposals-0.schema.json";

/** The published JSON Schema for `*.grooph-proposals.json`, generated from the schema above. */
export function proposalsJsonSchema(): string {
  return toJsonSchema(proposalSetSchema as Sch<unknown>, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: PROPOSALS_SCHEMA_ID,
    title: "grooph proposal set v0",
    description:
      "A grooph proposal set: one to four candidate graphs for one project, with the reasoning. Normative source: docs/executive.md §1. A candidate's `graph` is a graph document or `{ file }`, a path relative to the proposal set's folder. Generated from packages/core/src/schema/proposals.ts; do not edit by hand.",
  });
}

/* Compile-time agreement with the normative types in ../types.ts. */

type Assert<T extends true> = T;
type Schemad = TypeOf<typeof proposalSetSchema>;
type SchemadCandidate = TypeOf<typeof candidate>;
type SchemadShape = TypeOf<typeof shapeSchema>;

export type _ProposalSchemaMatchesTypes = [
  Assert<Schemad extends ProposalSet ? true : false>,
  Assert<ProposalSet extends Schemad ? true : false>,
  Assert<SchemadCandidate extends Candidate ? true : false>,
  Assert<Candidate extends SchemadCandidate ? true : false>,
  Assert<SchemadShape extends Shape ? true : false>,
  Assert<Shape extends SchemadShape ? true : false>,
];
