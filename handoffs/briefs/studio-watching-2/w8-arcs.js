/* W8 · Arcs. Every subagent is a point on one line, in the order of starting, and an arc joins two that ran at
   the same time. A fan of five is a knot of ten arcs; an agent that worked alone is a bare point; an agent sent
   back out beside newer ones throws a long arc back. Under the line, an arc from a subagent to one it started. */
DRAW.arcs = (P, v, W, o) => {
  const pad = 14;
  const places = placesOf(P, o.said);
  const n = places.n;
  const perRow = n <= 16 ? n : W < 500 ? Math.ceil(n / 2) : n;
  const dx = Math.min(34, (W - pad * 2 - 12) / Math.max(1, perRow - 1 || 1));
  const rowOf = (k) => Math.floor(k / perRow);
  // Which pairs have run at the same time, by this moment.
  const pairs = [];
  for (let i = 0; i < v.all.length; i++) {
    for (let j = i + 1; j < v.all.length; j++) {
      const p = v.all[i];
      const q = v.all[j];
      const both = p.a.runs.slice(0, p.runs).some((r, a) => q.a.runs.slice(0, q.runs).some((u, b) => {
        // A run that is still open has no end yet: one that starts beside it at this very moment runs with it.
        const rEnd = a === p.runs - 1 && p.state === "running" ? Infinity : r.to;
        const uEnd = b === q.runs - 1 && q.state === "running" ? Infinity : u.to;
        return r.from < uEnd && u.from < rEnd;
      }));
      if (both) pairs.push([p, q]);
    }
  }
  const reach = Math.max(1, ...pairs.filter(([p, q]) => rowOf(places.get(p.a.id)) === rowOf(places.get(q.a.id))).map(([p, q]) => Math.abs(places.get(p.a.id) - places.get(q.a.id))));
  const up = Math.min(86, 12 + (reach * dx) / 2);
  const rowH = up + 44;
  const rows = Math.ceil(n / perRow);
  const X = (k) => pad + 6 + (k % perRow) * dx + (W - pad * 2 - 12 - (Math.min(perRow, n) - 1) * dx) / 2;
  const Y = (k) => pad + up + rowOf(k) * rowH;
  const shown = [...v.all.map((s) => places.get(s.a.id)), ...v.ghosts.map((g) => places.get(g.id))];
  const lastRow = shown.length ? rowOf(Math.max(...shown)) : 0;
  const out = [];
  for (let r = 0; r <= lastRow; r++) {
    const ks = shown.filter((k) => rowOf(k) === r);
    if (ks.length === 0) continue;
    const y = sn(pad + up + r * rowH);
    out.push(line(X(r * perRow) - 6, y, X(Math.max(...ks)) + 6, y, { class: "s-hair", "stroke-width": 1, "data-id": "session" }));
  }
  const arcs = [];
  for (const [p, q] of pairs) {
    const a = places.get(p.a.id);
    const b = places.get(q.a.id);
    const now = p.state === "running" && q.state === "running";
    if (rowOf(a) !== rowOf(b)) {
      // Two that ran together across the fold: a short arm from each toward the other row's edge.
      arcs.push(path(`M${r1(X(a))} ${r1(Y(a))}q10 -14 22 -14M${r1(X(b))} ${r1(Y(b))}q-10 -14 -22 -14`, { class: `f-none ${now ? "s-live" : "s-edge"}`, "stroke-width": now ? 1.25 : 0.75, opacity: now ? 1 : 0.6 }));
      continue;
    }
    const rad = (Math.abs(X(b) - X(a)) / 2);
    const high = Math.min(up - 6, rad);
    arcs.push({ now, html: path(`M${r1(X(a))} ${r1(Y(a))}A${r1(rad)} ${r1(high)} 0 0 1 ${r1(X(b))} ${r1(Y(b))}`, { class: `f-none ${now ? "s-live" : "s-edge"}`, "stroke-width": now ? 1.25 : 0.75, opacity: now ? 1 : 0.55 }) });
  }
  const drawnArcs = [...arcs.filter((x) => typeof x === "string"), ...arcs.filter((x) => typeof x !== "string" && !x.now).map((x) => x.html), ...arcs.filter((x) => typeof x !== "string" && x.now).map((x) => x.html)];
  const dots = [];
  for (const s of v.all) {
    const a = s.a;
    const k = places.get(a.id);
    const x = X(k);
    const y = Y(k);
    const running = s.state === "running";
    const g = [];
    if (a.parent) {
      const px = X(places.get(a.parent));
      const rad = Math.abs(x - px) / 2;
      dots.push(path(`M${r1(px)} ${r1(y)}A${r1(rad)} ${r1(Math.min(14, rad))} 0 0 0 ${r1(x)} ${r1(y)}`, { class: `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"}` }));
      if (!s.known) dots.push(text((px + x) / 2, y + 18, "?", { size: 9.5, weight: 700, anchor: "middle", class: "t3" }));
    }
    const r = dx >= 9 ? 3.8 : 3;
    g.push(tag("circle", { cx: r1(x), cy: r1(y), r: 7, class: "hit" }));
    if (running) g.push(tag("circle", { cx: r1(x), cy: r1(y), r, class: "halo" }));
    g.push(tag("circle", { cx: r1(x), cy: r1(y), r, class: running ? "f-m s-m" : s.state === "failed" ? "f-card s-bad" : "f-card s-m", "stroke-width": 1.25 }));
    if (s.state === "failed") g.push(cross(x, y, 2));
    if (n <= 16 || o.sel === a.id) g.push(text(x, y + 16, a.id, { size: 8.5, anchor: "middle", weight: running ? 700 : 400, class: `mono lift${running ? "" : " t3"}` }));
    // Sent back out: a count where there is room for one, and a second ring where there is not.
    if (s.runs > 1 && (n <= 16 || o.sel === a.id)) g.push(times(x, y + 27, s.runs, "middle"));
    else if (s.runs > 1) g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r + 2.4, class: "f-none s-m", "stroke-width": 0.75 }));
    if (s.unsaid) g.push(diamond(x - 5, y + 7, 3));
    if (o.sel === a.id) g.push(tag("circle", { cx: r1(x), cy: r1(y), r: 7, class: "sel" }));
    dots.push(`<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${g.join("")}</g></g>`);
  }
  for (const ghost of v.ghosts) {
    const k = places.get(ghost.id);
    dots.push(`<g data-id="${ghost.id}"${ghost.fresh ? ' class="fresh"' : ""}>${tag("circle", { cx: r1(X(k)), cy: r1(Y(k)), r: 7, class: "hit" })}${tag("circle", { cx: r1(X(k)), cy: r1(Y(k)), r: 3.6, class: "said f-said" })}${text(X(k), Y(k) + (n <= 16 ? 16 : 27), "said", { size: 8.5, weight: 600, anchor: "middle", class: "t-said lift" })}${o.sel === ghost.id ? tag("circle", { cx: r1(X(k)), cy: r1(Y(k)), r: 7, class: "sel" }) : ""}</g>`);
  }
  const h = pad + up + lastRow * rowH + 36;
  const together = pairs.filter(([p, q]) => p.state === "running" && q.state === "running").length;
  return { h: h + 20, body: `${out.join("")}${drawnArcs.join("")}${dots.join("")}${text(W / 2, h + 8, `${pairs.length} ${pairs.length === 1 ? "pair has" : "pairs have"} run at the same time${together ? ` · ${together} of them now` : ""}`, { size: 9.5, anchor: "middle", class: "t2" })}` };
};
