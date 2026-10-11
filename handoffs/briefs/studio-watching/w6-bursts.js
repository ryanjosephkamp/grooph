/* W6 · A sentence of shapes. A long session is a string of small graphs: each burst of work is drawn as its own
   little graph, and they are set in rows like words. The burst the clock is in is opened under them at full size:
   the session on the left, and what it started in that burst on the right, as cards. A burst is this page's own
   reading (runs with less than ten minutes between them); no record says the word. */
DRAW.bursts = (P, v, W, o) => {
  const pad = 12;
  const b = v.burst;
  const t = v.t;
  const out = [];
  const many = P.bursts.length > 1;
  let y = pad;

  if (many) {
    const per = W < 500 ? 6 : 10;
    const cw = (W - pad * 2) / per;
    const ch = 58;
    P.bursts.forEach((burst, k) => {
      if (burst.from > t) return;
      const x0 = pad + (k % per) * cw;
      const y0 = y + Math.floor(k / per) * ch;
      const here = burst === b;
      const g = [];
      if (here) g.push(tag("rect", { x: r1(x0 + 1), y: y0, width: r1(cw - 2), height: ch - 5, rx: 8, class: "f-surface s-accent", "stroke-width": 1.8 }));
      // The little graph: the session's dot on the left, and a dot for each subagent with a run in this burst.
      const tops = burst.ids.filter((id) => !burst.ids.includes(P.byId.get(id).parent));
      const place = new Map();
      const perCol = tops.length <= 4 ? tops.length : Math.ceil(tops.length / 2);
      const mid = y0 + 21;
      // The graph is set in the middle of its cell: the session's dot, one or two columns of dots, and a child beyond.
      const widest = 16 + (tops.length > 4 ? 10 : 0) + (burst.ids.length > tops.length ? 10 : 0);
      const mx = x0 + cw / 2 - widest / 2 + 16;
      tops.forEach((id, j) => {
        const c = Math.floor(j / perCol);
        const inCol = Math.min(perCol, tops.length - c * perCol);
        place.set(id, [mx + c * 10, mid + ((j % perCol) - (inCol - 1) / 2) * 8.4]);
      });
      burst.ids.filter((id) => !place.has(id)).forEach((id) => {
        const [px, py] = place.get(P.byId.get(id).parent);
        place.set(id, [px + 10 + (tops.length > 4 && px === mx ? 10 : 0), py]);
      });
      const sx = mx - 16;
      for (const id of burst.ids) {
        const run = burst.runs.find((r) => r.id === id);
        if (run.from > t) continue;
        const a = P.byId.get(id);
        const [x, yy] = place.get(id);
        const [px, py] = place.get(a.parent) ?? [sx, mid];
        g.push(line(px, py, x, yy, { class: `s-edge`, "stroke-width": 0.9, "stroke-dasharray": a.shape === "background" ? "2 1.6" : undefined }));
      }
      g.push(tag("circle", { cx: r1(sx), cy: mid, r: 3, class: "f-ink" }));
      for (const id of burst.ids) {
        const runs = burst.runs.filter((r) => r.id === id && r.from <= t);
        if (runs.length === 0) continue;
        const a = P.byId.get(id);
        const s = v.of.get(id);
        const [x, yy] = place.get(id);
        const last = runs.at(-1);
        const running = last.to > t;
        const m = `m-${a.m.key}`;
        g.push(tag("circle", { cx: r1(x), cy: r1(yy), r: 3.3, class: running ? `f-m ${m}` : `f-surface s-m ${m}`, "stroke-width": 1.5 }));
        // Back again: a subagent that had run before this burst has a point in its dot.
        if (runs[0].k > 0 && !running) g.push(tag("circle", { cx: r1(x), cy: r1(yy), r: 1.1, class: `f-m ${m}` }));
        if (last.end === "failed" && !running) g.push(cross(x, yy, 2.6));
        if (s.unsaid && runs[0].k === 0) g.push(diamond(x - 4, yy - 4, 2.6));
      }
      if (o.said) for (const p of v.said) if (burstAt(P, P.byId.get(p.before).runs[0].from) === burst) p.never.forEach((ghost, j) => g.push(tag("circle", { cx: r1(x0 + cw - 8), cy: r1(y0 + 8 + j * 8), r: 3, class: "said f-said", "stroke-width": 1.2 })));
      g.push(text(x0 + cw / 2, y0 + ch - 11, short(burst.from), { size: 8, anchor: "middle", class: `mono ${here ? "" : "t3"}` }));
      // Touch a burst to go to its first moment.
      g.push(tag("rect", { x: r1(x0), y: y0, width: r1(cw), height: ch - 4, class: "hit" }));
      out.push(`<g data-go="${P.moments.find((m) => m.t >= burst.from && (m.kind === "start" || m.kind === "resume")).i}">${g.join("")}</g>`);
    });
    // The sentence is as long as the session has gone.
    y += Math.ceil((P.bursts.filter((x) => x.from <= t).length || 1) / per) * ch + 6;
    out.push(line(pad, y, W - pad, y, { class: "s-line", "stroke-width": 1 }));
    y += 12;
  }

  // The open burst.
  const started = b.runs.filter((r) => r.from <= t);
  const ids = [...new Set(started.map((r) => r.id))];
  const ghosts = v.ghosts.filter((g) => burstAt(P, P.byId.get(P.plans[g.plan].before).runs[0].from) === b);
  out.push(text(pad, y + 9, many ? `burst ${b.k + 1} of ${P.bursts.length} · begins ${dur(b.from)} in · ${dur(b.to - b.from)} long` : `one burst · ${dur(b.to - b.from)} of subagents' work`, { size: 10.5, class: "t2", weight: 600 }));
  y += 20;
  // Children under their parents, a step in.
  const order = [];
  for (const id of ids) {
    const a = P.byId.get(id);
    if (a.parent && ids.includes(a.parent)) continue;
    order.push({ id, in: 0 });
    for (const kid of a.kids.filter((k) => ids.includes(k))) order.push({ id: kid, in: 1 });
    for (const g of ghosts.filter((x) => x.after === id)) order.push({ ghost: g, in: 0 });
  }
  const sr = 24;
  const sx = pad + sr + 2;
  const left = pad + sr * 2 + (W < 500 ? 26 : 44);
  const ch = 40;
  const pitch = 46;
  const rowsH = Math.max(order.length, 1) * pitch - (pitch - ch);
  const sy = y + Math.max(rowsH, sr * 2 + 8) / 2;
  const top = y + Math.max(0, (sr * 2 + 8 - rowsH) / 2);
  const cards = [];
  const where = new Map();
  order.forEach((row, k) => {
    const x = left + row.in * 18;
    const cy = top + k * pitch;
    const w = W - pad - x;
    if (row.ghost) {
      cards.push(path(`M${sx + sr + 2} ${r1(sy)}C${r1(left - 14)} ${r1(sy)} ${r1(sx + sr + 16)} ${r1(cy + ch / 2)} ${r1(x)} ${r1(cy + ch / 2)}`, { class: "said f-none" }));
      cards.push(`<g data-id="${row.ghost.id}"${row.ghost.fresh ? ' class="fresh"' : ""}>${tag("rect", { x: r1(x), y: r1(cy), width: r1(w), height: ch, rx: 10, class: "said f-said" })}${text(x + 14, cy + 17, "said, never seen", { size: 11.5, weight: 700, class: "t-said" })}${text(x + 14, cy + 32, `${row.ghost.type} · made up`, { size: 10, class: "t2" })}${o.sel === row.ghost.id ? tag("rect", { x: r1(x - 3), y: r1(cy - 3), width: r1(w + 6), height: ch + 6, rx: 12, class: "sel" }) : ""}</g>`);
      return;
    }
    const s = v.of.get(row.id);
    const a = s.a;
    where.set(a.id, [x, cy]);
    const running = s.state === "running";
    const tie = `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"} m-${a.m.key}`;
    if (row.in && where.has(a.parent)) {
      const [px, py] = where.get(a.parent);
      cards.push(path(elbow(px + 9, py + ch, x, cy + ch / 2), { class: tie }));
      if (!s.known) cards.push(text(px + 13, py + ch + 12, "?", { size: 11, weight: 700, class: "t3" }));
    } else cards.push(path(`M${sx + sr + 2} ${r1(sy)}C${r1(left - 14)} ${r1(sy)} ${r1(sx + sr + 16)} ${r1(cy + ch / 2)} ${r1(x)} ${r1(cy + ch / 2)}`, { class: tie }));
    const g = [];
    if (running) g.push(tag("rect", { x: r1(x - 4), y: r1(cy - 4), width: r1(w + 8), height: ch + 8, rx: 13, class: "halo" }));
    g.push(tag("rect", { x: r1(x), y: r1(cy), width: r1(w), height: ch, rx: 10, class: `f-surface ${running ? "s-m" : "s-line"}`, "stroke-width": running ? 2 : 1.3 }));
    g.push(tag("rect", { x: r1(x + 5), y: r1(cy + 7), width: 4, height: ch - 14, rx: 2, class: running ? "f-m" : "f-surface s-m", "stroke-width": 1.2 }));
    g.push(text(x + 16, cy + 17, a.id, { size: 12.5, weight: 700, class: "mono" }));
    g.push(text(x + 16 + 30, cy + 17, a.m.name, { size: 11.5, weight: 600, class: "t-m" }));
    const word = running ? `running ${short(t - s.since)}` : s.state === "failed" ? "failed" : `done · ${short(s.ran)}`;
    g.push(text(x + w - 10, cy + 17, word, { size: 10.5, anchor: "end", weight: running ? 600 : 400, class: s.state === "failed" ? "t-bad" : running ? "t-m" : "t3" }));
    g.push(text(x + 16, cy + 32, `${a.type} · ${a.shape}${row.in ? ` · started by ${a.parent}` : ""}`, { size: 10, class: "t2" }));
    if (s.runs > 1) g.push(text(x + w - 10, cy + 32, `run ${s.runs}`, { size: 10, anchor: "end", weight: 600, class: "t2" }));
    if (s.unsaid) g.push(diamond(x + 1, cy + 1, 5.5));
    if (o.sel === a.id) g.push(tag("rect", { x: r1(x - 3), y: r1(cy - 3), width: r1(w + 6), height: ch + 6, rx: 12, class: "sel" }));
    cards.push(`<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${g.join("")}</g></g>`);
  });
  if (order.length === 0) cards.push(text(left, sy + 4, "Nothing has been started yet.", { size: 11, class: "t3" }));
  const session = `<g data-id="session">${v.working && !v.ended ? tag("circle", { cx: sx, cy: r1(sy), r: sr + 4, class: "f-none s-accent glow", "stroke-width": 2.5 }) : ""}${tag("circle", { cx: sx, cy: r1(sy), r: sr, class: "f-surface s-ink", "stroke-width": 2 })}${text(sx, sy - 1, "session", { size: 10.5, weight: 700, anchor: "middle" })}${text(sx, sy + 11, P.lead.short, { size: 9.5, anchor: "middle", class: "t2" })}${o.sel === "session" ? tag("circle", { cx: sx, cy: r1(sy), r: sr + 8, class: "sel" }) : ""}</g>`;
  return { h: y + Math.max(rowsH, sr * 2 + 8) + pad, body: `${out.join("")}${cards.join("")}${session}` };
};
