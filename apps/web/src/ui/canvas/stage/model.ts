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
import { describeStop, edgeWhen, edgeWhenLabel, isPersonStep, layerNodes, replaySteps, roleName, STEP_BY_LABEL, type Graph, type Id, type RunNote } from "@grooph/core";

export type { Id };
export type V = [number, number, number];
export type MNode = { id: Id; name: string; kind: "agent" | "person" | "check" | "gate" | "stop"; word: string; line: string; tier: "frontier" | "strong" | "fast" | "unset" | null; loop: Id | null; at: [number, number] };
export type MEdge = { id: Id; from: Id; to: Id; when: string; back: Id | null; on: string | { verdict: string } | undefined };
/** A stop that ends a run or asks a person whatever the work looks like (core's `isBrakeStop`), as the document has it. */
export type MBrake = { kind: "max-iterations"; n: number } | { kind: "budget"; measure: string; limit: number } | { kind: "human"; every: number | null };
export type MLoop = { id: Id; name: string; inside: Id | null; members: Id[]; own: Id[]; back: Id[]; stops: string[]; brakes: MBrake[]; cap: number | null; budget: { measure: string; limit: number } | null; dispatches: number | null; human: number | null; perRound: number };
/** A group: the nodes it holds, its own and those of the groups in it, and the group it is in. */
export type MGroup = { id: Id; name: string; from: string | null; nodes: Id[]; inside: Id | null };
/** A dispatch of a run: its node's own loop and the round of that loop it was in, or neither for a node in no loop. */
export type Dispatch = { node: Id; loop: Id | null; round: number | null; outcome: string | null; /** by the notes' stamps; none where a note has no stamp */ minutes: number | null };
export type Model = {
  /** drawn for a frame a phone's width: a view may stand things one behind the other where it would set them side by side */
  narrow: boolean;
  id: Id;
  name: string;
  rows: Id[][];
  nodes: MNode[];
  edges: MEdge[];
  loops: MLoop[];
  groups: MGroup[];
  pass: { edge: Id; loop: Id | null; says: string }[];
  run?: { end: string; /** the node the run ended or halted at, where the notes show one */ at: Id | null; dispatches: Dispatch[]; /** the highest round each loop was in at any time; `rounds` is the last */ most: Record<Id, number>; notes: { says: string; about: "graph" | "node" | "edge" | "loop"; id: Id | null; round: number | null; outcome: string | null; verdict: string | null; what: "proposal" | "amendment" | null; /** the short line before a dispatch: the next note at the same node is the same visit */ open: boolean; /** a loop's note that names the stop that fired */ stop: string | null; words: string; dispatch?: number }[]; rounds: Record<Id, number> };
};
/** One stop of the slider: what it says, what it lights, and where what is at it came from. */
export type Step = { says: string; nodes?: Id[]; edge?: Id; loops?: Id[]; from?: Id; to?: Id; r0?: number; r1?: number; /** the other edges taken to reach this step's node, with the round each was taken from */ also?: { edge: Id; r0: number }[]; about?: boolean; dispatch?: number };

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

