/**
 * The validator. One function per rule in `docs/graph-ir.md` §3, each carrying
 * the code it emits.
 *
 * Rules run in table order so output is stable.
 */

import { canonicalizeWithoutLayout } from "./canonicalize.js";
import { findCycles, hasPathWithin, indexGraph, isAgentNode, sortNodeIds, type GraphIndex } from "./graph-index.js";
import { error, warning, type Issue } from "./issues.js";
import { nearestIds } from "./parse.js";
import { graphSchema } from "./schema/graph.js";
import type { UnknownKey } from "./schema/dsl.js";
import {
  edgeIsolation,
  entryNodeIds,
  hasInspectableBar,
  isCriticFamily,
  isWriterFamily,
  loopMode,
  policyCoversEdge,
  reachableFrom,
} from "./semantics.js";
import { didYouMean } from "./suggest.js";
import { hasProfile } from "./targets/index.js";
import type { AgentNode, Edge, Graph, Id, Node } from "./types.js";

export type ValidateOptions = {
  /** Apply the rules that only bite at export time: `E_NO_TARGET`, `E_NO_GOAL`. */
  forExport?: boolean;
};

/** graph-ir §3 (`W_DOC_TOO_LARGE`): the "rewrite in one pass" budget. */
export const DOC_SIZE_LIMIT = 24_000;

export function validate(doc: Graph, opts: ValidateOptions = {}): Issue[] {
  const index = indexGraph(doc);
  return [
    ...duplicateIds(index),
    ...danglingRefs(index),
    ...loopBackEdges(index),
    ...cyclesWithoutStop(index),
    ...judgmentLoopsWithoutBar(index),
    ...stopsNotInspectable(index),
    ...(opts.forExport ? exportOnlyRules(index) : []),
    ...criticsNotIsolated(index),
    ...ownershipConflicts(index),
    ...irreversibleWithoutGate(index),
    ...homogeneousCritics(index),
    ...fanoutOnCoupled(index),
    ...longLoopsWithoutBudget(index),
    ...aspirationAsAcceptance(index),
    ...onlyMaxIterations(index),
    ...unreachableNodes(index),
    ...noTerminal(index),
    ...outputsNotWritable(index),
    ...unknownKeys(index),
    ...docTooLarge(index),
  ];
}

/** `E_DUPLICATE_ID` — an id appears more than once across all id-bearing objects. */
function duplicateIds(index: GraphIndex): Issue[] {
  const seen = new Map<Id, string[]>();
  for (const owner of index.owners) {
    const places = seen.get(owner.id) ?? [];
    places.push(owner.kind === "graph" ? "the graph's own id" : `${owner.kind}s[${owner.index}]`);
    seen.set(owner.id, places);
  }
  const issues: Issue[] = [];
  for (const [id, places] of seen) {
    if (places.length > 1) {
      issues.push(
        error("E_DUPLICATE_ID", `id "${id}" is used ${places.length} times: ${places.join(", ")}`, [id]),
      );
    }
  }
  return issues;
}

