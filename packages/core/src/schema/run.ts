/**
 * The run bundle schema (docs/runs.md §2), declared once like the graph and
 * proposal set schemas: runtime check, published JSON Schema, canonical key
 * order. Graphs and run notes are named by `$ref` to the graph schema.
 */

import type { RunBundle } from "../types.js";
import { arr, external, lit, num, obj, opt, str, toJsonSchema, type Sch, type TypeOf } from "./dsl.js";
import { SCHEMA_ID, graphSchema, runNoteSchema } from "./graph.js";

const graph = () => external(graphSchema, SCHEMA_ID);

export const runBundleSchema = obj(
  {
    groophRun: lit(0),
    run: str({ minLength: 1 }),
    progress: opt(str()),
    source: graph(),
    working: graph(),
    notes: arr(external(runNoteSchema, `${SCHEMA_ID}#/$defs/RunNote`)),
    issues: opt(arr(obj({ line: num({ integer: true, minimum: 1 }), message: str() }, { name: "RunNoteIssue" }))),
  },
  { describe: "run bundle" },
);

export const RUN_SCHEMA_ID = "https://grooph.dev/schema/grooph-run-0.schema.json";

/** The published JSON Schema for `*.grooph-run.json`, generated from the schema above. */
export function runJsonSchema(): string {
  return toJsonSchema(runBundleSchema as Sch<unknown>, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: RUN_SCHEMA_ID,
    title: "grooph run bundle v0",
    description:
      "One grooph run, self-contained: the source graph, the run's working copy, its run notes and its progress log. Normative source: docs/runs.md §2. Generated from packages/core/src/schema/run.ts; do not edit by hand.",
  });
}

/* Compile-time agreement with the normative types in ../types.ts. */

type Assert<T extends true> = T;
type Schemad = TypeOf<typeof runBundleSchema>;

export type _RunSchemaMatchesTypes = [Assert<Schemad extends RunBundle ? true : false>, Assert<RunBundle extends Schemad ? true : false>];
