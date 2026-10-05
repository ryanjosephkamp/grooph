/**
 * What a view in three dimensions needs of a graph, worked out once (handoff 0096), so that no view works any of it
 * out for itself and gets it differently: the rows of the layout, which loop is inside which, a loop's stops in
 * words and its brakes as numbers, the order of a first pass, and, for a recorded run, its notes as steps and its
 * dispatches with the round each was in and how long it took.
 *
 * It is core's own wherever core has a function (`layerNodes`, `describeStop`, `edgeWhenLabel`, `roleName`,
 * `replaySteps`), and where a node is on the canvas is handed in: the canvas's own answer, which is the document's
 * layout where it has one and depends on how wide the screen is where it has none.
 *
 * A document the app draws need not be a sound one: an edge may name a node that is gone, a loop a member that is
 * not there, a note a node an adaptive lead removed. What cannot be placed is left out here, as the stairs leave
 * it out, so that no view has to meet it. Where it has none, it is done the way the code that does it does it: a first pass as
 * `firstPass` in `graph-views.tsx`, and a full round of a loop in dispatches as the compiler tells a lead to count it
 * (`dispatchesPerRound` in `packages/core/src/compile/claude-code/lead.ts`: each member that is an agent or a check,
 * once). The studio these views were chosen from (`handoffs/briefs/studio-3d/`) was held to the graph by a second
 * reader, and what it corrected is kept here: nothing below says which brake a run meets first.
 */
import { describeStop, edgeWhen, edgeWhenLabel, layerNodes, replaySteps, roleName, type Graph, type Id, type RunNote } from "@grooph/core";

export type { Id };
export type V = [number, number, number];
export type MNode = { id: Id; name: string; kind: "agent" | "check" | "gate" | "stop"; word: string; line: string; tier: "frontier" | "strong" | "fast" | "unset" | null; loop: Id | null; at: [number, number] };
export type MEdge = { id: Id; from: Id; to: Id; when: string; back: Id | null; on: string | { verdict: string } | undefined };
/** A stop that ends a run or asks a person whatever the work looks like (core's `isBrakeStop`), as the document has it. */
export type MBrake = { kind: "max-iterations"; n: number } | { kind: "budget"; measure: string; limit: number } | { kind: "human"; every: number | null };
export type MLoop = { id: Id; name: string; inside: Id | null; members: Id[]; own: Id[]; back: Id[]; stops: string[]; brakes: MBrake[]; cap: number | null; budget: { measure: string; limit: number } | null; dispatches: number | null; human: number | null; perRound: number };
/** A group: the nodes it holds, its own and those of the groups in it, and the group it is in. */
export type MGroup = { id: Id; name: string; from: string | null; nodes: Id[]; inside: Id | null };
/** A dispatch of a run: its node's own loop and the round of that loop it was in, or neither for a node in no loop. */
export type Dispatch = { node: Id; loop: Id | null; round: number | null; outcome: string | null; minutes: number };
export type Model = {
  id: Id;
  name: string;
  rows: Id[][];
  nodes: MNode[];
  edges: MEdge[];
  loops: MLoop[];
  groups: MGroup[];
  pass: { edge: Id; loop: Id | null; says: string }[];
  run?: { end: string; dispatches: Dispatch[]; /** the highest round each loop was in at any time; `rounds` is the last */ most: Record<Id, number>; notes: { says: string; about: "graph" | "node" | "edge" | "loop"; id: Id | null; round: number | null; outcome: string | null; verdict: string | null; what: "proposal" | "amendment" | null; words: string; dispatch?: number }[]; rounds: Record<Id, number> };
};
/** One stop of the slider: what it says, what it lights, and where what is at it came from. */
export type Step = { says: string; nodes?: Id[]; edge?: Id; loops?: Id[]; from?: Id; to?: Id; r0?: number; r1?: number; about?: boolean; dispatch?: number };