export function modelOf(doc: Graph, places: Record<Id, { x: number; y: number }>, notes?: readonly RunNote[], narrow = false): Model {
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
      perRound: loop.members.map((id) => doc.nodes.find((n) => n.id === id)).filter((n) => n?.kind === "check" || (n?.kind === "agent" && n.role !== "lead" && !isPersonStep(n))).length,
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
    narrow,
    id: doc.id,
    name: doc.name || doc.id,
    rows,
    nodes: doc.nodes.map((n) => ({
      id: n.id,
      name: n.name || n.id,
      // A person's step (amendment A-020) says whose it is, as the picture does: "Person", in the color a person's
      // decision has, and its role with no tier and no effort, since a person is on no model and has none to set.
      // A card here has one line under its name, so the word is on that line, before the role.
      kind: isPersonStep(n) ? "person" : KIND[n.kind][0],
      word: isPersonStep(n) ? STEP_BY_LABEL.person : KIND[n.kind][1],
      line: n.kind === "agent" ? (isPersonStep(n) ? `${STEP_BY_LABEL.person} · ${roleName(n)}` : [roleName(n), n.model?.tier ?? "session default", n.effort].filter(Boolean).join(" · ")) : KIND[n.kind][1],
      tier: n.kind === "agent" && !isPersonStep(n) ? (n.model?.tier ?? "unset") : null,
      loop: innermost(n.id),
      at: [at[n.id]?.x ?? 0, at[n.id]?.y ?? 0],
    })),
    edges: edges.map((e) => ({ id: e.id, from: e.from, to: e.to, when: edgeWhen(e) ? edgeWhenLabel(e) : "", back: back.get(e.id) ?? null, on: e.when })),
    loops,
    groups: groupsOf(doc),
    pass: [...forward.map((e) => ({ e, loop: null as Id | null })), ...turns].map(({ e, loop }) => ({
      edge: e.id,
      loop,
      // As the stairs say a step (`graphScene` in `graph-views.tsx`): the two views speak alike.
      says: `${e.from === e.to ? `${name(e.from)} to itself` : `${name(e.from)} to ${name(e.to)}`}${edgeWhen(e) === "always" ? "" : ` · when ${edgeWhenLabel(e)}`}${loop ? ` · back into ${loops.find((l) => l.id === loop)!.name}: another round, until ${loops.find((l) => l.id === loop)!.stops.join("; ")}` : ""}`,
    })),
  };
  if (notes?.length) {
    const replay = replaySteps(notes, doc);
    // How long each dispatch took, by its own stamps: from its start, on its result's note or on the line before
    // the dispatch, to its end. Not from the end of the dispatch before, which holds a person's wait at a gate, and
    // is another node's time where two ran side by side. Where a stamp is missing, is not a time, or the start is
    // after the end (a lead writes them by hand), the dispatch has no minutes: none is made up.
    const began = new Map<Id, string>();
    const dispatches: Dispatch[] = [];
    // A note's round is its loop's: a loop's own note names that loop's, and a note at a node its innermost loop's.
    // But a node in a loop inside another is in a round of each, the contract's one number does not say which, and
    // leads have written the outer loop's there (the recorded Gauntlet and fresh-grind runs) as well as the inner
    // one's (the nested fixture). Three signs in the run's own notes tell the two apart, each as early as it can
    // matter. An inner loop starts afresh when the loop it is inside comes round, so a note at one of its nodes
    // right after that outer way back that names a round other than 0 is not naming the inner loop's. A loop's own
    // way back is its next round, so a note at one of its nodes right after that way back (and no outer one) that
    // names no higher a round than the loop's node before it is not naming it either. And a loop's own note names
    // the round just finished, so one that names a higher round than its node's note just before it
    // shows the node's number was not this loop's (a lower one shows nothing: the loop's note may have been written
    // late). In a run with any of them the number at a node of an inner loop is not read, and each loop's round is
    // worked out from the ways back the run took, as it is wherever a note names none (graph-ir, "Rounds" and
    // "Nested loops"): a loop's way back is that loop's next round, and every loop inside it starts afresh at
    // round 0; otherwise a loop is in the round it was last seen in.
    const inner = (id: Id | null): boolean => !!loops.find((l) => l.id === id)?.inside;
    const inside = (inner: Id, outer: Id): boolean => {
      for (let up = loops.find((l) => l.id === inner)?.inside; up; up = loops.find((l) => l.id === up)?.inside) if (up === outer) return true;
      return false;
    };
    const said: Record<Id, number | undefined> = {};
    const before: Record<Id, number> = {};
    const first = walk(model.edges);
    let others = false;
    for (const { focus, note } of replay.steps.slice(1)) {
      if (!focus || !note) continue;
      if (focus.kind === "node" && is(focus.id)) {
        const own = innermost(focus.id);
        if (own && inner(own) && note.round !== undefined) {
          const back = first.into(focus.id).flatMap((e) => (e.back ? [e.back] : []));
          const outer = back.some((id) => inside(own, id));
          others ||= outer ? note.round !== 0 : back.includes(own) && note.round <= (before[own] ?? -1);
          said[own] = before[own] = note.round;
        }
        first.at(focus.id, { round: null, outcome: note.outcome ?? null, verdict: note.verdict ?? null, open: note.outcome === "started" });
      } else if (focus.kind === "loop") {
        if (note.round !== undefined) others ||= note.round > (said[focus.id] ?? note.round), (said[focus.id] = undefined);
        if (note.stop !== undefined) first.stopped(focus.id, note.stop === "human");
      }
    }
    const seen: Record<Id, number> = {};
    const most: Record<Id, number> = {};
    const ways = walk(model.edges);
    const steps = replay.steps.slice(1).map((step) => {
      const note = step.note!;
      const at = step.focus ?? { kind: "graph" as const };
      // A note at a node, an edge or a loop that the working copy no longer has is about the run.
      const known = at.kind === "graph" || (at.kind === "node" ? is(at.id) : at.kind === "edge" ? edges.some((e) => e.id === at.id) : loops.some((l) => l.id === at.id));
      const focus = known ? at : { kind: "graph" as const };
      const own = note.proposal?.summary ?? note.amendment?.summary ?? note.text ?? "";
      const node = focus.kind === "node" ? doc.nodes.find((n) => n.id === focus.id) : undefined;
      const loop = node ? innermost(node.id) : focus.kind === "loop" ? focus.id : null;
      const named = others && node && inner(loop) ? undefined : note.round;
      // Each loop one of whose ways back was taken to get here, once.
      for (const turned of new Set(node ? ways.into(node.id).flatMap((e) => (e.back ? [e.back] : [])) : [])) {
        if (turned !== loop || named === undefined) seen[turned] = (seen[turned] ?? 0) + 1;
        for (const inner of loops) if (inside(inner.id, turned)) seen[inner.id] = 0;
      }
      const round = loop ? (seen[loop] = named ?? seen[loop] ?? 0) : null;
      if (node) ways.at(node.id, { round, outcome: note.outcome ?? null, verdict: note.verdict ?? null, open: note.outcome === "started" });
      if (focus.kind === "loop" && note.stop !== undefined) ways.stopped(focus.id, note.stop === "human");
      for (const id in seen) most[id] = Math.max(most[id] ?? 0, seen[id]!);
      const out: NonNullable<Model["run"]>["notes"][number] = {
        says: step.caption,
        about: focus.kind,
        id: "id" in focus ? focus.id : null,
        round,
        outcome: note.outcome ?? null,
        verdict: note.verdict ?? null,
        what: note.proposal ? "proposal" : note.amendment ? "amendment" : null,
        open: note.outcome === "started",
        stop: focus.kind === "loop" ? (note.stop ?? null) : null,
        // The note's own words, cut at a word: a note about the run or about an edge is not a move.
        words: own.length > 150 ? `${own.slice(0, own.lastIndexOf(" ", 150))} …` : own,
      };
      // A dispatch is a result at an agent or a check: not the line before it, and not a note that reports nothing
      // (a word, a proposal, an amendment at the node). Its minutes are by the stamps, which
      // a note may leave out (graph-ir section 6: read from the clock or omitted, never estimated): then it has none.
      // Nor is a person's step one (amendment A-020): its result is a person's, and no dispatch was made.
      if (node && (node.kind === "agent" || node.kind === "check") && !isPersonStep(node) && note.outcome && note.outcome !== "started") {
        // (Its own start where that is a time before its end; else the line before's.)
        const since = (from: string | undefined): number => (Date.parse(note.ended ?? "") - Date.parse(from ?? "")) / 60000;
        const took = since(note.started) >= 0 ? since(note.started) : since(began.get(node.id));
        out.dispatch = dispatches.push({ node: node.id, loop, round, outcome: note.outcome ?? null, minutes: took >= 0 ? took : null }) - 1;
        began.delete(node.id);
      } else if (node && note.outcome === "started" && note.started) began.set(node.id, note.started);
      return out;
    });
    model.run = { end: replay.end.line, at: replay.end.at && is(replay.end.at.id) ? replay.end.at.id : null, dispatches, most, notes: steps, rounds: Object.fromEntries(replay.end.loops.map((l) => [l.loop, l.round ?? -1])) };
  }
  return model;
}

