import { estimateShape, formatIssue, isPlan, parseGraphText, type Graph, type Stop } from "@grooph/core";

import { readText } from "../io.js";
import { plural, printNext, type Output } from "../print.js";

export type Explained = {
  id: string;
  loops: {
    id: string;
    name: string;
    /** the max-iterations stop, or null when the loop has none */
    maxRounds: number | null;
    stops: { kind: Stop["kind"]; says: string }[];
  }[];
  gates: { id: string; name: string; guards: string }[];
  worstCaseRounds: number | null;
  budgets: string[];
  worstCase: string;
};

/**
 * What bounds a graph, read from the document and from the same shape the validator's
 * brake rules read. It adds no rule and judges nothing.
 */
export function explain(doc: Graph): Explained {
  const names = new Map(doc.nodes.map((n) => [n.id, n.name ?? n.id]));
  // What a stop does when it fires, as graph-ir section 1 defines it (core's `stopAction` says the same in the
  // package): with `then`, the run goes on at that node; a passed bar leaves the loop by its pass edges; every
  // other stop halts the run and reports to a person. None of them "ends the run" in silence.
  // A plan has no run to halt (amendment A-020; core's `isPlan`): there such a stop is where the people following
  // it stop and decide, in the words the picture and the outline use (`stopAction(stop, true)`).
  const plan = isPlan(doc);
  const after = (stop: Stop): string =>
    stop.then !== undefined
      ? `the run goes on at ${names.get(stop.then) ?? stop.then}`
      : stop.kind === "bar-passed"
        ? "the loop is left by its pass edges"
        : plan
          ? "stop here and decide"
          : "the run halts and reports to a person";

  const says = (stop: Stop): string => {
    const then = after(stop);
    switch (stop.kind) {
      case "max-iterations":
        return `after ${plural(stop.n, "round")}, ${then}`;
      case "budget":
        return `at ${stop.measure === "usd" ? `$${stop.limit}` : `${stop.limit} ${stop.measure}`}, ${then}`;
      case "bar-passed":
        return `when the acceptance bar is met, ${then}`;
      case "human":
        return `${stop.every === undefined ? "when a person halts it" : `a person is asked every ${plural(stop.every, "round")}`}, ${then}`;
      case "diminishing-returns":
        return `after ${plural(stop.rounds, "round")} without enough progress, ${then}`;
      case "evidence-invalid":
        return `after ${plural(stop.rounds, "round")} on evidence that does not hold, ${then}`;
    }
  };

  const loops = doc.loops.map((loop) => {
    const cap = loop.stops.find((s): s is Extract<Stop, { kind: "max-iterations" }> => s.kind === "max-iterations");
    return {
      id: loop.id,
      name: loop.name,
      maxRounds: cap?.n ?? null,
      stops: loop.stops.map((stop) => ({ kind: stop.kind, says: says(stop) })),
    };
  });

  const gates: Explained["gates"] = [
    ...doc.nodes.flatMap((n) => {
      if (n.kind !== "human-gate") return [];
      const after = doc.edges.filter((e) => e.from === n.id).map((e) => names.get(e.to) ?? e.to);
      return [{ id: n.id, name: n.name ?? n.id, guards: `${n.prompt}${after.length > 0 ? ` (before ${after.join(", ")})` : ""}` }];
    }),
    ...doc.edges
      .filter((e) => e.approval === true)
      .map((e) => ({ id: e.id, name: `approval on ${e.id}`, guards: `a person approves before ${names.get(e.from) ?? e.from} hands on to ${names.get(e.to) ?? e.to}` })),
  ];

  const shape = estimateShape(doc);
  const parts: string[] = [];
  if (doc.loops.length === 0) parts.push("no loop, so the work runs once through");
  else if (shape.worstCaseRounds === null) parts.push("no cap on rounds: a loop has no max-iterations stop, so only its other stops end it");
  else parts.push(`at most ${plural(shape.worstCaseRounds, "round")} of looping in all (nested loops multiplied)`);
  if (shape.budgets.length > 0) parts.push(`budgets: ${shape.budgets.join(", ")}`);
  if (gates.length > 0) parts.push(`${plural(gates.length, "place")} where a person must say go`);

  return {
    id: doc.id,
    loops,
    gates,
    worstCaseRounds: shape.worstCaseRounds,
    budgets: shape.budgets,
    worstCase: parts.join("; "),
  };
}

/** `grooph explain <file> [--json]`: plain words for what bounds a graph. */
export function explainCommand(io: Output, file: string, flags: { json?: boolean } = {}): number {
  const parsed = parseGraphText(readText(file));
  if (!parsed.doc) {
    io.err(`grooph: ${file} is not a graph document`);
    for (const issue of parsed.issues) io.err(formatIssue(issue));
    return 1;
  }
  const e = explain(parsed.doc);
  if (flags.json === true) {
    io.out(JSON.stringify(e, null, 2));
    return 0;
  }

  io.out(`${e.id}`);
  if (e.loops.length === 0) io.out("\nLoops: none.");
  for (const loop of e.loops) {
    io.out(`\nLoop "${loop.name}": ${loop.maxRounds === null ? "no round cap" : `at most ${plural(loop.maxRounds, "round")}`}.`);
    for (const stop of loop.stops) io.out(`  stops ${stop.says}`);
  }
  io.out(e.gates.length === 0 ? "\nHuman gates: none." : "\nHuman gates:");
  for (const gate of e.gates) io.out(`  ${gate.name}: ${gate.guards}`);
  io.out(`\nWorst case: ${e.worstCase}.`);
  printNext(io, `grooph validate --for-export ${file}`);
  return 0;
}
