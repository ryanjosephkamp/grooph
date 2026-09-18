/**
 * `applyOps(doc, ops)` — the operations of `./edit.ts` sent as data.
 *
 * An op is a JSON object `{ "op": "<name>", ...args }`; a list of them is what
 * `grooph apply` reads today and what the MCP server will accept later, so both
 * shells share one format. `packages/core/README.md` documents every op.
 *
 * All or nothing: the ops run in order against the evolving document, and the
 * first one that cannot apply stops the list with an error naming it (its
 * index, its name, and why). Applying never validates the result — a document
 * may be mid-construction — so callers run `validate` afterwards.
 */

import { ID_PATTERN } from "../schema/dsl.js";
import { didYouMean } from "../suggest.js";
import type { Adaptation, Bar, Graph, Id, Policy, PolicyKind, PolicyScope, Stop, StopKind } from "../types.js";
import {
  KIND_LABEL,
  addLoop,
  addNode,
  addPolicy,
  addStop,
  connect,
  moveStop,
  removeEdge,
  removeLoop,
  removeNode,
  removePolicy,
  removeStop,
  renameId,
  setBar,
  setConstraint,
  setGraphField,
  setGraphName,
  setLoopName,
  setNodeName,
  setPositions,
  setStop,
  setTarget,
  toggleLoopBack,
  toggleLoopMember,
  updateEdge,
  updateLoop,
  updateNode,
  type NodeKind,
  type Position,
} from "./edit.js";
import { allIds } from "./ids.js";

/** An operation as data. `op` names it; the other keys are its arguments. */
export type Op = { op: string } & Record<string, unknown>;

export type OpError = {
  /** position of the failing op in the list, from 0 */
  index: number;
  /** its `op` name, as sent */
  op: string;
  message: string;
};

export type ApplyResult =
  | {
      ok: true;
      doc: Graph;
      /** per op: the id it created or renamed to, when it has one; otherwise null */
      ids: (Id | null)[];
    }
  | { ok: false; error: OpError };

/** Argument names per op. Anything else in an op is refused, so a typo cannot pass silently. */
export const OP_ARGS = {
  setGraphName: ["name"],
  setGraphField: ["key", "value"],
  setTarget: ["harness"],
  setConstraint: ["key", "value"],
  addNode: ["kind", "name", "id", "at", "set"],
  setNodeName: ["id", "name"],
  updateNode: ["id", "set"],
  removeNode: ["id"],
  connect: ["from", "to", "id", "set"],
  updateEdge: ["id", "set"],
  removeEdge: ["id"],
  addLoop: ["members", "name", "id", "set"],
  setLoopName: ["id", "name"],
  updateLoop: ["id", "set"],
  removeLoop: ["id"],
  toggleLoopMember: ["loop", "node", "on"],
  toggleLoopBack: ["loop", "edge", "on"],
  setBar: ["loop", "bar"],
  addStop: ["loop", "kind", "set"],
  setStop: ["loop", "index", "stop"],
  removeStop: ["loop", "index"],
  moveStop: ["loop", "index", "delta"],
  addPolicy: ["kind", "scope", "params", "id"],
  removePolicy: ["id"],
  setPositions: ["positions"],
  renameId: ["from", "to"],
} as const satisfies Record<string, readonly string[]>;

export type OpName = keyof typeof OP_ARGS;

export const OP_NAMES = Object.keys(OP_ARGS) as OpName[];

const GRAPH_FIELDS = ["name", "goal", "description", "adaptation", "lineage"] as const;
const CONSTRAINT_KEYS = ["budget", "time", "other"] as const;
const ADAPTATIONS: readonly Adaptation[] = ["adaptive", "propose", "fixed"];
const STOP_KINDS: readonly StopKind[] = [
  "human",
  "budget",
  "bar-passed",
  "diminishing-returns",
  "evidence-invalid",
  "max-iterations",
];
const NODE_KINDS = Object.keys(KIND_LABEL) as NodeKind[];
const SCOPE_PATTERN = /^(graph|loop:[a-z][a-z0-9-]*|node:[a-z][a-z0-9-]*|edge:[a-z][a-z0-9-]*)$/;