/** Whether a loop is inside another, at any depth, as the document nests them: not two loops with the same members. */
export function under(loops: MLoop[], inner: Id, outer: Id): boolean {
  for (let at = loops.find((l) => l.id === inner)?.inside ?? null, n = 0; at && n <= loops.length; at = loops.find((l) => l.id === at)?.inside ?? null, n += 1) if (at === outer) return true;
  return false;
}

/** What a node last reported. `open` is the short line before a dispatch (`"outcome":"started"`): nothing has ended. */
type Said = { round: number | null; outcome: string | null; verdict: string | null; open: boolean };

/**
 * Which edges a run took, read from its notes in order (graph-ir section 3). Every outgoing edge whose condition
 * matches is taken, and several can be taken at once, so a node that fans out reaches each of its targets and a node
 * that fans in is reached by each of its sources. `into` is asked at a note at a node, before `at` is told of it: the
 * edges taken to get there, one from each node that has reported, with a result and not the line before a dispatch,
 * since this node was last reached; that edge being the one whose condition is what the node reported (its verdict,
 * else its outcome), else one with no condition. The edge from the node of the note before comes first, if it is one
 * of them: it is the one the eye follows. A node whose report none of its edges is for gives none: no edge is said to
 * have been taken that the notes do not support.
 *
 * Three rules of the contract are kept. Two notes running at one node, the first the line before its dispatch, are
 * one visit, and nothing was taken between them, though the node may have an edge to itself. A stop is looked at
 * before any way back is taken: where a loop's note names the stop that fired, no way back of that loop was taken
 * on what its nodes had reported by then (`stopped`). A person's stop is lifted by their answer: the note at a node
 * that comes next may have got there by the way back, on what was reported before the halt, and nothing after it
 * may; a run that ends at the halt took none (`over` is for the run's end, which is no answer). And a second
 * `invalid-evidence` from a node in a row, in one round, routes as a fail. A line that reports nothing (a word at a
 * node, the line before a dispatch) is no report: it takes back none, and no edge is taken on it.
 */
