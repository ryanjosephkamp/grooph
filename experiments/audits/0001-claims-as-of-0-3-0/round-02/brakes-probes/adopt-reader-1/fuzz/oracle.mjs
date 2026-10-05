/**
 * An oracle of my own (no import from brakes.ts / reach.ts / semantics.ts).
 *
 * 1. worstDispatches(doc, target, ceiling): the most times `target` can be dispatched in ONE single-path walk of the
 *    graph, read from docs/graph-ir.md section 2 ("Rounds", "Nested loops"), with an adversary choosing every verdict,
 *    every answer and whether a non-brake stop fires. Rules used:
 *      - the first pass is round 0; a back edge taken starts the next round of every loop that lists it;
 *      - before a back edge is taken, each loop that lists it evaluates its stops in document order, first that fires wins:
 *          max-iterations n   fires when the round just finished is n-1 or later
 *          budget dispatches  fires when the loop's members were dispatched `limit` times or more since its counter started
 *          budget <other>     fires only when limit is 0 (advisory measures; otherwise the adversary keeps it quiet)
 *          human every k      fires when (round+1) % k == 0
 *          the others         never fire here unless they carry a `then` (then the adversary may fire them)
 *      - a stop that fires with no `then` halts the run; with a `then` the run continues there (a round is counted
 *        when `then` is a member of the loop: generous to the brakes);
 *      - nested loops: when a back edge of loop O is taken, every other loop whose members are all in O and that does
 *        not list that edge starts afresh (round 0, dispatches 0).
 *    Returns `ceiling` when the count reaches it or the walk can go round for ever.
 *
 * 2. personFreePairs(doc): for every ordered pair of nodes, whether v can be reached from u without a person's
 *    decision (an edge with approval, an edge out of a human gate, a `human` stop's then), and whether it can at all.
 */
const agentish = (n) => n.kind === "agent" || n.kind === "check";

export function worstDispatches(doc, target, ceiling = 40) {
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  if (!nodes.has(target)) return 0;
  const out = new Map(doc.nodes.map((n) => [n.id, []]));
  for (const e of doc.edges) if (out.has(e.from) && nodes.has(e.to)) out.get(e.from).push(e);
  // Caps and dispatch budgets beyond what the ceiling can tell apart are read as "more than the ceiling": it bounds the walk.
  const loops = doc.loops.map((l) => ({ ...l, stops: l.stops.map((st) => (st.kind === "max-iterations" ? { ...st, n: Math.min(st.n, ceiling + 2) } : st.kind === "budget" && st.measure === "dispatches" ? { ...st, limit: Math.min(st.limit, 6 * (ceiling + 2)) } : st)) }));
  const backOf = (eid) => loops.map((l, i) => (l.back.includes(eid) ? i : -1)).filter((i) => i >= 0);
  const capOf = loops.map((l) => Math.max(0, ...l.stops.filter((s) => s.kind === "max-iterations").map((s) => s.n)));
  const budOf = loops.map((l) => Math.max(0, ...l.stops.filter((s) => s.kind === "budget" && s.measure === "dispatches").map((s) => s.limit)));
  const humOf = loops.map((l) => l.stops.filter((s) => s.kind === "human").reduce((m, s) => Math.max(m, s.every ?? 1), 0));
  const inside = loops.map((o) => loops.map((i, k) => i !== o && i.members.every((m) => o.members.includes(m)) ? k : -1).filter((k) => k >= 0));
  const allBack = new Set(loops.flatMap((l) => l.back));
  const continued = new Set(loops.flatMap((l) => l.stops.flatMap((s) => (s.then !== undefined && !l.members.includes(s.then) ? [s.then] : []))));
  const entries = doc.nodes.filter((n) => !continued.has(n.id) && !doc.edges.some((e) => e.to === n.id && !allBack.has(e.id))).map((n) => n.id);

  const memo = new Map();
  const onStack = new Map(); // key -> target count when pushed
  let steps = 0;
  // state: node, rounds[], disp[]; returns the most further dispatches of target from arriving at `id`
  const arrive = (id, rounds, disp, soFar, depth = 0) => {
    if (soFar >= ceiling) return ceiling;
    if (depth > 1500 || ++steps > 300000) return 0; // given up on this branch: an undercount, never an overcount
    const node = nodes.get(id);
    const hit = agentish(node) && id === target ? 1 : 0;
    if (agentish(node)) disp = disp.map((d, i) => (loops[i].members.includes(id) && budOf[i] > 0 ? Math.min(d + 1, budOf[i]) : d));
    const key = `${id}|${rounds.join(",")}|${disp.join(",")}`;
    if (memo.has(key)) return Math.min(ceiling, hit + memo.get(key));
    if (onStack.has(key)) return soFar + hit > onStack.get(key) ? ceiling : 0; // went round with nothing counting it
    onStack.set(key, soFar);
    let best = 0;
    if (node.kind !== "stop") {
      const moves = [];
      for (const e of out.get(id)) {
        const ls = backOf(e.id);
        let fired;
        for (const i of ls) {
          for (const s of loops[i].stops) {
            const fires =
              s.kind === "max-iterations" ? rounds[i] + 1 >= s.n
              : s.kind === "budget" ? (s.measure === "dispatches" ? disp[i] >= s.limit : s.limit === 0)
              : s.kind === "human" ? (rounds[i] + 1) % (s.every ?? 1) === 0
              : false;
            if (fires) { fired = { i, s }; break; }
          }
          if (fired) break;
        }
        if (fired) {
          if (fired.s.then === undefined || !nodes.has(fired.s.then)) continue; // halts
          const r = rounds.slice();
          if (loops[fired.i].members.includes(fired.s.then)) r[fired.i] = Math.min(r[fired.i] + 1, capOf[fired.i] + humOf[fired.i] + 1);
          moves.push([fired.s.then, r, disp]);
          continue;
        }
        const r = rounds.slice(); const d = disp.slice();
        for (const i of ls) {
          r[i] = capOf[i] + humOf[i] > 0 ? Math.min(r[i] + 1, capOf[i] + humOf[i] + 1) : 0;
          for (const k of inside[i]) if (!loops[k].back.includes(e.id)) { r[k] = 0; d[k] = 0; }
        }
        moves.push([e.to, r, d]);
      }
      // a non-brake stop with a `then`, fired at the adversary's choice, from any member
      loops.forEach((l, i) => {
        if (!l.members.includes(id)) return;
        for (const s of l.stops) if (s.then !== undefined && nodes.has(s.then) && !["max-iterations", "budget", "human"].includes(s.kind)) moves.push([s.then, rounds, disp]);
      });
      for (const [to, r, d] of moves) {
        best = Math.max(best, arrive(to, r, d, soFar + hit, depth + 1));
        if (best + hit + soFar >= ceiling) { best = ceiling; break; }
      }
    }
    onStack.delete(key);
    if (best < ceiling) memo.set(key, best);
    return Math.min(ceiling, hit + best);
  };
  let most = 0;
  for (const start of entries.length ? entries : doc.nodes.slice(0, 1).map((n) => n.id)) most = Math.max(most, arrive(start, loops.map(() => 0), loops.map(() => 0), 0));
  return most;
}