const KIND = { agent: ["agent", "Agent"], check: ["check", "Check"], "human-gate": ["gate", "Human gate"], merge: ["gate", "Merge"], stop: ["stop", "Stop"] } as const;

/**
 * The groups of a document as core reads their nesting (`groupOverlaps` in core's `validate.ts`; graph-ir section
 * 2): a node or a group is in the group that lists it; listed by a group and by one inside it, it is the inner
 * one's ("nesting said twice"); listed by two groups neither of which holds the other, it is the first one's. A
 * group holds its own nodes and those of the groups in it, and one that would hold itself is held once.
 */
function groupsOf(doc: Graph): MGroup[] {
  const groups = doc.groups ?? [];
  type Group = (typeof groups)[number];
  const holds = (outer: Group, inner: Id, seen = new Set<Id>()): boolean => {
    if (seen.has(outer.id)) return false;
    seen.add(outer.id);
    return groups.some((next) => next.id !== outer.id && outer.members.includes(next.id) && (next.id === inner || holds(next, inner, seen)));
  };
  const owner = (member: Id): Id | null => {
    const lists = groups.filter((g) => g.id !== member && g.members.includes(member));
    return (lists.find((g) => !lists.some((other) => other.id !== g.id && holds(g, other.id))) ?? lists[0])?.id ?? null;
  };
  const nodes = (id: Id, seen: Set<Id>): Id[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    return [...doc.nodes.filter((n) => owner(n.id) === id).map((n) => n.id), ...groups.filter((g) => owner(g.id) === id).flatMap((g) => nodes(g.id, seen))];
  };
  return groups.map((g) => ({ id: g.id, name: g.name || g.id, from: g.from ?? null, nodes: nodes(g.id, new Set()), inside: owner(g.id) }));
}

/** How many nodes the canvas puts side by side before a row wraps, where a document has no layout of its own: the
 *  canvas's rule (`columnsForViewport` in `doc/layout.ts`), written here because that module is part of the canvas's
 *  screens and asking it for one more thing moves bytes onto them. A test holds the two together. */
export const columnsAt = (width: number): number => (width < 640 ? 2 : 4);