export function walk(edges: MEdge[]): { into(to: Id, over?: boolean): (MEdge & { r0: number })[]; at(node: Id, said: Said): void; stopped(loop: Id, person?: boolean): void } {
  const said = new Map<Id, Said & { k: number; routes: string | null; not: Set<Id> }>();
  const reached = new Map<Id, number>();
  let [k, last, open, lifted]: [number, Id | null, Id | null, Id | null] = [0, null, null, null];
  return {
    into(to, over) {
      if (open === to) return [];
      const since = reached.get(to) ?? -1;
      return [...said]
        .filter(([from, was]) => !was.open && (from === to || was.k > since))
        .sort(([a, x], [b, y]) => Number(b === last) - Number(a === last) || y.k - x.k)
        .flatMap(([from, was]) => {
          const between = edges.filter((e) => e.from === from && e.to === to && !(e.back && was.not.has(e.back) && (over || e.back !== lifted)));
          const took = between.find((e) => typeof e.on === "object" && e.on.verdict === was.verdict) ?? between.find((e) => typeof e.on === "string" && e.on === was.routes) ?? between.find((e) => e.on === undefined || e.on === "always");
          return took ? [{ ...took, r0: was.round ?? 0 }] : [];
        });
    },
    at(node, now) {
      k += 1;
      const was = said.get(node);
      // A node that has ended is not un-ended by a later line that reports nothing: the line before its next
      // dispatch, or a word at the node. One still running has said nothing yet. The second invalid evidence is the
      // second in one round: the node is asked once more in the same round, and no further.
      if (now.open ? !was || was.open : (now.outcome ?? now.verdict) !== null) said.set(node, { ...now, k, routes: now.outcome === "invalid-evidence" && was?.outcome === "invalid-evidence" && !was.open && was.round === now.round ? "fail" : now.outcome, not: new Set() });
      reached.set(node, k);
      // A word at a node between a person's stop and the dispatch that follows their answer does not spend the lift.
      [last, open, lifted] = [node, now.open ? node : null, now.open || (now.outcome ?? now.verdict) !== null ? null : lifted];
    },
    stopped(loop, person) {
      for (const was of said.values()) was.not.add(loop);
      if (person || lifted === loop) lifted = person ? loop : null;
    },
  };
}