/** `E_DANGLING_REF` — a reference names an id no object in the document has. */
function danglingRefs(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  const nodeMissing = (id: Id): boolean => !index.nodes.has(id);

  for (const edge of index.doc.edges ?? []) {
    if (nodeMissing(edge.from)) {
      issues.push(error("E_DANGLING_REF", `edge "${edge.id}" starts at unknown node "${edge.from}"`, [edge.id]));
    }
    if (nodeMissing(edge.to)) {
      issues.push(error("E_DANGLING_REF", `edge "${edge.id}" ends at unknown node "${edge.to}"`, [edge.id]));
    }
  }

  for (const loop of index.doc.loops ?? []) {
    for (const member of loop.members ?? []) {
      if (nodeMissing(member)) {
        issues.push(error("E_DANGLING_REF", `loop "${loop.id}" lists unknown member "${member}"`, [loop.id]));
      }
    }
    for (const back of loop.back ?? []) {
      if (!index.edges.has(back)) {
        issues.push(error("E_DANGLING_REF", `loop "${loop.id}" lists unknown back edge "${back}"`, [loop.id]));
      }
    }
    if (loop.bar?.answerKeyFrom !== undefined && nodeMissing(loop.bar.answerKeyFrom)) {
      issues.push(
        error(
          "E_DANGLING_REF",
          `loop "${loop.id}" takes its answer key from unknown node "${loop.bar.answerKeyFrom}"`,
          [loop.id],
        ),
      );
    }
    (loop.stops ?? []).forEach((stop, i) => {
      if (stop.then !== undefined && nodeMissing(stop.then)) {
        issues.push(
          error(
            "E_DANGLING_REF",
            `loop "${loop.id}" stop ${i} (${stop.kind}) continues at unknown node "${stop.then}"`,
            [loop.id],
          ),
        );
      }
    });
  }

  for (const group of index.doc.groups ?? []) {
    for (const member of group.members ?? []) {
      if (!index.nodes.has(member) && !index.groups.has(member)) {
        issues.push(error("E_DANGLING_REF", `group "${group.id}" lists unknown member "${member}"`, [group.id]));
      }
    }
  }

  for (const policy of index.doc.policies ?? []) {
    const scope = policy.scope;
    if (scope === "graph") continue;
    const separator = scope.indexOf(":");
    const kind = scope.slice(0, separator);
    const target = scope.slice(separator + 1);
    const known =
      (kind === "node" && index.nodes.has(target)) ||
      (kind === "loop" && index.loops.has(target)) ||
      (kind === "edge" && index.edges.has(target));
    if (!known) {
      issues.push(error("E_DANGLING_REF", `policy "${policy.id}" is scoped to unknown ${kind} "${target}"`, [policy.id]));
    }
  }

  return issues;
}

/**
 * `E_LOOP_BACK_EDGE` — the `back` list is empty, an edge's endpoints are not
 * both members, or there is no path inside `members` from that edge's `to`
 * back to its `from`.
 */
function loopBackEdges(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  const edges = index.doc.edges ?? [];

  for (const loop of index.doc.loops ?? []) {
    const back = loop.back ?? [];
    if (back.length === 0) {
      issues.push(error("E_LOOP_BACK_EDGE", `loop "${loop.id}" has no back edge`, [loop.id]));
      continue;
    }
    const members = new Set<Id>(loop.members ?? []);
    for (const backId of back) {
      const edge = index.edges.get(backId);
      if (!edge) continue; // already reported as E_DANGLING_REF
      if (!members.has(edge.from) || !members.has(edge.to)) {
        issues.push(
          error(
            "E_LOOP_BACK_EDGE",
            `loop "${loop.id}": back edge "${edge.id}" runs ${edge.from} → ${edge.to}, which is not inside the loop's members`,
            [loop.id, edge.id],
          ),
        );
        continue;
      }
      if (!hasPathWithin(edge.to, edge.from, members, edges)) {
        issues.push(
          error(
            "E_LOOP_BACK_EDGE",
            `loop "${loop.id}": back edge "${edge.id}" returns to ${edge.to}, but no path inside the loop's members leads from there to ${edge.from}`,
            [loop.id, edge.id],
          ),
        );
      }
    }
  }
  return issues;
}

/**
 * `E_CYCLE_NO_STOP` — remove the back edges of every loop that has at least one
 * stop; any cycle that remains is uncovered.
 */
function cyclesWithoutStop(index: GraphIndex): Issue[] {
  const covered = new Set<Id>();
  for (const loop of index.doc.loops ?? []) {
    if ((loop.stops ?? []).length === 0) continue;
    for (const back of loop.back ?? []) covered.add(back);
  }
  const remaining: Edge[] = (index.doc.edges ?? []).filter((edge) => !covered.has(edge.id));
  return findCycles(index, remaining).map((cycle) =>
    error(
      "E_CYCLE_NO_STOP",
      `cycle with no stop: ${sortNodeIds(index, cycle).join(" → ")}. Cover it with a loop that has at least one stop.`,
      cycle,
    ),
  );
}

