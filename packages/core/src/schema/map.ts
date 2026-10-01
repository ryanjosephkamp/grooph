/**
 * The operation map schema (docs/operation-map.md §1), declared once like the
 * graph, proposal set and run bundle schemas: runtime check, published JSON
 * Schema, canonical key order.
 *
 * A handoff's `carrier`, and the field of each carrier that names it, are
 * optional here on purpose: a handoff that does not say what carries it is
 * `E_HANDOFF_NO_CARRIER`, a named rule, not a schema path.
 */

import type { CarrierKind, HarnessId, OperationMap, SessionLifetime } from "../types.js";
import { arr, enumOf, id, lit, num, obj, openEnum, opt, str, tagged, toJsonSchema, type Sch, type TypeOf } from "./dsl.js";

const lane = obj(
  {
    id: id(),
    name: str(),
    machine: str({ minLength: 1 }),
    place: opt(enumOf("local", "cloud")),
    account: str({ minLength: 1 }),
    description: opt(str()),
  },
  { name: "Lane" },
);

const person = obj(
  {
    id: id(),
    name: str(),
    role: opt(str()),
    description: opt(str()),
  },
  { name: "Person" },
);

const session = obj(
  {
    id: id(),
    name: str(),
    lane: id(),
    harness: openEnum<HarnessId>(["claude-code", "codex"], "harness id"),
    model: opt(str()),
    role: str({ minLength: 1 }),
    lifetime: opt(enumOf<SessionLifetime>("long-lived", "per-task", "scheduled")),
    count: opt(num({ integer: true, minimum: 1 })),
    graph: opt(str({ minLength: 1 })),
    repo: opt(str()),
    description: opt(str()),
  },
  { name: "Session" },
);

const carrierKind = <K extends CarrierKind>(kind: K) => lit(kind);

const carrier = tagged(
  "kind",
  {
    branch: obj({ kind: carrierKind("branch"), repo: opt(str()), ref: opt(str()) }),
    "pull-request": obj({ kind: carrierKind("pull-request"), repo: opt(str()) }),
    "session-message": obj({ kind: carrierKind("session-message") }),
    "scheduled-message": obj({ kind: carrierKind("scheduled-message"), schedule: opt(str()) }),
    "review-page": obj({ kind: carrierKind("review-page"), where: opt(str()) }),
    person: obj({ kind: carrierKind("person"), who: opt(str()) }),
    notification: obj({ kind: carrierKind("notification"), where: opt(str()) }),
    other: obj({ kind: carrierKind("other"), name: opt(str()) }),
  },
  { name: "Carrier", label: "carrier" },
);

const handoff = obj(
  {
    id: id(),
    from: id(),
    to: id(),
    carrier: opt(carrier),
    what: opt(str()),
    label: opt(str()),
  },
  { name: "Handoff" },
);

export const mapSchema = obj(
  {
    groophMap: lit(0),
    id: id(),
    name: str(),
    version: num({ integer: true, minimum: 0 }),
    asOf: opt(str({ pattern: /^\d{4}-\d{2}-\d{2}$/, patternName: "date as YYYY-MM-DD" })),
    description: opt(str()),
    lanes: arr(lane),
    people: opt(arr(person)),
    sessions: arr(session),
    handoffs: arr(handoff),
  },
  { describe: "operation map" },
);

export const MAP_SCHEMA_ID = "https://grooph.dev/schema/grooph-map-0.schema.json";

/** The published JSON Schema for `*.grooph-map.json`, generated from the schema above. */
export function mapJsonSchema(): string {
  return toJsonSchema(mapSchema as Sch<unknown>, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: MAP_SCHEMA_ID,
    title: "grooph operation map v0",
    description:
      "A grooph operation map: harness sessions, the people they work with, the handoffs between them and the lanes they run in. Drawn and validated, never compiled. Normative source: docs/operation-map.md §1. Generated from packages/core/src/schema/map.ts; do not edit by hand.",
  });
}

/* Compile-time agreement with the normative types in ../types.ts. */

type Assert<T extends true> = T;
type Schemad = TypeOf<typeof mapSchema>;

export type _MapSchemaMatchesTypes = [Assert<Schemad extends OperationMap ? true : false>, Assert<OperationMap extends Schemad ? true : false>];