/**
 * The steps a view can be walked through. A graph has the app's own: the edges of a first pass in order, then one
 * turn of each loop. A recorded run has its notes, as core replays them. Step 0 is the whole thing at once.
 */
export function stepsOf(m: Model): Step[] {
  const by = (id: Id) => m.edges.find((e) => e.id === id)!;
  if (!m.run) {
    if (!m.pass.length) return [{ says: "This graph has no edges to step through." }];
    return [
      { says: m.pass.length === 1 ? "The graph's one edge is lit." : `All ${m.pass.length} steps are lit. Move the slider or press Play to follow a first pass, one edge at a time.` },
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
  const ways = walk(m.edges);
  let stood = 0;
  let here: Id | null = null;
  notes.forEach((s, k) => {
    const of = `Note ${k + 1} of ${notes.length}`;
    const step: Step = { says: "", ...(s.dispatch !== undefined ? { dispatch: s.dispatch } : {}) };
    if (s.about === "node" && s.id) {
      const round = s.round ?? 0;
      // The edges the run took to get here: the first is the one the step follows, and the others were taken with
      // it. If none fits what was reported, no edge is shown as taken: the node is lit, and that is all the notes say.
      const [took, ...also] = ways.into(s.id);
      Object.assign(step, { says: `${of}: ${s.says}`, nodes: [s.id], to: s.id, r1: round }, took ? { edge: took.id, from: took.from, r0: took.r0 } : {}, also.length ? { also: also.map((e) => ({ edge: e.id, r0: e.r0 })) } : {});
      ways.at(s.id, { round: s.round, outcome: s.outcome, verdict: s.verdict, open: s.open });
      [stood, here] = [round, s.id];
    } else if (s.about === "loop" && s.id) {
      Object.assign(step, { says: `${of}: ${s.says}`, loops: [s.id] });
      if (s.stop) ways.stopped(s.id, s.stop === "human");
    }
    else if (s.about === "edge" && s.id) {
      // A proposal or an amendment about an edge is not a move along it, and is said not to be. A plain note at an
      // edge is the lead's own word that the run is on it; where it leads is the next note's to say, so the step
      // lights the edge and its two ends, and counts no move of its own.
      const e = m.edges.find((x) => x.id === s.id);
      Object.assign(step, { says: s.what ? `${of}, a ${s.what} about the edge ${s.says}, not a move along it: ${s.words}` : `${of}, at the edge ${s.says}: ${s.words}` }, e ? { edge: e.id, nodes: [e.from, e.to], about: true, r0: stood } : {});
    } else step.says = `${of}, ${s.what ? `an ${s.what}` : "about the run"}: ${s.words}`;
    out.push(step);
  });
  // A lead may write the run's end as a note about the run, and none at the node it ended at: the run got there all
  // the same, as core reads the end (from a note at the edge into it), by the edges its last reports took. They
  // are the end note's: the last note about the run that carries an outcome.
  const final = out[notes.findLastIndex((n) => n.about === "graph" && n.outcome !== null) + 1]!;
  const last = m.run.at;
  if (last && last !== here && final !== out[0] && !final.nodes && !final.edge && !final.loops) {
    const [took, ...also] = ways.into(last, true);
    if (took) Object.assign(final, { nodes: [last], to: last, edge: took.id, from: took.from, r0: took.r0, r1: 0 }, also.length ? { also: also.map((e) => ({ edge: e.id, r0: e.r0 })) } : {});
  }
  return out;
}