/** `E_JUDGMENT_LOOP_NO_BAR` — a judgment loop with no bar, or a bar with nothing inspectable. */
function judgmentLoopsWithoutBar(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  for (const loop of index.doc.loops ?? []) {
    if (loopMode(index, loop) !== "judgment") continue;
    if (hasInspectableBar(index, loop)) continue;
    issues.push(
      error(
        "E_JUDGMENT_LOOP_NO_BAR",
        loop.bar
          ? `judgment loop "${loop.id}" has a bar with nothing inspectable; give it at least one file, url, metric, checklist, artifact, or an answer key from a node in the graph`
          : `judgment loop "${loop.id}" has no bar; name what stopping looks like and what the critic inspects`,
        [loop.id],
      ),
    );
  }
  return issues;
}

/** `E_STOP_NOT_INSPECTABLE` — the only stop is "the bar passed" and the bar is not inspectable. */
function stopsNotInspectable(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  for (const loop of index.doc.loops ?? []) {
    const stops = loop.stops ?? [];
    if (stops.length === 0) continue;
    if (!stops.every((stop) => stop.kind === "bar-passed")) continue;
    if (hasInspectableBar(index, loop)) continue;
    issues.push(
      error(
        "E_STOP_NOT_INSPECTABLE",
        `loop "${loop.id}" stops only when its bar passes, but the bar names nothing a critic can inspect. An adjective is not a bar.`,
        [loop.id],
      ),
    );
  }
  return issues;
}

/** `E_NO_TARGET` and `E_NO_GOAL` — export and bootstrap preconditions. */
function exportOnlyRules(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  const doc = index.doc;

  const harness = doc.target?.harness;
  if (harness === undefined || harness.trim() === "") {
    issues.push(error("E_NO_TARGET", "export needs a target harness; set target.harness", [doc.id]));
  } else if (!hasProfile(harness)) {
    issues.push(
      error("E_NO_TARGET", `no compile profile for target harness "${harness}"`, [doc.id]),
    );
  }

  if (doc.goal === undefined || doc.goal.trim() === "") {
    issues.push(error("E_NO_GOAL", "export needs a goal; the lead brief is built from it", [doc.id]));
  }

  return issues;
}

const agentNodes = (index: GraphIndex): AgentNode[] => (index.doc.nodes ?? []).filter(isAgentNode);

const quoted = (ids: readonly string[]): string => ids.map((id) => `"${id}"`).join(", ");

/**
 * `E_CRITIC_NOT_ISOLATED` — spec §12: "a critic node shares the builder's
 * context when isolation was required". With a `critic-isolation` policy in
 * scope, an edge into a critic-family node is `shared`, or comes from a writer
 * with no `evidence` list.
 */
function criticsNotIsolated(index: GraphIndex): Issue[] {
  const policies = (index.doc.policies ?? []).filter((policy) => policy.kind === "critic-isolation");
  if (policies.length === 0) return [];
  const issues: Issue[] = [];
  for (const edge of index.doc.edges ?? []) {
    const critic = index.nodes.get(edge.to);
    if (!critic || !isCriticFamily(critic)) continue;
    const policy = policies.find((p) => policyCoversEdge(index, p, edge));
    if (!policy) continue;
    const source = index.nodes.get(edge.from);
    if (edgeIsolation(edge) === "shared") {
      issues.push(
        error(
          "E_CRITIC_NOT_ISOLATED",
          `edge "${edge.id}" hands critic "${critic.id}" shared context, but policy "${policy.id}" requires critic isolation; make the edge fresh and list the evidence the critic may inspect`,
          [edge.id, critic.id],
        ),
      );
    } else if (source && isWriterFamily(source) && (edge.evidence ?? []).length === 0) {
      issues.push(
        error(
          "E_CRITIC_NOT_ISOLATED",
          `edge "${edge.id}" runs from writer "${source.id}" to critic "${critic.id}" with no evidence list, but policy "${policy.id}" requires critic isolation; list what the critic may inspect`,
          [edge.id, source.id, critic.id],
        ),
      );
    }
  }
  return issues;
}