/** The nodes of loops (agents and checks) whose worst-case dispatch count grew from `before` to `after`. */
export function roundsLoosened(before, after, ceiling = 40) {
  const grown = [];
  const ids = [...new Set(before.loops.flatMap((l) => l.members))].filter((id) => { const n = before.nodes.find((x) => x.id === id); return n && agentish(n) && after.nodes.some((x) => x.id === id); });
  for (const id of ids) {
    const was = worstDispatches(before, id, ceiling);
    if (was >= ceiling) continue;
    const now = worstDispatches(after, id, ceiling);
    if (now > was) grown.push({ node: id, was, now: now >= ceiling ? `${ceiling}+` : now });
  }
  return grown;
}

const ways = (doc) => {
  const kind = new Map(doc.nodes.map((n) => [n.id, n.kind]));
  const list = doc.edges.filter((e) => kind.has(e.from) && kind.has(e.to)).map((e) => ({ from: e.from, to: e.to, person: e.approval === true || kind.get(e.from) === "human-gate" }));
  for (const l of doc.loops) for (const s of l.stops) if (s.then !== undefined && kind.has(s.then)) for (const m of l.members) if (kind.has(m)) list.push({ from: m, to: s.then, person: s.kind === "human" });
  return list;
};
const closure = (doc, free) => {
  const next = new Map(doc.nodes.map((n) => [n.id, []]));
  for (const w of ways(doc)) if (!free || !w.person) next.get(w.from).push(w.to);
  const reach = new Map();
  for (const n of doc.nodes) {
    const seen = new Set(); const q = [...next.get(n.id)];
    while (q.length) { const x = q.pop(); if (seen.has(x)) continue; seen.add(x); q.push(...next.get(x)); }
    reach.set(n.id, seen);
  }
  return reach;
};
/** Pairs (u, v) of nodes in both: before, v was reached from u only by passing a person; after, it is reached without one. */
export function personLoosened(before, after) {
  const anyWas = closure(before, false), freeWas = closure(before, true), freeNow = closure(after, true);
  const both = before.nodes.map((n) => n.id).filter((id) => after.nodes.some((n) => n.id === id));
  const pairs = [];
  for (const u of both) for (const v of both) if (anyWas.get(u).has(v) && !freeWas.get(u).has(v) && freeNow.get(u).has(v)) pairs.push(`${u}->${v}`);
  return pairs;
}
