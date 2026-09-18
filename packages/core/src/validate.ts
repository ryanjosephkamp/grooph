/**
 * The validator. One function per rule in `docs/graph-ir.md` §3, each carrying
 * the code it emits. Slice 0001 implements the ★ set; the remaining codes in
 * §3 arrive in stage 3 and are listed in `PLANNED_CODES`.
 *
 * Rules run in table order so output is stable.
 */

import { canonicalizeWithoutLayout } from "./canonicalize.js";
import { findCycles, hasPathWithin, indexGraph, sortNodeIds, type GraphIndex } from "./graph-index.js";
import { error, warning, type Issue } from "./issues.js";
import { hasProfile } from "./targets/index.js";
import { hasInspectableBar, loopMode } from "./semantics.js";
import type { Edge, Graph, Id } from "./types.js";

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
    ...docTooLarge(index),
  ];
}

/** `E_DUPLICATE_ID` — an id appears more than once across all id-bearing objects. */
function duplicateIds(index: GraphIndex): Issue[] {
  const seen = new Map<Id, string[]>();
  for (const owner of index.owners) {
    const places = seen.get(owner.id) ?? [];
    places.push(`${owner.kind}s[${owner.index}]`);
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
      if (!hasPathWithin(index, edge.to, edge.from, members, edges)) {
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