/** `E_OWNERSHIP_CONFLICT` — two writers own one artifact and no merge node merges it. */
function ownershipConflicts(index: GraphIndex): Issue[] {
  const owners = new Map<string, Id[]>();
  for (const node of index.doc.nodes ?? []) {
    if (!isWriterFamily(node) || node.kind !== "agent") continue;
    for (const artifact of new Set(node.owns ?? [])) owners.set(artifact, [...(owners.get(artifact) ?? []), node.id]);
  }
  const merged = new Set<string>();
  for (const node of index.doc.nodes ?? []) if (node.kind === "merge") for (const artifact of node.merges ?? []) merged.add(artifact);

  const issues: Issue[] = [];
  for (const [artifact, ids] of owners) {
    if (ids.length < 2 || merged.has(artifact)) continue;
    issues.push(
      error(
        "E_OWNERSHIP_CONFLICT",
        `artifact "${artifact}" is owned by writers ${quoted(ids)} and no merge node lists it in merges; give it one owner, or add a merge node that merges it`,
        ids,
      ),
    );
  }
  return issues;
}

/**
 * `E_IRREVERSIBLE_NO_GATE` — a node with irreversible actions has neither an
 * inbound edge with `approval: true` nor a human gate as the source of every
 * inbound edge. A node with no inbound edge at all is ungated.
 */
function irreversibleWithoutGate(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  for (const node of agentNodes(index)) {
    const actions = node.irreversible ?? [];
    if (actions.length === 0) continue;
    const inbound = index.incoming.get(node.id) ?? [];
    const approved = inbound.some((edge) => edge.approval === true);
    const gated = inbound.length > 0 && inbound.every((edge) => index.nodes.get(edge.from)?.kind === "human-gate");
    if (approved || gated) continue;
    issues.push(
      error(
        "E_IRREVERSIBLE_NO_GATE",
        `node "${node.id}" performs irreversible actions (${actions.join(", ")}) with no gate before it; set approval: true on an inbound edge, or route every inbound edge through a human-gate node`,
        [node.id],
      ),
    );
  }
  return issues;
}

/** The model a node resolves to, harness-neutrally: its tier and pins, or the session default. */
function modelKey(node: AgentNode): string {
  const pin = node.model?.pin;
  const pins = pin ? Object.keys(pin).sort().map((harness) => `${harness}: ${pin[harness]}`) : [];
  return [node.model ? `tier ${node.model.tier}` : "the session default", ...pins.map((p) => `pin ${p}`)].join(", ");
}

/** `W_HOMOGENEOUS_CRITICS` — every critic resolves to the same tier and pin as every writer. */
function homogeneousCritics(index: GraphIndex): Issue[] {
  const critics = agentNodes(index).filter(isCriticFamily);
  const writers = agentNodes(index).filter(isWriterFamily);
  if (critics.length === 0 || writers.length === 0) return [];
  const keys = new Set([...critics, ...writers].map(modelKey));
  if (keys.size !== 1) return [];
  return [
    warning(
      "W_HOMOGENEOUS_CRITICS",
      `every critic (${quoted(critics.map((n) => n.id))}) runs on the same model as every writer (${quoted(
        writers.map((n) => n.id),
      )}): ${[...keys][0]}; a critic on a different tier or pin tends to catch different mistakes`,
      sortNodeIds(index, [...critics, ...writers].map((n) => n.id)),
    ),
  ];
}

/**
 * `W_FANOUT_ON_COUPLED` — a coupled node or group receives an edge with
 * `concurrency.max > 1`, or two coupled nodes share an `owns` entry.
 */