/** Apply `ops` to `doc` in order. Never mutates `doc`. */
export function applyOps(doc: Graph, ops: readonly unknown[]): ApplyResult {
  let current = doc;
  const ids: (Id | null)[] = [];
  for (const [index, raw] of ops.entries()) {
    const name = isObject(raw) && typeof raw["op"] === "string" ? raw["op"] : "?";
    try {
      const step = applyOne(current, raw);
      current = step.doc;
      ids.push(step.id ?? null);
    } catch (err) {
      if (err instanceof OpFailure) return { ok: false, error: { index, op: name, message: err.message } };
      throw err;
    }
  }
  return { ok: true, doc: current, ids };
}

/** `ops[3] updateNode: no node "critc"; did you mean "critic"?` */
export const formatOpError = (error: OpError): string => `ops[${error.index}] ${error.op}: ${error.message}`;

class OpFailure extends Error {}

const fail = (message: string): never => {
  throw new OpFailure(message);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function applyOne(doc: Graph, raw: unknown): { doc: Graph; id?: Id } {
  if (!isObject(raw)) return fail(`an op must be an object like {"op": "addNode", ...}, got ${JSON.stringify(raw)}`);
  const name = raw["op"];
  if (typeof name !== "string") return fail(`missing "op": the op's name, one of ${OP_NAMES.join(", ")}`);
  if (!(name in OP_ARGS)) return fail(`unknown op "${name}"${didYouMean(name, OP_NAMES)}`);
  const a = new Args(doc, raw, OP_ARGS[name as OpName]);

  switch (name as OpName) {
    case "setGraphName": {
      const next = setGraphName(doc, a.str("name"));
      return { doc: next, id: next.id };
    }
    case "setGraphField": {
      const key = a.oneOf("key", GRAPH_FIELDS);
      const value = a.raw("value");
      if (value === undefined || value === null) return { doc: setGraphField(doc, key, undefined) };
      if (key === "adaptation") return { doc: setGraphField(doc, key, a.oneOf("value", ADAPTATIONS)) };
      if (key === "lineage") return { doc: setGraphField(doc, key, a.obj("value") as Graph["lineage"]) };
      return { doc: setGraphField(doc, key, a.str("value")) };
    }
    case "setTarget":
      return { doc: setTarget(doc, a.nullableStr("harness")) };
    case "setConstraint":
      return { doc: setConstraint(doc, a.oneOf("key", CONSTRAINT_KEYS), a.nullableStr("value")) };

    case "addNode": {
      const kind = a.oneOf("kind", NODE_KINDS);
      const added = addNode(doc, kind, { at: a.optPosition("at"), name: a.optStr("name"), id: a.optNewId("id") });
      const set = a.optPatch("set", ["id", "kind"]);
      return { doc: set ? updateNode(added.doc, added.id, (n) => patch(n, set)) : added.doc, id: added.id };
    }
    case "setNodeName":
      return setNodeName(doc, a.node("id"), a.str("name"));
    case "updateNode": {
      const id = a.node("id");
      const set = a.patch("set", ["id", "kind"]);
      return { doc: updateNode(doc, id, (n) => patch(n, set)) };
    }
    case "removeNode":
      return { doc: removeNode(doc, a.node("id")) };

    case "connect": {
      const added = connect(doc, a.node("from"), a.node("to"), { id: a.optNewId("id") });
      const set = a.optPatch("set", ["id"]);
      return { doc: set ? updateEdge(added.doc, added.id, (e) => patch(e, set)) : added.doc, id: added.id };
    }
    case "updateEdge": {
      const id = a.edge("id");
      const set = a.patch("set", ["id"]);
      return { doc: updateEdge(doc, id, (e) => patch(e, set)) };
    }
    case "removeEdge":
      return { doc: removeEdge(doc, a.edge("id")) };

    case "addLoop": {
      const members = a.optList("members", (value, where) => a.existingNode(value, where)) ?? [];
      const added = addLoop(doc, members, { name: a.optStr("name"), id: a.optNewId("id") });
      const set = a.optPatch("set", ["id"]);
      return { doc: set ? updateLoop(added.doc, added.id, (l) => patch(l, set)) : added.doc, id: added.id };
    }
    case "setLoopName":
      return setLoopName(doc, a.loop("id"), a.str("name"));
    case "updateLoop": {
      const id = a.loop("id");
      const set = a.patch("set", ["id"]);
      return { doc: updateLoop(doc, id, (l) => patch(l, set)) };
    }
    case "removeLoop":
      return { doc: removeLoop(doc, a.loop("id")) };
    case "toggleLoopMember":
      return { doc: toggleLoopMember(doc, a.loop("loop"), a.node("node"), a.optBool("on")) };
    case "toggleLoopBack":
      return { doc: toggleLoopBack(doc, a.loop("loop"), a.edge("edge"), a.optBool("on")) };
    case "setBar": {
      const loop = a.loop("loop");
      const bar = a.raw("bar");
      return { doc: setBar(doc, loop, bar === undefined || bar === null ? undefined : (a.obj("bar") as Bar)) };
    }
    case "addStop": {
      const loop = a.loop("loop");
      const kind = a.oneOf("kind", STOP_KINDS);
      const set = a.optPatch("set", ["kind"]) ?? {};
      return { doc: addStop(doc, loop, kind, dropNulls(set) as Partial<Stop>) };
    }
    case "setStop": {
      const loop = a.loop("loop");
      const index = a.stopIndex(loop, "index");
      const stop = a.obj("stop");
      if (!STOP_KINDS.includes(stop["kind"] as StopKind)) {
        fail(`"stop.kind" must be one of ${STOP_KINDS.join(" | ")}, got ${JSON.stringify(stop["kind"])}`);
      }
      return { doc: setStop(doc, loop, index, stop as Stop) };
    }
    case "removeStop": {
      const loop = a.loop("loop");
      return { doc: removeStop(doc, loop, a.stopIndex(loop, "index")) };
    }
    case "moveStop": {
      const loop = a.loop("loop");
      const index = a.stopIndex(loop, "index");
      const delta = a.raw("delta");
      if (delta !== -1 && delta !== 1) fail(`"delta" must be -1 (earlier) or 1 (later), got ${JSON.stringify(delta)}`);
      return { doc: moveStop(doc, loop, index, delta as -1 | 1) };
    }

    case "addPolicy": {
      const kindRaw = a.raw("kind");
      const kind: PolicyKind =
        typeof kindRaw === "string" && kindRaw !== ""
          ? (kindRaw as PolicyKind)
          : isObject(kindRaw) && typeof kindRaw["custom"] === "string"
            ? { custom: kindRaw["custom"] }
            : fail(`"kind" must be a policy kind (for example "critic-isolation") or {"custom": "..."}, got ${JSON.stringify(kindRaw)}`);
      const scope = a.str("scope");
      if (!SCOPE_PATTERN.test(scope)) fail(`"scope" must be graph, loop:<id>, node:<id> or edge:<id>, got ${JSON.stringify(scope)}`);
      const params = a.raw("params") === undefined ? undefined : (a.obj("params") as Policy["params"]);
      return addPolicy(doc, { kind, scope: scope as PolicyScope, id: a.optNewId("id"), ...(params ? { params } : {}) });
    }
    case "removePolicy":
      return { doc: removePolicy(doc, a.policy("id")) };

    case "setPositions": {
      const positions = a.obj("positions");
      const checked: Record<Id, Position> = {};
      for (const [id, value] of Object.entries(positions)) {
        a.existingNode(id, `positions key`);
        checked[id] = a.position(value, `positions.${id}`);
      }
      return { doc: setPositions(doc, checked) };
    }
    case "renameId": {
      const from = a.str("from");
      const known = allIds(doc);
      for (const note of doc.notes ?? []) known.delete(note.id);
      if (!known.has(from)) fail(`no object has id "${from}"${didYouMean(from, known)}`);
      const to = a.newId("to");
      return { doc: renameId(doc, from, to), id: to };
    }
    default:
      return fail(`unknown op "${name}"`);
  }
}

/** Shallow merge: `null` removes a key, anything else replaces it. */
function patch<T extends object>(target: T, set: Record<string, unknown>): T {
  const next: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [key, value] of Object.entries(set)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next as T;
}

const dropNulls = (set: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(set).filter(([, value]) => value !== null));

/** Typed, checked access to one op's arguments. Every failure names the argument. */
class Args {
  constructor(
    private readonly doc: Graph,
    private readonly op: Record<string, unknown>,
    allowed: readonly string[],
  ) {
    for (const key of Object.keys(op)) {
      if (key === "op" || allowed.includes(key)) continue;
      fail(`unknown argument "${key}"${didYouMean(key, allowed)}; this op takes ${allowed.map((k) => `"${k}"`).join(", ")}`);
    }
  }

  raw(key: string): unknown {
    return this.op[key];
  }

  str(key: string): string {
    const value = this.op[key];
    if (typeof value !== "string") fail(`"${key}" must be a string, got ${describe(value)}`);
    return value as string;
  }

  optStr(key: string): string | undefined {
    return this.op[key] === undefined ? undefined : this.str(key);
  }

  /** Missing or null means "remove". */
  nullableStr(key: string): string | undefined {
    const value = this.op[key];
    return value === undefined || value === null ? undefined : this.str(key);
  }

  optBool(key: string): boolean | undefined {
    const value = this.op[key];
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") fail(`"${key}" must be true or false, got ${describe(value)}`);
    return value as boolean;
  }

  oneOf<const T extends string>(key: string, values: readonly T[]): T {
    const value = this.op[key];
    if (typeof value !== "string" || !values.includes(value as T)) {
      fail(`"${key}" must be one of ${values.join(" | ")}, got ${describe(value)}${
        typeof value === "string" ? didYouMean(value, values) : ""
      }`);
    }
    return value as T;
  }

  obj(key: string): Record<string, unknown> {
    const value = this.op[key];
    if (!isObject(value)) fail(`"${key}" must be an object, got ${describe(value)}`);
    return value as Record<string, unknown>;
  }

  optList<T>(key: string, each: (value: unknown, where: string) => T): T[] | undefined {
    const value = this.op[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return fail(`"${key}" must be a list, got ${describe(value)}`);
    return value.map((entry, i) => each(entry, `${key}[${i}]`));
  }

  /** A patch: an object whose keys are fields to set (`null` removes one). */
  patch(key: string, forbidden: readonly string[]): Record<string, unknown> {
    const set = this.obj(key);
    for (const field of forbidden) {
      if (field in set) {
        fail(
          field === "id"
            ? `"${key}" cannot change the id; use renameId, which updates every reference`
            : `"${key}" cannot change "${field}"; remove the object and add a new one`,
        );
      }
    }
    return set;
  }

  optPatch(key: string, forbidden: readonly string[]): Record<string, unknown> | undefined {
    return this.op[key] === undefined ? undefined : this.patch(key, forbidden);
  }

  position(value: unknown, where: string): Position {
    if (!isObject(value) || typeof value["x"] !== "number" || typeof value["y"] !== "number") {
      fail(`"${where}" must be {"x": number, "y": number}, got ${describe(value)}`);
    }
    const { x, y } = value as { x: number; y: number };
    return { x, y };
  }

  optPosition(key: string): Position | undefined {
    return this.op[key] === undefined ? undefined : this.position(this.op[key], key);
  }

  /** A new id: kebab-case and not yet used anywhere in the document. */
  newId(key: string): Id {
    const value = this.str(key);
    if (!ID_PATTERN.test(value)) fail(`"${key}" must be a kebab-case id (${ID_PATTERN.source}), got ${JSON.stringify(value)}`);
    if (allIds(this.doc).has(value)) fail(`"${key}": id "${value}" is already used in this document`);
    return value;
  }

  optNewId(key: string): Id | undefined {
    return this.op[key] === undefined ? undefined : this.newId(key);
  }

  existingNode(value: unknown, where: string): Id {
    if (typeof value !== "string") return fail(`"${where}" must be a node id, got ${describe(value)}`);
    const ids = this.doc.nodes.map((n) => n.id);
    if (!ids.includes(value)) fail(`"${where}": no node "${value}"${didYouMean(value, ids)}`);
    return value;
  }

  node(key: string): Id {
    return this.existingNode(this.op[key], key);
  }

  edge(key: string): Id {
    return this.existing(key, "edge", this.doc.edges.map((e) => e.id));
  }

  loop(key: string): Id {
    return this.existing(key, "loop", this.doc.loops.map((l) => l.id));
  }

  policy(key: string): Id {
    return this.existing(key, "policy", (this.doc.policies ?? []).map((p) => p.id));
  }

  stopIndex(loopId: Id, key: string): number {
    const value = this.op[key];
    const stops = this.doc.loops.find((l) => l.id === loopId)?.stops ?? [];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= stops.length) {
      fail(
        stops.length === 0
          ? `loop "${loopId}" has no stops yet`
          : `"${key}" must be a stop index from 0 to ${stops.length - 1} in loop "${loopId}", got ${describe(value)}`,
      );
    }
    return value as number;
  }

  private existing(key: string, kind: string, ids: string[]): Id {
    const value = this.str(key);
    if (!ids.includes(value)) fail(`"${key}": no ${kind} "${value}"${didYouMean(value, ids)}`);
    return value;
  }
}

const describe = (value: unknown): string =>
  value === undefined ? "nothing" : Array.isArray(value) ? "a list" : JSON.stringify(value);
