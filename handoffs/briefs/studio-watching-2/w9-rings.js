/* W9 · Growth rings. The session as the cross-section of a tree: a ring a burst of work, the first at the heart,
   each as thick as the work that was in it. Round a ring, an arc for each subagent that ran in that burst, as long
   as its share of the burst's time. The outer ring is the one that is growing. */
DRAW.rings = (P, v, W, o) => {
  const S = Math.min(W, 420);
  const cx = W / 2;
  const cy = S / 2 + 2;
  const R = S / 2 - 18;
  const heart = P.bursts.length > 1 ? 9 : R * 0.42;
  // Every ring's place, from the whole record: a ring is as thick as the square root of the minutes of work in it.
  let rings = P.cache.get("rings");
  if (!rings) {
    const weight = P.bursts.map((b) => 1.4 + Math.sqrt(b.runs.reduce((t, r) => t + r.to - r.from, 0) / 60000));
    const scale = (R - heart) / weight.reduce((a, b) => a + b, 0);
    let r = heart;
    rings = P.bursts.map((b, k) => {
      const ring = { in: r, out: r + weight[k] * scale, total: b.runs.reduce((t, x) => t + x.to - x.from, 0), ids: b.ids };
      r = ring.out;
      return ring;
    });
    P.cache.set("rings", rings);
  }
  // The disc fills the stage as far as it has grown (a ring keeps its share of the whole, and the whole is drawn larger while it is young).
  const outer = Math.max(...P.bursts.filter((b) => b === v.burst || b.runs.some((r) => begun(v, r))).map((b) => rings[b.k].out));
  const zoom = Math.min(2.6, R / outer);
  const point = (a, r) => [cx + Math.cos(a) * r * zoom, cy + Math.sin(a) * r * zoom];
  const sector = (a0, a1, r0, r1x) => {
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = point(a0, r1x);
    const [x1, y1] = point(a1, r1x);
    const [x2, y2] = point(a1, r0);
    const [x3, y3] = point(a0, r0);
    return `M${r1(x0)} ${r1(y0)}A${r1(r1x * zoom)} ${r1(r1x * zoom)} 0 ${big} 1 ${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}A${r1(r0 * zoom)} ${r1(r0 * zoom)} 0 ${big} 0 ${r1(x3)} ${r1(y3)}Z`;
  };
  const out = [];
  const marks = [];
  const names = [];
  for (const b of P.bursts) {
    if (b !== v.burst && !b.runs.some((r) => begun(v, r))) continue;
    const ring = rings[b.k];
    const ghosts = o.said ? v.said.filter((p) => burstOfPlan(P, p) === b).flatMap((p) => p.never) : [];
    const slot = Math.min(0.22, 6 / (ring.out * zoom));
    const sweep = Math.PI * 2 - ghosts.length * slot - 0.0001;
    const gap = (ring.out - ring.in) * zoom > 3 ? 0.6 / zoom : 0.3 / zoom;
    let a0 = -Math.PI / 2;
    for (const id of ring.ids) {
      const s = v.of.get(id);
      const a = s.a;
      const all = b.runs.filter((r) => r.id === id);
      const share = (all.reduce((t, r) => t + r.to - r.from, 0) / ring.total) * sweep;
      const runs = all.filter((r) => begun(v, r));
      if (runs.length > 0) {
        const running = live(v, runs.at(-1));
        const failed = runs.at(-1).end === "failed" && !running;
        const spent = runs.reduce((t, r) => t + (live(v, r) ? v.t : r.to) - r.from, 0);
        // An arc grows round its own place as its time is spent.
        const a1 = a0 + Math.max(0.012, (spent / all.reduce((t, r) => t + r.to - r.from, 0)) * share);
        const d = sector(a0, a1, ring.in + gap / 2, ring.out - gap / 2);
        const g = [path(d, { class: `${running ? "f-m" : "f-mm"} s-ground`, "stroke-width": 0.75 })];
        const mid = point((a0 + a1) / 2, (ring.in + ring.out) / 2);
        if (running) g.push(tag("circle", { cx: r1(point(a1, (ring.in + ring.out) / 2)[0]), cy: r1(point(a1, (ring.in + ring.out) / 2)[1]), r: 3, class: "halo" }));
        if (failed) g.push(cross(mid[0], mid[1], Math.max(2, Math.min(3.5, ((ring.out - ring.in) * zoom) / 2))));
        if (s.unsaid && runs[0].k === 0) g.push(diamond(...point(a0, ring.out), 3));
        if (o.sel === id) g.push(path(d, { class: "sel" }));
        marks.push(`<g data-id="${id}" class="m-${a.m.key} is-${running ? "running" : failed ? "failed" : "done"}">${g.join("")}</g>`);
        if ((ring.out - ring.in) * zoom > 20 && a1 - a0 > 0.5) names.push(text(mid[0], mid[1] + 3, a.id, { size: 9.5, weight: 600, anchor: "middle", class: `mono ${running ? "t-on" : ""}`, id }));
      }
      a0 += share;
    }
    ghosts.forEach((ghost) => {
      const d = sector(a0 + 0.02, a0 + slot - 0.02, ring.in + gap / 2, ring.out - gap / 2);
      marks.push(`<g data-id="${ghost.id}"${ghost.fresh ? ' class="fresh"' : ""}>${path(d, { class: "said f-said" })}${o.sel === ghost.id ? path(d, { class: "sel" }) : ""}</g>`);
      a0 += slot;
    });
    if (b === v.burst) out.push(tag("circle", { cx: r1(cx), cy: r1(cy), r: r1(ring.out * zoom + 2.5), class: "f-none s-live", "stroke-width": 1 }));
  }
  const first = tag("circle", { cx: r1(cx), cy: r1(cy), r: P.bursts.length > 1 ? 3 : 4, class: "f-ink", "data-id": "session" });
  const sessionWords = P.bursts.length > 1 ? "" : `${text(cx, cy + 16, "Session", { size: 10.5, weight: 600, anchor: "middle" })}${text(cx, cy + 28, P.lead.short, { size: 9, anchor: "middle", class: "t2" })}`;
  const rim = tag("circle", { cx: r1(cx), cy: r1(cy), r: r1(R + 6), class: "f-none s-rule", "stroke-width": 0.75, "stroke-dasharray": "1 4" });
  return { h: S + 26, body: `${rim}${marks.join("")}${out.join("")}${first}${sessionWords}${names.join("")}${tallyLine(v, cx, S + 12)}` };
};
