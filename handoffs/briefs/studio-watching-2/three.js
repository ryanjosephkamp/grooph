/* What the second page's drawings share (slice 0109, round two). A part of the page's one script, after core.js. */
const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
const poly = (list, o = {}) => tag("polygon", { points: pts(list), ...o });
/** The burst a made-up statement was said before. */
const burstOfPlan = (P, p) => burstAt(P, P.byId.get(p.before).runs[0].from);
/** A lane for every run, as W2 has them: an agent keeps one lane for the whole of a burst, and a subagent's own subagent takes one beside it. */
function lanesOf(P) {
  let lanes = P.cache.get("lanes of a road");
  if (lanes) return lanes;
  lanes = new Map();
  lanes.tallest = 1;
  for (const burst of P.bursts) {
    const ends = [];
    const last = new Map();
    for (const r of burst.runs) {
      if (!last.has(r.id)) {
        const parent = P.byId.get(r.id).parent;
        const until = Math.max(...burst.runs.filter((q) => q.id === r.id).map((q) => q.to));
        let k = parent && last.has(parent) ? last.get(parent) + 1 : 0;
        while ((ends[k] ?? -1) > r.from) k++;
        ends[k] = until;
        last.set(r.id, k);
      }
      lanes.set(`${r.id}/${r.k}`, last.get(r.id));
    }
    lanes.tallest = Math.max(lanes.tallest, ends.length);
  }
  P.cache.set("lanes of a road", lanes);
  return lanes;
}
/** Every subagent's place in the order of starting, with a place for each thing said and never seen after the one it is listed after. */
function placesOf(P, said) {
  const key = `places ${said}`;
  let places = P.cache.get(key);
  if (places) return places;
  const ghosts = said ? P.plans.flatMap((p) => p.never) : [];
  const order = P.agents.flatMap((a) => [a.id, ...ghosts.filter((g) => g.after === a.id).map((g) => g.id)]);
  places = new Map(order.map((id, k) => [id, k]));
  places.n = order.length;
  P.cache.set(key, places);
  return places;
}
/** How many subagents there are so far of each model, as swatches and words, set in the middle at a height. */
function tallyLine(v, cx, y) {
  const by = new Map();
  for (const s of v.all) by.set(s.a.m.key, { m: s.a.m, n: (by.get(s.a.m.key)?.n ?? 0) + 1 });
  const tally = [...by.values()].sort((p, q) => q.n - p.n);
  const widthOf = (e) => 24 + `${e.n} ${e.m.short}`.length * 5.3;
  let tx = cx - tally.reduce((w, e) => w + widthOf(e), 0) / 2 + 6;
  return tally
    .map((e) => {
      const s = `<g class="m-${e.m.key}">${swatch(tx, y - 7, 7)}${text(tx + 11, y, `${e.n} ${e.m.short}`, { size: 10, class: "t2" })}</g>`;
      tx += widthOf(e);
      return s;
    })
    .join("");
}
