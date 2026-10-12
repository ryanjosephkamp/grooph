/* W6 3D · Floors. W6's bursts as floors of one building, the newest on top. Every subagent has one place on the
   plan, the same on every floor, so one that is sent back out stands above where it stood: a thread runs up from
   floor to floor through its place, which the flat sentence of shapes cannot show. The newest six floors are
   drawn; the older ones are under them. */
DRAW.floors = (P, v, W, o) => {
  const pad = 14;
  const places = placesOf(P, o.said);
  const G = Math.max(2, Math.ceil(Math.sqrt(places.n)));
  const begunBursts = P.bursts.filter((b) => b === v.burst || b.runs.some((r) => begun(v, r)));
  const keep = W < 500 ? 6 : 7;
  const floors = begunBursts.slice(-keep);
  const under = begunBursts.length - floors.length;
  const hw = Math.min(20, (W - pad * 2 - 58) / (2 * G));
  const hh = hw / 2;
  const gapY = Math.max(40, Math.min(58, G * hh * 0.55));
  const ox = pad + 58 + G * hw;
  const topY = pad + 30;
  const oy = (j) => topY + (floors.length - 1 - j) * gapY;
  const iso = (j, gx, gy) => [ox + (gx - gy) * hw, oy(j) + (gx + gy) * hh];
  // A place on the plan for each, the same on every floor. Places are dealt out with a stride, so that agents that
  // started one after another do not stand side by side with their names over each other.
  let stride = Math.max(1, Math.round(G * G * 0.382));
  const common = (a, b) => (b === 0 ? a : common(b, a % b));
  while (common(stride, G * G) !== 1) stride += 1;
  const cell = (j, id) => {
    const k = (1 + places.get(id) * stride) % (G * G);
    return iso(j, (k % G) + 0.5, Math.floor(k / G) + 0.5);
  };
  const out = [];
  const marks = [];
  const seen = new Map();
  floors.forEach((b, j) => {
    const here = b === v.burst;
    const plate = [iso(j, 0, 0), iso(j, G, 0), iso(j, G, G), iso(j, 0, G)];
    const g = [poly(plate, { class: `f-plate lift-1 ${here ? "s-live" : "s-hair"}`, "stroke-width": 1, "stroke-linejoin": "round", "data-go": P.moments.find((m) => m.t >= b.from && (m.kind === "start" || m.kind === "resume")).i })];
    const [lx, ly] = iso(j, 0, G);
    g.push(text(lx - 6, ly - 1, short(b.from), { size: 8.5, anchor: "end", weight: here ? 600 : 400, class: `mono ${here ? "" : "t3"}` }));
    const [mx, my] = iso(j, 0.5, 0.5);
    const ids = [...new Set(b.runs.filter((r) => begun(v, r)).map((r) => r.id))];
    g.push(text(lx - 6, ly + 10, `${ids.length} ran`, { size: 8.5, anchor: "end", class: "t3" }));
    for (const id of ids) {
      const s = v.of.get(id);
      const a = s.a;
      const runs = b.runs.filter((r) => r.id === id && begun(v, r));
      const running = live(v, runs.at(-1));
      const failed = runs.at(-1).end === "failed" && !running;
      const [x, y] = cell(j, id);
      const from = a.parent && ids.includes(a.parent) ? cell(j, a.parent) : [mx, my];
      g.push(line(from[0], from[1], x, y, { class: `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"}` }));
      // The thread up from the floor it last stood on.
      if (seen.has(id)) marks.push(line(x, seen.get(id) - 3.5, x, y + 3.5, { class: `s-m m-${a.m.key}`, "stroke-width": 1, "stroke-dasharray": "1 2.5", "stroke-linecap": "round" }));
      seen.set(id, y);
      const peg = [];
      if (running) peg.push(tag("circle", { cx: r1(x), cy: r1(y), r: 3.6, class: "halo" }));
      peg.push(tag("circle", { cx: r1(x), cy: r1(y), r: 7, class: "hit" }), tag("circle", { cx: r1(x), cy: r1(y), r: 3.6, class: running ? "f-m s-m" : failed ? "f-card s-bad" : "f-card s-m", "stroke-width": 1.25 }));
      if (runs[0].k > 0 && !running) peg.push(tag("circle", { cx: r1(x), cy: r1(y), r: 1.1, class: "f-m" }));
      if (failed) peg.push(cross(x, y, 2.2));
      if (here || running) peg.push(text(x + (x > W - 34 ? -6 : 6), y - 4, a.id, { size: 8.5, weight: running ? 700 : 500, anchor: x > W - 34 ? "end" : undefined, class: `mono lift${running ? "" : " t2"}` }));
      if (s.unsaid && runs[0].k === 0) peg.push(diamond(x - 5, y - 5, 3));
      if (o.sel === id) peg.push(tag("circle", { cx: r1(x), cy: r1(y), r: 7, class: "sel" }));
      marks.push(`<g data-id="${id}" class="m-${a.m.key} is-${running ? "running" : failed ? "failed" : "done"}">${peg.join("")}</g>`);
    }
    if (o.said) for (const p of v.said) if (burstOfPlan(P, p) === b) for (const ghost of p.never) {
      const [x, y] = cell(j, ghost.id);
      g.push(line(mx, my, x, y, { class: "said f-none" }));
      marks.push(`<g data-id="${ghost.id}"${ghost.fresh ? ' class="fresh"' : ""}>${tag("circle", { cx: r1(x), cy: r1(y), r: 7, class: "hit" })}${tag("circle", { cx: r1(x), cy: r1(y), r: 3.6, class: "said f-said" })}${text(x + (x > W - 34 ? -6 : 6), y + 9, "said", { size: 8.5, weight: 600, anchor: x > W - 34 ? "end" : undefined, class: "t-said lift" })}${o.sel === ghost.id ? tag("circle", { cx: r1(x), cy: r1(y), r: 7, class: "sel" }) : ""}</g>`);
    }
    g.push(tag("circle", { cx: r1(mx), cy: r1(my), r: 2.5, class: "f-ink", "data-id": "session" }));
    // The mast, up to the floor above.
    if (j < floors.length - 1) marks.push(line(mx, my, mx, my - gapY, { class: "s-ink", "stroke-width": 1 }));
    out.push(`<g>${g.join("")}</g>`);
    marks.push("\n");
  });
  const [tx, ty] = iso(floors.length - 1, 0.5, 0.5);
  const word = leadWord(v);
  marks.push(line(tx, ty, tx, ty - 16, { class: "s-ink", "stroke-width": 1 }), text(tx + (tx - pad > 156 ? -6 : 6), ty - 10, `Session · ${P.lead.short}${word && W >= 340 ? ` · ${word}` : ""}`, { size: 9.5, weight: 600, anchor: tx - pad > 156 ? "end" : undefined }));
  const bottom = oy(0) + G * hw + 8;
  if (under > 0) marks.push(text(ox, bottom + 8, `${under} earlier ${under === 1 ? "burst is" : "bursts are"} under these`, { size: 9, anchor: "middle", class: "t3" }));
  // A floor is drawn over the ones under it, bottom first; the pegs and threads over all of them.
  return { h: bottom + (under > 0 ? 18 : 6), body: `${out.join("")}${marks.join("")}` };
};