function fanoutOnCoupled(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  const groupMembers = (groupId: Id, seen = new Set<Id>()): Id[] => {
    if (seen.has(groupId)) return [];
    seen.add(groupId);
    return (index.groups.get(groupId)?.members ?? []).flatMap((member) =>
      index.groups.has(member) ? groupMembers(member, seen) : [member],
    );
  };

  for (const edge of index.doc.edges ?? []) {
    if ((edge.concurrency?.max ?? 1) <= 1) continue;
    const target = index.nodes.get(edge.to);
    if (target?.coupled === true) {
      issues.push(
        warning(
          "W_FANOUT_ON_COUPLED",
          `edge "${edge.id}" fans out up to ${edge.concurrency!.max} at a time into "${edge.to}", which is marked coupled; coupled work should run one at a time`,
          [edge.id, edge.to],
        ),
      );
    }
    for (const group of index.doc.groups ?? []) {
      if (group.coupled !== true || !groupMembers(group.id).includes(edge.to)) continue;
      issues.push(
        warning(
          "W_FANOUT_ON_COUPLED",
          `edge "${edge.id}" fans out up to ${edge.concurrency!.max} at a time into "${edge.to}", a member of coupled group "${group.id}"; coupled work should run one at a time`,
          [edge.id, edge.to, group.id],
        ),
      );
    }
  }

  const owners = new Map<string, Id[]>();
  for (const node of agentNodes(index)) {
    if (node.coupled !== true) continue;
    for (const artifact of new Set(node.owns ?? [])) owners.set(artifact, [...(owners.get(artifact) ?? []), node.id]);
  }
  for (const [artifact, ids] of owners) {
    if (ids.length < 2) continue;
    issues.push(
      warning(
        "W_FANOUT_ON_COUPLED",
        `coupled nodes ${quoted(ids)} both own "${artifact}"; coupled work on one artifact belongs in one node`,
        ids,
      ),
    );
  }
  return issues;
}

/** `W_LONG_LOOP_NO_BUDGET` — no budget stop, and no max-iterations stop of 5 rounds or fewer. */
function longLoopsWithoutBudget(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  for (const loop of index.doc.loops ?? []) {
    const stops = loop.stops ?? [];
    if (stops.some((stop) => stop.kind === "budget")) continue;
    const caps = stops.flatMap((stop) => (stop.kind === "max-iterations" ? [stop.n] : []));
    if (caps.some((n) => n <= 5)) continue;
    issues.push(
      warning(
        "W_LONG_LOOP_NO_BUDGET",
        `loop "${loop.id}" has no budget stop and ${
          caps.length === 0 ? "no max-iterations stop" : `its max-iterations stop allows ${Math.min(...caps)} rounds`
        }; add a budget stop, or cap it at 5 rounds or fewer`,
        [loop.id],
      ),
    );
  }
  return issues;
}

const sameText = (a: string, b: string): boolean =>
  a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/** `W_ASPIRATION_AS_ACCEPTANCE` — the aspiration is the acceptance, or stands in for a blank one. */
function aspirationAsAcceptance(index: GraphIndex): Issue[] {
  const issues: Issue[] = [];
  for (const loop of index.doc.loops ?? []) {
    const bar = loop.bar;
    const aspiration = bar?.aspiration ?? "";
    if (!bar || aspiration.trim() === "") continue;
    const acceptance = bar.acceptance ?? "";
    if (acceptance.trim() === "") {
      issues.push(
        warning(
          "W_ASPIRATION_AS_ACCEPTANCE",
          `loop "${loop.id}" has an aspiration but a blank acceptance, so nothing says when the bar is met; write a reachable acceptance and keep the aspiration as direction`,
          [loop.id],
        ),
      );
    } else if (sameText(aspiration, acceptance)) {
      issues.push(
        warning(
          "W_ASPIRATION_AS_ACCEPTANCE",
          `loop "${loop.id}" uses its aspiration as its acceptance; the acceptance must be reachable, the aspiration is only direction`,
          [loop.id],
        ),
      );
    }
  }
  return issues;
}