export function modelOf(doc: Graph, places: Record<Id, { x: number; y: number }>, notes?: readonly RunNote[]): Model {
  const rows = layerNodes(doc);
  const rank = new Map(rows.flat().map((id, k) => [id, k]));
  const at = places;
  const is = (id: Id): boolean => doc.nodes.some((n) => n.id === id);
  const name = (id: Id): string => doc.nodes.find((n) => n.id === id)?.name || id;
  // A loop is inside another when its members are some of the other's, and not all of them.
  const membersOf = (loop: Graph["loops"][number]): Id[] => loop.members.filter(is);
  const inside = (loop: Graph["loops"][number]): Id | null =>
    doc.loops.filter((outer) => outer.id !== loop.id && membersOf(outer).length > membersOf(loop).length && membersOf(loop).every((m) => outer.members.includes(m))).sort((a, b) => membersOf(a).length - membersOf(b).length)[0]?.id ?? null;
  const loops: MLoop[] = doc.loops.map((loop) => {
    const stop = <K extends Graph["loops"][number]["stops"][number]["kind"]>(kind: K) => loop.stops.find((s): s is Extract<Graph["loops"][number]["stops"][number], { kind: K }> => s.kind === kind);
    const budget = stop("budget");
    const caps = loop.stops.flatMap((s) => (s.kind === "max-iterations" ? [s.n] : []));
    // The compiler holds a lead to the least of a loop's budgets in dispatches.
    const least = loop.stops.flatMap((s) => (s.kind === "budget" && s.measure === "dispatches" ? [s.limit] : []));
    return {
      id: loop.id,
      name: loop.name || loop.id,
      inside: inside(loop),
      // In the order a first pass meets them.
      members: membersOf(loop).sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)),
      own: [],
      back: loop.back,
      stops: loop.stops.map(describeStop),
      // Every brake, in the document's order, which is the order they are looked at when a round ends.
      brakes: loop.stops.flatMap((s): MBrake[] => (s.kind === "max-iterations" ? [{ kind: s.kind, n: s.n }] : s.kind === "budget" ? [{ kind: s.kind, measure: s.measure, limit: s.limit }] : s.kind === "human" ? [{ kind: s.kind, every: s.every ?? null }] : [])),
      // The tightest cap, the first budget, and the least budget in dispatches.
      cap: caps.length ? Math.min(...caps) : null,
      budget: budget ? { measure: budget.measure, limit: budget.limit } : null,
      dispatches: least.length ? Math.min(...least) : null,
      // A person is asked every so many rounds (a `human` stop with `every`).
      human: stop("human")?.every ?? null,
      // What the compiler tells a lead a full round costs: each member that is a check, or an agent other than the
      // lead itself, once. A loop inside this one is in that count at one round of its own; every further round of
      // it adds its own on top, and a node dispatched twice in a round (invalid evidence) counts twice.
      perRound: loop.members.map((id) => doc.nodes.find((n) => n.id === id)).filter((n) => n?.kind === "check" || (n?.kind === "agent" && n.role !== "lead")).length,
    };
  });
  // A node's loop: the smallest that has it, and of two as small the first in the document. The nodes that are a
  // loop's own are those whose loop it is: not those of a loop inside it, and not one it shares with another loop
  // that is neither inside it nor round it, which is the other's if the other is smaller or comes first.
  const innermost = (id: Id): Id | null => loops.filter((l) => l.members.includes(id)).sort((a, b) => a.members.length - b.members.length)[0]?.id ?? null;
  for (const loop of loops) loop.own = loop.members.filter((m) => innermost(m) === loop.id);
  const back = new Map(doc.loops.flatMap((loop) => loop.back.map((id) => [id, loop.id] as const)));
  // The edges of a first pass, in the order of the graph's rows, and then each loop's back edges: one turn of each.
  const edges = doc.edges.filter((e) => is(e.from) && is(e.to));
  const forward = edges.filter((e) => !back.has(e.id) && rank.has(e.from) && rank.has(e.to)).sort((a, b) => rank.get(a.from)! - rank.get(b.from)! || rank.get(a.to)! - rank.get(b.to)!);
  const turns = [...back].flatMap(([id, loop]) => edges.filter((e) => e.id === id && rank.has(e.from) && rank.has(e.to)).map((e) => ({ e, loop })));
  const model: Model = {
    id: doc.id,
    name: doc.name || doc.id,
    rows,
    nodes: doc.nodes.map((n) => ({
      id: n.id,
      name: n.name || n.id,
      kind: KIND[n.kind][0],
      word: KIND[n.kind][1],
      line: n.kind === "agent" ? [roleName(n), n.model?.tier ?? "session default", n.effort].filter(Boolean).join(" · ") : KIND[n.kind][1],
      tier: n.kind === "agent" ? (n.model?.tier ?? "unset") : null,
      loop: innermost(n.id),
      at: [at[n.id]?.x ?? 0, at[n.id]?.y ?? 0],
    })),
    edges: edges.map((e) => ({ id: e.id, from: e.from, to: e.to, when: edgeWhen(e) ? edgeWhenLabel(e) : "", back: back.get(e.id) ?? null, on: e.when })),
    loops,
    groups: groupsOf(doc),
    pass: [...forward.map((e) => ({ e, loop: null as Id | null })), ...turns].map(({ e, loop }) => ({
      edge: e.id,
      loop,
      says: `${name(e.from)} to ${name(e.to)}${edgeWhen(e) ? ` · ${edgeWhenLabel(e)}` : ""}${loop ? ` · back into ${loops.find((l) => l.id === loop)!.name}: another round` : ""}`,
    })),
  };
  if (notes?.length) {
    const replay = replaySteps(notes, doc);
    const minutes = (a: string, b: string): number => Math.round(((Date.parse(b) - Date.parse(a)) / 60000) * 100) / 100;
    // How long each dispatch took, by the stamps on the notes: for the first from its own start to its end, and for
    // each one after from the end of the dispatch before to its own end. A note's own `started` is not trusted past
    // the first: a lead writes them by hand, and some are later than their `ended`.
    let last: string | undefined;
    const dispatches: Dispatch[] = [];
    // A note's round is its node's loop's. Where a note names none it is worked out from the edge the run took to
    // get there (graph-ir, "Rounds" and "Nested loops"): by a loop's own way back, that loop's next round; into a
    // loop inside the one whose way back it was, round 0, for it starts afresh; otherwise the round the loop was
    // last seen in. A way back of an outer loop that lands in a loop inside it moves the outer loop on too.
    const seen: Record<Id, number> = {};
    const most: Record<Id, number> = {};
    let was: { node: Id; outcome: string | null; verdict: string | null } | null = null;
    const steps = replay.steps.slice(1).map((step) => {
      const note = step.note!;
      const at = step.focus ?? { kind: "graph" as const };
      // A note at a node, an edge or a loop that the working copy no longer has is about the run.
      const known = at.kind === "graph" || (at.kind === "node" ? is(at.id) : at.kind === "edge" ? edges.some((e) => e.id === at.id) : loops.some((l) => l.id === at.id));
      const focus = known ? at : { kind: "graph" as const };
      const own = note.proposal?.summary ?? note.amendment?.summary ?? note.text ?? "";
      const node = focus.kind === "node" ? doc.nodes.find((n) => n.id === focus.id) : undefined;
      const loop = node ? innermost(node.id) : focus.kind === "loop" ? focus.id : null;
      if (node) {
        const turned = wayTaken(model.edges, was, node.id)?.back ?? null;
        if (turned && turned !== loop) seen[turned] = (seen[turned] ?? 0) + 1;
        if (turned && loop && note.round === undefined) seen[loop] = turned === loop ? (seen[loop] ?? 0) + 1 : loops.find((l) => l.id === loop)!.members.every((m) => loops.find((l) => l.id === turned)?.members.includes(m)) ? 0 : (seen[loop] ?? 0);
        was = { node: node.id, outcome: note.outcome ?? null, verdict: note.verdict ?? null };
      }
      const round = loop ? (seen[loop] = note.round ?? seen[loop] ?? 0) : null;
      for (const id in seen) most[id] = Math.max(most[id] ?? 0, seen[id]!);
      const out: NonNullable<Model["run"]>["notes"][number] = {
        says: step.caption,
        about: focus.kind,
        id: "id" in focus ? focus.id : null,
        round,
        outcome: note.outcome ?? null,
        verdict: note.verdict ?? null,
        what: note.proposal ? "proposal" : note.amendment ? "amendment" : null,
        // The note's own words, cut at a word: a note about the run or about an edge is not a move.
        words: own.length > 150 ? `${own.slice(0, own.lastIndexOf(" ", 150))} …` : own,
      };
      if (node && (node.kind === "agent" || node.kind === "check") && note.ended) {
        out.dispatch = dispatches.push({ node: node.id, loop, round, outcome: note.outcome ?? null, minutes: Math.max(0, minutes(last ?? note.started ?? note.ended, note.ended)) }) - 1;
        last = note.ended;
      }
      return out;
    });
    model.run = { end: replay.end.line, dispatches, most, notes: steps, rounds: Object.fromEntries(replay.end.loops.map((l) => [l.loop, l.round ?? -1])) };
  }
  return model;
}

