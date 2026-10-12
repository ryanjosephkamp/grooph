/* W4 3D · The helix. W4's rim wound upward: every subagent has one place on a rising coil, in the order of
   starting, the oldest at the foot. The flat ring keeps the past as a count of beads; here the past has an order
   and a height, and a day is a mark on the mast. What is running stands at the top beside the session, with a
   thread down to its own place on the coil. */
DRAW.helix = (P, v, W, o) => {
  const pad = 14;
  const places = placesOf(P, o.said);
  const n = Math.max(places.n, 8);
  const perTurn = n <= 16 ? 8 : 14;
  const rise = clamp(250 / n, 4.4, 15);
  const cx = W / 2;
  const R = Math.min(W * 0.31, 132);
  const squash = 0.3;
  const top = pad + 30;
  const shown = [...v.all.map((s) => places.get(s.a.id)), ...v.ghosts.map((g) => places.get(g.id))];
  const last = Math.max(-1, ...shown);
  // The coil hangs under the running, its newest turn at the top: it is as long as the session has gone.
  const foot = top + 96 + Math.max(last, 2) * rise + R * squash;
  const where = (k) => {
    const a = Math.PI * 0.75 + (k * 2 * Math.PI) / perTurn;
    return { x: cx + R * Math.cos(a), y: foot - k * rise + R * squash * Math.sin(a), front: Math.sin(a) >= 0 };
  };
  const out = [];
  // The mast, and a mark on it where a day has gone by.
  out.push(rule(cx, top + 22, cx, foot + 6, { class: "s-hair", "stroke-width": 1 }));
  let day = 0;
  for (const s of v.all) {
    const d = Math.floor(s.a.runs[0].from / 86400000);
    if (d === day) continue;
    day = d;
    const y = foot - places.get(s.a.id) * rise;
    out.push(line(cx - 4, sn(y), cx + 4, sn(y), { class: "s-ink", "stroke-width": 1 }), text(cx + 7, y + 3, `${d}d`, { size: 8.5, class: "mono t3 lift" }));
  }
  // The coil, as far as the session has gone: the half behind the mast is fainter.
  const coil = { front: [], back: [] };
  for (let k = 0; k < last; k++) {
    for (let j = 0; j < 4; j++) {
      const p = where(k + j / 4);
      const q = where(k + (j + 1) / 4);
      coil[p.front && q.front ? "front" : "back"].push(`M${r1(p.x)} ${r1(p.y)}L${r1(q.x)} ${r1(q.y)}`);
    }
  }
  out.push(path(coil.back.join(""), { class: "f-none s-hair back", "stroke-width": 1 }), path(coil.front.join(""), { class: "f-none s-edge", "stroke-width": 1, "stroke-linecap": "round" }));

  // The running: in a row under the session, each as near above its own place as it can stand.
  const br = clamp(W * 0.055, 17, 22);
  const sy = top + 2;
  const row = v.running.map((s) => ({ s, want: where(places.get(s.a.id)).x })).sort((p, q) => p.want - q.want);
  const step = Math.min(br * 2 + 14, (W - pad * 2 - br * 2) / Math.max(1, row.length - 1));
  row.forEach((b, j) => (b.x = cx + (j - (row.length - 1) / 2) * step));
  const body = new Map(row.map((b) => [b.s.a.id, [b.x, sy + 56]]));
  const at = (id) => body.get(id) ?? (() => { const p = where(places.get(id)); return [p.x, p.y]; })();

  const ties = [];
  const beads = [];
  for (const g of v.ghosts) {
    const p = where(places.get(g.id));
    beads.push(`<g data-id="${g.id}"${g.fresh ? ' class="fresh"' : ""}>${tag("circle", { cx: r1(p.x), cy: r1(p.y), r: 8, class: "hit" })}${tag("circle", { cx: r1(p.x), cy: r1(p.y), r: 4.5, class: "said f-said" })}${text(p.x + (p.x > cx ? 9 : -9), p.y + 3, "said", { size: 8.5, weight: 600, anchor: p.x > cx ? "start" : "end", class: "t-said lift" })}${o.sel === g.id ? tag("circle", { cx: r1(p.x), cy: r1(p.y), r: 8, class: "sel" }) : ""}</g>`);
  }
  for (const s of v.all) {
    const a = s.a;
    const p = where(places.get(a.id));
    const running = s.state === "running";
    const g = [];
    if (a.parent) {
      const [px, py] = at(a.parent);
      const [x, y] = at(a.id);
      ties.push(line(px, py, x, y, { class: `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"}` }));
      if (!s.known) ties.push(text((px + x) / 2 + 5, (py + y) / 2 - 4, "?", { size: 10, weight: 700, class: "t3 lift" }));
    }
    if (running) {
      const [x, y] = body.get(a.id);
      if (!a.parent) ties.push(path(`M${r1(cx)} ${r1(sy)}Q${r1(x)} ${r1(sy + 8)} ${r1(x)} ${r1(y)}`, { class: `tie ${a.shape === "background" ? "bg" : ""} live` }));
      // Its own place on the coil waits for it: an open socket, and a thread down to it.
      ties.push(line(x, y, p.x, p.y, { class: `s-mh m-${a.m.key}`, "stroke-width": 0.75, opacity: 0.75 }));
      ties.push(tag("circle", { cx: r1(p.x), cy: r1(p.y), r: 3, class: `f-ground s-mh m-${a.m.key}`, "stroke-width": 1 }));
      g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(br), class: "halo wide" }));
      g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(br), class: "f-card s-m lift-1", "stroke-width": 1.5 }));
      g.push(text(x, y - 1, a.id, { size: 10.5, weight: 600, anchor: "middle", class: "mono" }));
      g.push(swatch(x - a.m.short.length * 2.3 - 5, y + 4.5, 6), text(x + 4, y + 10.5, a.m.short, { size: 8.5, anchor: "middle", class: "t2" }));
      if (s.runs > 1) g.push(times(x + br * 0.74 + 2, y - br * 0.74, s.runs));
      if (s.unsaid) g.push(diamond(x - br * 0.72, y - br * 0.72, 4));
      if (o.sel === a.id) g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(br + 4), class: "sel" }));
    } else {
      g.push(tag("circle", { cx: r1(p.x), cy: r1(p.y), r: 7.5, class: "hit" }));
      g.push(tag("circle", { cx: r1(p.x), cy: r1(p.y), r: 4, class: `${s.state === "failed" ? "f-card s-bad" : "f-card s-m"}${p.front ? "" : " back"}`, "stroke-width": 1.25 }));
      if (s.state === "failed") g.push(cross(p.x, p.y, 2.2));
      const side = p.x > cx ? 1 : -1;
      if (n <= 16) g.push(text(p.x + side * 9, p.y + 3, a.id, { size: 8.5, anchor: side > 0 ? "start" : "end", class: "mono t3 lift" }));
      if (s.runs > 1) g.push(times(p.x + side * (n <= 16 ? 30 : 9), p.y + 3, s.runs, side > 0 ? "start" : "end"));
      if (s.unsaid) g.push(diamond(p.x - 5, p.y - 5, 3.2));
      if (o.sel === a.id) g.push(tag("circle", { cx: r1(p.x), cy: r1(p.y), r: 8, class: "sel" }));
    }
    beads.push({ front: running || p.front, html: `<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${g.join("")}</g></g>` });
  }
  const order = [...beads.filter((b) => typeof b !== "string" && !b.front).map((b) => b.html), ...beads.filter((b) => typeof b === "string"), ...beads.filter((b) => typeof b !== "string" && b.front).map((b) => b.html)];
  const h = foot + R * squash + 16;
  return { h: h + 22, body: `${out.join("")}${ties.join("")}${order.join("")}${sessionDisc(P, v, cx, sy, br + 3, o.sel)}${text(cx, foot + R * squash + 12, "first", { size: 8.5, anchor: "middle", class: "t3" })}${tallyLine(v, cx, h + 12)}` };
};