/** `W_ONLY_MAX_ITERATIONS` — the loop's only way to stop is running out of rounds. */
function onlyMaxIterations(index: GraphIndex): Issue[] {
  return (index.doc.loops ?? [])
    .filter((loop) => (loop.stops ?? []).length > 0 && (loop.stops ?? []).every((stop) => stop.kind === "max-iterations"))
    .map((loop) =>
      warning(
        "W_ONLY_MAX_ITERATIONS",
        `loop "${loop.id}" stops only on max-iterations, which is a safety backstop, not a definition of done; add a bar-passed, budget or human stop`,
        [loop.id],
      ),
    );
}

/** `W_UNREACHABLE_NODE` — a node no entry node leads to. */
function unreachableNodes(index: GraphIndex): Issue[] {
  const entries = entryNodeIds(index);
  const reached = reachableFrom(index, entries);
  return (index.doc.nodes ?? [])
    .filter((node) => !reached.has(node.id))
    .map((node) =>
      warning(
        "W_UNREACHABLE_NODE",
        entries.length === 0
          ? `node "${node.id}" is not reachable: the graph has no entry node (every node has an inbound edge that is not a loop back edge)`
          : `node "${node.id}" is not reachable from any entry node (${quoted(entries)}); connect it or remove it`,
        [node.id],
      ),
    );
}

/** `W_NO_TERMINAL` — no stop node is reachable from an entry node. An empty graph has nothing to end. */
function noTerminal(index: GraphIndex): Issue[] {
  const nodes: Node[] = index.doc.nodes ?? [];
  if (nodes.length === 0) return [];
  const reached = reachableFrom(index, entryNodeIds(index));
  if (nodes.some((node) => node.kind === "stop" && reached.has(node.id))) return [];
  return [
    warning(
      "W_NO_TERMINAL",
      nodes.some((node) => node.kind === "stop")
        ? "no stop node is reachable from an entry node, so the run ends only when no edge is left to take; connect a stop node"
        : "the graph has no stop node, so the run ends only when no edge is left to take; add one where the work is done",
      [index.doc.id],
    ),
  ];
}

/**
 * `W_OUTPUT_NOT_WRITABLE` — an agent declares outputs but is allowed neither
 * `edit-files` nor `write-outputs`, so the lead would file them on its behalf.
 * The lead node is the main session, which writes its own files.
 */
function outputsNotWritable(index: GraphIndex): Issue[] {
  return agentNodes(index)
    .filter((node) => node.role !== "lead" && (node.outputs ?? []).length > 0)
    .filter((node) => !(node.allow ?? []).some((c) => c === "edit-files" || c === "write-outputs"))
    .map((node) =>
      warning(
        "W_OUTPUT_NOT_WRITABLE",
        `agent "${node.id}" must leave outputs behind but is allowed neither edit-files nor write-outputs, so it cannot write them itself; allow write-outputs`,
        [node.id],
      ),
    );
}

/** `W_UNKNOWN_KEY` — a key the schema does not know. It is kept; this makes a typo visible. */
function unknownKeys(index: GraphIndex): Issue[] {
  const found: UnknownKey[] = [];
  graphSchema.unknownKeys(index.doc, "", found);
  return found.map(({ path, key, known }) => {
    const owner = nearestIds(index.doc, path.slice(0, path.lastIndexOf("/")));
    return warning(
      "W_UNKNOWN_KEY",
      `unknown key "${key}" at ${path}${didYouMean(key, known)}; it is kept, but grooph does not read it`,
      owner.length > 0 ? owner : [index.doc.id],
    );
  });
}

/** `W_DOC_TOO_LARGE` — measured on the canonical form with `layout` removed (graph-ir §7). */
function docTooLarge(index: GraphIndex): Issue[] {
  const size = canonicalizeWithoutLayout(index.doc).length;
  if (size <= DOC_SIZE_LIMIT) return [];
  return [
    warning(
      "W_DOC_TOO_LARGE",
      `canonical document without layout is ${size} characters, over the ${DOC_SIZE_LIMIT}-character budget for rewriting in one pass; split it or shorten the briefs`,
      [index.doc.id],
    ),
  ];
}