/**
 * The edge a run took from the node of one note to the node of the next, of those between the two: the one whose
 * condition is what the first note reported (its verdict, else its outcome), else one with no condition. If none of
 * them fits what was reported there is no answer: no edge is said to have been taken that the notes do not support.
 */
export function wayTaken(edges: MEdge[], was: { node: Id; outcome: string | null; verdict: string | null } | null, to: Id): MEdge | undefined {
  const ways = was ? edges.filter((e) => e.from === was.node && e.to === to) : [];
  return ways.find((e) => typeof e.on === "object" && e.on.verdict === was?.verdict) ?? ways.find((e) => typeof e.on === "string" && e.on === was?.outcome) ?? ways.find((e) => e.on === undefined || e.on === "always");
}

/**
 * The steps a view can be walked through. A graph has the app's own: the edges of a first pass in order, then one
 * turn of each loop. A recorded run has its notes, as core replays them. Step 0 is the whole thing at once.
 */
export function stepsOf(m: Model): Step[] {
  const by = (id: Id) => m.edges.find((e) => e.id === id)!;
  if (!m.run) {
    if (!m.pass.length) return [{ says: "This graph has no edges to follow." }];
    return [
      { says: `All ${m.pass.length} edges are lit. Move the slider or press Play to follow a first pass, one edge at a time, and then each way back into a loop.` },
      ...m.pass.map((p, k) => {
        const e = by(p.edge);
        return { says: `Step ${k + 1} of ${m.pass.length}: ${p.says}`, edge: e.id, nodes: [e.from, e.to], from: e.from, to: e.to, r0: 0, r1: p.loop ? 1 : 0, ...(p.loop ? { loops: [] as Id[] } : {}) };
      }),
    ];
  }
  const { notes, dispatches, end } = m.run;
  // The rounds the dispatches were in, loop by loop: a round is a loop's own, and a node in no loop is in none.
  const rounds = m.loops.flatMap((l) => {
    const own = [...new Set(dispatches.flatMap((d) => (d.loop === l.id && d.round !== null ? [d.round] : [])))];
    return own.length ? [`round${own.length === 1 ? "" : "s"} ${own.length > 2 ? `${own.slice(0, -1).join(", ")} and ${own[own.length - 1]}` : own.join(" and ")} of ${l.name}`] : [];
  });
  const out: Step[] = [{ says: `The whole run: ${dispatches.length} dispatch${dispatches.length === 1 ? "" : "es"}${rounds.length ? `, in ${rounds.join("; ")}` : ""}. ${end} Move the slider or press Play to follow its ${notes.length} notes.` }];
  let at: { node: Id; round: number; outcome: string | null; verdict: string | null } | null = null;
  notes.forEach((s, k) => {
    const of = `Note ${k + 1} of ${notes.length}`;
    const step: Step = { says: "", ...(s.dispatch !== undefined ? { dispatch: s.dispatch } : {}) };
    if (s.about === "node" && s.id) {
      const round = s.round ?? 0;
      const was = at;
      // The edge the run took to get here. If none fits what was reported, no edge is shown as taken: the node is
      // lit, and that is all the notes say.
      const took = wayTaken(m.edges, was, s.id);
      Object.assign(step, { says: `${of}: ${s.says}`, nodes: [s.id], to: s.id, r1: round }, took && was ? { edge: took.id, from: was.node, r0: was.round } : {});
      at = { node: s.id, round, outcome: s.outcome, verdict: s.verdict };
    } else if (s.about === "loop" && s.id) Object.assign(step, { says: `${of}: ${s.says}`, loops: [s.id] });
    else if (s.about === "edge" && s.id) {
      // A note about an edge is not a move along it.
      const e = m.edges.find((x) => x.id === s.id);
      Object.assign(step, { says: `${of}, ${s.what ? `a ${s.what}` : "a note"} about the edge ${s.says}, not a move along it: ${s.words}` }, e ? { edge: e.id, nodes: [e.from, e.to], about: true, r0: at?.round ?? 0 } : {});
    } else step.says = `${of}, ${s.what ? `an ${s.what}` : "about the run"}: ${s.words}`;
    out.push(step);
  });
  return out;
}
