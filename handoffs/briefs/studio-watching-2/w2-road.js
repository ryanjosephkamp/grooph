/* W2 3D · The road. W2's lanes with time as depth: the present is the near edge, and everything that happened runs
   back from it toward the session's first line. Far things are small, so the whole session is in one view with the
   present large, which the flat lanes can only do a burst at a time. A burst is a stretch of road; a seam across
   it is where one began. A run is a low block lying on its lane: paper with a tinted roof when it has finished,
   solid while it runs, reaching the near edge. */
DRAW.road = (P, v, W, o) => {
  const pad = 14;
  const lanes = lanesOf(P);
  const spare = o.said && P.plans.some((p) => p.never.length) ? 1 : 0;
  const L = lanes.tallest + spare;
  // How far along the road a moment is: bursts end to end, each as long as the square root of its minutes, a seam between.
  let road = P.cache.get("road");
  if (!road) {
    road = { at: [], len: [] };
    let d = 0;
    for (const b of P.bursts) {
      road.at.push(d);
      road.len.push(26 + 22 * Math.sqrt((b.to - b.from) / 60000));
      d += road.len.at(-1) + 16;
    }
    P.cache.set("road", road);
  }
  const along = (b, t) => road.at[b.k] + clamp((t - b.from) / Math.max(1, b.to - b.from), 0, 1) * road.len[b.k];
  const now = along(v.burst, v.t);
  const horizon = pad + 26;
  const front = horizon + Math.min(250, W * 0.72);
  const cx = W / 2;
  const roadW = W - pad * 2 - 8;
  const laneW = roadW / L;
  const f = 135;
  const S = (z) => f / (f + Math.max(0, z));
  const Y = (z) => horizon + (front - horizon) * S(z);
  const X = (u, z) => cx + (u - roadW / 2) * S(z);
  const far = now + 30;
  const out = [];
  // The road, its lanes, and a seam where each burst began.
  out.push(poly([[X(0, 0), Y(0)], [X(roadW, 0), Y(0)], [X(roadW, far), Y(far)], [X(0, far), Y(far)]], { class: "f-card s-hair lift-1", "stroke-width": 1, "stroke-linejoin": "round", "data-id": "session" }));
  for (let k = 1; k < L; k++) out.push(line(X(k * laneW, 0), Y(0), X(k * laneW, far), Y(far), { class: "s-rule", "stroke-width": 0.75 }));
  for (const b of P.bursts) {
    const z = now - road.at[b.k];
    if (z < 0) continue;
    out.push(line(X(0, z), Y(z), X(roadW, z), Y(z), { class: "s-hair", "stroke-width": 0.75 }));
    if (S(z) > 0.4 && S(z) < 0.97) out.push(text(X(0, z) + 4, Y(z) - 3, short(b.from), { size: 8.5, class: "mono t3 lift" }));
  }
  out.push(line(X(0, 0), Y(0), X(0, far), Y(far), { class: "s-ink", "stroke-width": 1 }));
  out.push(text(cx, Y(far) - 6, "the session's first line", { size: 8.5, anchor: "middle", class: "t3" }));

  const blocks = [];
  const names = [];
  const lift = 7;
  for (const b of P.bursts) {
    for (const r of b.runs) {
      if (!begun(v, r)) continue;
      const s = v.of.get(r.id);
      const a = s.a;
      const k = lanes.get(`${r.id}/${r.k}`);
      const running = live(v, r);
      const z1 = now - along(b, r.from);
      const z2 = Math.max(0, now - along(b, running ? v.t : r.to));
      const u0 = k * laneW + laneW * 0.2;
      const u1 = (k + 1) * laneW - laneW * 0.2;
      const kind = running ? "on" : "off";
      const up = (z) => lift * S(z);
      const g = [];
      // The tie from whoever started it, across the road at the depth it began: from the session's edge, or from its parent's lane.
      if (r.k === 0) {
        const from = a.parent ? (lanes.get(`${a.parent}/${P.byId.get(a.parent).runs.findIndex((q) => q.from <= r.from && r.from <= q.to)}`) ?? 0) * laneW + laneW * 0.8 : 0;
        blocks.push({ z: z1 + 0.01, html: line(X(from, z1), Y(z1), X(u0, z1), Y(z1), { class: `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"}` }) + (s.known ? "" : text(X(u0, z1) - 8, Y(z1) - 3, "?", { size: 9.5, weight: 700, class: "t3 lift" })) });
      }
      g.push(poly([[X(u0, z2), Y(z2)], [X(u1, z2), Y(z2)], [X(u1, z2), Y(z2) - up(z2)], [X(u0, z2), Y(z2) - up(z2)]], { class: `${kind}-r` }));
      g.push(poly([[X(u0, z2), Y(z2) - up(z2)], [X(u1, z2), Y(z2) - up(z2)], [X(u1, z1), Y(z1) - up(z1)], [X(u0, z1), Y(z1) - up(z1)]], { class: `${kind}-t` }));
      const mx = X((u0 + u1) / 2, z2);
      if (running) {
        g.push(tag("circle", { cx: r1(mx), cy: r1(Y(z2) - up(z2) / 2), r: 3, class: "halo" }));
        names.push(`<g class="m-${a.m.key}" data-id="${a.id}">${text(mx, front + 15, `${a.id}${r.k > 0 ? `·${r.k + 1}` : ""}`, { size: 9.5, weight: 600, anchor: "middle", class: "mono" })}${L <= 6 ? `${swatch(mx - a.m.short.length * 2.4 - 6, front + 20.5, 6)}${text(mx + 4, front + 26.5, a.m.short, { size: 8.5, anchor: "middle", class: "t2" })}` : ""}</g>`);
      }
      if (r.end === "failed" && !running) g.push(cross(mx, Y(z2) - up(z2) - 1, 3.2 * Math.max(0.6, S(z2))));
      if (s.unsaid && r.k === 0) g.push(diamond(X(u0, z1), Y(z1) - up(z1), 3.5 * Math.max(0.6, S(z1))));
      if (o.sel === a.id) g.push(poly([[X(u0, z2), Y(z2)], [X(u1, z2), Y(z2)], [X(u1, z1), Y(z1) - up(z1)], [X(u0, z1), Y(z1) - up(z1)]], { class: "sel" }));
      blocks.push({ z: z2, html: `<g data-id="${a.id}" class="m-${a.m.key} is-${running ? "running" : r.end === "failed" ? "failed" : "done"}">${g.join("")}</g>` });
    }
  }
  // What was said and never seen: a dashed place on the spare lane, where it was said.
  for (const p of v.said) {
    const b = burstOfPlan(P, p);
    const z1 = now - along(b, p.at);
    if (z1 < 0 && b !== v.burst) continue;
    p.never.forEach((g, j) => {
      const za = Math.max(0, z1);
      const zb = Math.max(0, za - 34);
      const u0 = (L - 1) * laneW + laneW * 0.2;
      const u1 = L * laneW - laneW * 0.2;
      blocks.push({ z: zb - j, html: `<g data-id="${g.id}"${g.fresh ? ' class="fresh"' : ""}>${poly([[X(u0, zb), Y(zb)], [X(u1, zb), Y(zb)], [X(u1, za + 26), Y(za + 26)], [X(u0, za + 26), Y(za + 26)]], { class: "said f-said" })}${o.sel === g.id ? poly([[X(u0, zb), Y(zb)], [X(u1, zb), Y(zb)], [X(u1, za + 26), Y(za + 26)], [X(u0, za + 26), Y(za + 26)]], { class: "sel" }) : ""}</g>` });
      if (S(zb) > 0.5) names.push(text(X((u0 + u1) / 2, zb), Y(zb) - 10 * S(zb), "said", { size: 8.5, weight: 600, anchor: "middle", class: "t-said lift" }));
    });
  }
  blocks.sort((p, q) => q.z - p.z);
  // The near edge is the present.
  const edge = `${line(X(0, 0) - 4, Y(0), X(roadW, 0) + 4, Y(0), { class: "s-live", "stroke-width": 1.5, "stroke-linecap": "round" })}${text(X(roadW, 0) + 4, front - 5, "now", { size: 9, weight: 600, anchor: "end", class: "t-live lift" })}`;
  const word = leadWord(v);
  const foot = text(W - pad, front + 42, `session · ${P.lead.short}${word ? ` · ${word}` : ""}`, { size: 9, anchor: "end", class: "t3" });
  return { h: front + 50, body: `${out.join("")}${blocks.map((x) => x.html).join("")}${edge}${names.join("")}${foot}` };
};
