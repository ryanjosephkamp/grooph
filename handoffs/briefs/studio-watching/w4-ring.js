/* W4 · The ring. What is running stands close around the session; what has finished goes out to the rim and stays
   there. Every subagent has one place on the rim, in the order of starting, clockwise from the top; while it runs it
   is in the middle, tied to who started it, and its place on the rim is an empty socket. */
DRAW.ring = (P, v, W, o) => {
  const S = Math.min(W, 440);
  const cx = W / 2;
  const cy = S / 2 + 6;
  const R = S / 2 - 30;
  const key = `ring ${o.said}`;
  let slots = P.cache.get(key);
  if (!slots) {
    const ghosts = o.said ? P.plans.flatMap((p) => p.never) : [];
    const order = P.agents.flatMap((a) => [a.id, ...ghosts.filter((g) => g.after === a.id).map((g) => g.id)]);
    slots = new Map(order.map((id, k) => [id, k]));
    slots.n = Math.max(order.length, 12);
    P.cache.set(key, slots);
  }
  const n = slots.n;
  const sweep = 336;
  const angle = (id) => ((-90 + 12 + (sweep * (slots.get(id) + 0.5)) / n) * Math.PI) / 180;
  const rb = clamp(((R * 2 * Math.PI * sweep) / 360 / n - 4) / 2, 3.6, 9);
  const at = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const rim = (id) => at(angle(id), R + (P.byId.get(id)?.parent ? rb * 2 + 4 : 0));
  const br = clamp(S * 0.062, 18, 25);
  const orbit = R * 0.57;

  // The bodies in the middle: each as near its own place on the rim as it can stand without touching the next.
  const bodies = v.running.map((s) => ({ s, a: angle(s.a.id) })).sort((p, q) => p.a - q.a);
  const sep = 2 * Math.asin(Math.min(0.99, (br + 5) / orbit));
  for (let pass = 0; pass < 60 && bodies.length > 1; pass++) {
    for (let k = 0; k < bodies.length; k++) {
      const p = bodies[k];
      const q = bodies[(k + 1) % bodies.length];
      if (bodies.length === 2 && k === 1) break;
      const gap = k === bodies.length - 1 ? q.a + Math.PI * 2 - p.a : q.a - p.a;
      if (gap < sep) {
        p.a -= (sep - gap) / 2;
        q.a += (sep - gap) / 2;
      }
    }
  }
  const where = new Map(bodies.map((b) => [b.s.a.id, at(b.a, orbit)]));
  for (const s of v.all) if (!where.has(s.a.id)) where.set(s.a.id, rim(s.a.id));

  const out = [];
  // The rim: an arc from the first place to the last, clockwise.
  const a0 = ((-90 + 12) * Math.PI) / 180;
  const a1 = ((-90 + 12 + sweep) * Math.PI) / 180;
  const [x0, y0] = at(a0, R);
  const [x1, y1] = at(a1, R);
  out.push(path(`M${r1(x0)} ${r1(y0)}A${r1(R)} ${r1(R)} 0 1 1 ${r1(x1)} ${r1(y1)}`, { class: "f-none s-line", "stroke-width": 1.4 }));
  out.push(text(cx, cy - R + 3.5, "first ›", { size: 9, anchor: "middle", class: "t3" }));

  const ties = [];
  const front = [];
  for (const g of v.ghosts) {
    const [x, y] = rim(g.id);
    const [lx, ly] = at(angle(g.id), R + rb + 13);
    front.push(`<g data-id="${g.id}"${g.fresh ? ' class="fresh"' : ""}>${tag("circle", { cx: r1(x), cy: r1(y), r: r1(rb + 1), class: "said f-said" })}${text(lx, ly + 3, "said", { size: 8.5, anchor: "middle", weight: 600, class: "t-said" })}${o.sel === g.id ? tag("circle", { cx: r1(x), cy: r1(y), r: r1(rb + 5), class: "sel" }) : ""}</g>`);
  }
  for (const s of v.all) {
    const a = s.a;
    const [x, y] = where.get(a.id);
    const running = s.state === "running";
    const [px, py] = a.parent ? where.get(a.parent) : [cx, cy];
    if (running || a.parent) {
      // A tie from who started it: the session in the middle, or its parent wherever its parent is now.
      const mx = (x + px) / 2 + (a.parent ? (cy - (y + py) / 2) * 0.18 : 0);
      const my = (y + py) / 2 + (a.parent ? ((x + px) / 2 - cx) * 0.18 : 0);
      ties.push(path(`M${r1(px)} ${r1(py)}Q${r1(mx)} ${r1(my)} ${r1(x)} ${r1(y)}`, { class: `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"} m-${a.m.key}` }));
      if (!s.known) ties.push(text(mx + 5, my - 4, "?", { size: 11, weight: 700, class: "t3" }));
    }
    const g = [];
    if (running) {
      const [sx, sy] = rim(a.id);
      ties.push(line(x, y, sx, sy, { class: `s-m m-${a.m.key}`, "stroke-width": 1, opacity: 0.4 }));
      ties.push(tag("circle", { cx: r1(sx), cy: r1(sy), r: r1(rb), class: `f-ground s-m m-${a.m.key}`, "stroke-width": 1.3, "stroke-dasharray": "2 2" }));
      g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(br + 5), class: "halo" }));
      g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(br), class: "f-m" }));
      g.push(text(x, y - 1, a.id, { size: 11.5, weight: 700, anchor: "middle", class: "mono t-on" }));
      g.push(text(x, y + 10.5, a.m.short, { size: 9, anchor: "middle", weight: 600, class: "t-on" }));
      if (s.runs > 1) g.push(plate(x + br * 0.72, y - br * 0.72, s.runs));
      if (s.unsaid) g.push(diamond(x - br * 0.76, y - br * 0.76, 5.5));
      if (o.sel === a.id) g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(br + 4), class: "sel" }));
    } else {
      g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(Math.max(rb + 2, 7)), class: "hit" }));
      g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(rb), class: "f-surface s-m", "stroke-width": 2 }));
      if (s.state === "failed") g.push(cross(x, y, rb * 0.62));
      if (rb >= 7.5 && s.state !== "failed") g.push(text(x, y + 3, a.m.letter, { size: 8.5, weight: 700, anchor: "middle", class: "t-m" }));
      const [lx, ly] = at(angle(a.id), R + (a.parent ? rb * 2 + 4 : 0) + rb + 8);
      if (n <= 16) g.push(text(lx, ly + 3, a.id, { size: 8.5, anchor: "middle", class: "mono t3" }));
      if (s.runs > 1) {
        const [qx, qy] = n <= 16 ? at(angle(a.id), R - rb - 9) : [lx, ly];
        g.push(text(qx, qy + 3, `×${s.runs}`, { size: 8.5, weight: 700, anchor: "middle", class: "mono t2" }));
      }
      if (s.unsaid) g.push(diamond(x - rb, y - rb, 4));
      if (o.sel === a.id) g.push(tag("circle", { cx: r1(x), cy: r1(y), r: r1(rb + 4), class: "sel" }));
    }
    front.push(`<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${g.join("")}</g></g>`);
  }
  // The session: the one in the middle.
  const sr = br + 6;
  const session = `<g data-id="session">${v.working && !v.ended ? tag("circle", { cx: r1(cx), cy: r1(cy), r: r1(sr + 4), class: "f-none s-accent glow", "stroke-width": 2.5 }) : ""}${tag("circle", { cx: r1(cx), cy: r1(cy), r: r1(sr), class: "f-surface s-ink", "stroke-width": 2 })}${text(cx, cy - 1, "session", { size: 10.5, weight: 700, anchor: "middle" })}${text(cx, cy + 11, P.lead.short, { size: 9.5, anchor: "middle", class: "t2" })}${o.sel === "session" ? tag("circle", { cx: r1(cx), cy: r1(cy), r: r1(sr + 8), class: "sel" }) : ""}</g>`;
  // How many so far, by model: the one line of words this drawing needs.
  const by = new Map();
  for (const s of v.all) by.set(s.a.m.key, { m: s.a.m, n: (by.get(s.a.m.key)?.n ?? 0) + 1 });
  const tally = [...by.values()].sort((p, q) => q.n - p.n);
  const tw = tally.reduce((w, e) => w + 26 + `${e.n} ${e.m.short}`.length * 5.6, 0);
  let tx = cx - tw / 2;
  const foot = tally.map((e) => {
    const s = `${tag("circle", { cx: r1(tx + 5), cy: S + 12, r: 4.5, class: `f-m m-${e.m.key}` })}${text(tx + 13, S + 15.5, `${e.n} ${e.m.short}`, { size: 10.5, class: "t2" })}`;
    tx += 26 + `${e.n} ${e.m.short}`.length * 5.6;
    return s;
  });
  return { h: S + 28, body: `${out.join("")}${ties.join("")}${session}${front.join("")}${foot.join("")}` };
};
