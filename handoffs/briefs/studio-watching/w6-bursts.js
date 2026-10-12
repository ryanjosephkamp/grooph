/* W6 · A sentence of shapes. A long session is a string of small graphs: each burst of work is drawn as its own
   little graph, and they are set in rows like words. The burst the clock is in is opened under them at full size:
   the session on the left, and what it started in that burst on the right, as cards. A burst is this page's own
   reading (runs with less than ten minutes between them); no record says the word. */
DRAW.bursts = (P, v, W, o) => {
  const pad = 14;
  const b = v.burst;
  const t = v.t;
  const out = [];
  const many = P.bursts.length > 1;
  let y = pad;

  if (many) {
    const per = W < 500 ? 6 : 10;
    const cw = (W - pad * 2) / per;
    const ch = 56;
    P.bursts.forEach((burst, k) => {
      if (burst !== b && !burst.runs.some((r) => begun(v, r))) return;
      const x0 = pad + (k % per) * cw;
      const y0 = y + Math.floor(k / per) * ch;
      const here = burst === b;
      const g = [];
      if (here) g.push(box(x0 + 1, y0, cw - 3, ch - 6, { rx: 6, class: "f-livet s-accent" }));
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
        if (!begun(v, burst.runs.find((r) => r.id === id))) continue;
        const a = P.byId.get(id);
        const [x, yy] = place.get(id);
        const [px, py] = place.get(a.parent) ?? [sx, mid];
        g.push(line(px, py, x, yy, { class: "s-line", "stroke-width": 0.75, "stroke-dasharray": a.shape === "background" ? "2 2" : undefined }));
      }
      g.push(tag("circle", { cx: r1(sx), cy: mid, r: 2.5, class: "f-ink" }));
      for (const id of burst.ids) {
        const runs = burst.runs.filter((r) => r.id === id && begun(v, r));
        if (runs.length === 0) continue;
        const a = P.byId.get(id);
        const s = v.of.get(id);
        const [x, yy] = place.get(id);
        const last = runs.at(-1);
        const running = live(v, last);
        const m = `m-${a.m.key}`;
        g.push(tag("circle", { cx: r1(x), cy: r1(yy), r: 3.3, class: running ? `f-m ${m}` : `f-card s-m ${m}`, "stroke-width": 1.25 }));
        // Back again: a subagent that had run before this burst has a point in its dot.
        if (runs[0].k > 0 && !running) g.push(tag("circle", { cx: r1(x), cy: r1(yy), r: 1, class: `f-m ${m}` }));
        if (last.end === "failed" && !running) g.push(cross(x, yy, 2.2));
        if (s.unsaid && runs[0].k === 0) g.push(diamond(x - 4, yy - 4, 2.4));
      }
      if (o.said) for (const p of v.said) if (burstAt(P, P.byId.get(p.before).runs[0].from) === burst) p.never.forEach((ghost, j) => g.push(tag("circle", { cx: r1(x0 + cw - 8), cy: r1(y0 + 8 + j * 8), r: 2.8, class: "said f-said", "stroke-width": 1 })));
      g.push(text(x0 + cw / 2, y0 + ch - 13, short(burst.from), { size: 8.5, anchor: "middle", weight: here ? 600 : 400, class: `mono ${here ? "" : "t3"}` }));
      // Touch a burst to go to its first moment.
      g.push(tag("rect", { x: r1(x0), y: y0, width: r1(cw), height: ch - 4, class: "hit" }));
      out.push(`<g data-go="${P.moments.find((m) => m.t >= burst.from && (m.kind === "start" || m.kind === "resume")).i}">${g.join("")}</g>`);
    });
    // The sentence is as long as the session has gone.
    y += Math.ceil((Math.max(b.k, ...P.bursts.filter((x) => x.runs.some((r) => begun(v, r))).map((x) => x.k)) + 1) / per) * ch + 6;
    out.push(rule(pad, y, W - pad, y, { class: "s-hair", "stroke-width": 1 }));
    y += 14;
  }

  // The open burst.
  const started = b.runs.filter((r) => begun(v, r));
  const ids = [...new Set(started.map((r) => r.id))];
  const ghosts = v.ghosts.filter((g) => burstAt(P, P.byId.get(P.plans[g.plan].before).runs[0].from) === b);
  out.push(text(pad, y + 9, many ? `burst ${b.k + 1} of ${P.bursts.length} · begins ${dur(b.from)} in · ${dur(b.to - b.from)} long` : `one burst · ${dur(b.to - b.from)} of subagents' work`, { size: 10.5, weight: 600 }));
  y += 22;
  // Children under their parents, a step in.
  const order = [];
  for (const id of ids) {
    const a = P.byId.get(id);
    if (a.parent && ids.includes(a.parent)) continue;
    order.push({ id, in: 0 });
    for (const kid of a.kids.filter((k) => ids.includes(k))) order.push({ id: kid, in: 1 });
    for (const g of ghosts.filter((x) => x.after === id)) order.push({ ghost: g, in: 0 });
  }
  // Said, and the one it is listed after has not started yet: it stands at the end until then.
  for (const g of ghosts.filter((x) => !order.some((row) => row.ghost === x))) order.push({ ghost: g, in: 0 });
  const sr = 24;
  const sx = pad + sr + 3;
  const left = pad + sr * 2 + (W < 500 ? 24 : 44);
  const ch = 40;
  const pitch = 47;
  const rowsH = Math.max(order.length, 1) * pitch - (pitch - ch);
  const sy = y + Math.max(rowsH, sr * 2 + 8) / 2;
  const top = y + Math.max(0, (sr * 2 + 8 - rowsH) / 2);
  const cards = [];
  const where = new Map();
  /** The tie from the session's disc to a card: out along the middle, then an easy curve to the card's own height. */
  const fan = (x, cy) => `M${sx + sr + 1} ${r1(sy)}C${r1(left - 12)} ${r1(sy)} ${r1(sx + sr + 14)} ${sn(cy + ch / 2)} ${r1(x)} ${sn(cy + ch / 2)}`;
  order.forEach((row, k) => {
    const x = left + row.in * 16;
    const cy = top + k * pitch;
    const w = W - pad - x;
    if (row.ghost) {
      cards.push(path(fan(x, cy), { class: "said f-none" }));
      cards.push(`<g data-id="${row.ghost.id}"${row.ghost.fresh ? ' class="fresh"' : ""}>${box(x, cy, w, ch, { rx: 7, class: "said f-said" })}${text(x + 12, cy + 17, "Said, never seen", { size: 11, weight: 600, class: "t-said" })}${text(x + 12, cy + 31, `${row.ghost.type} · made up`, { size: 10, class: "t2" })}${o.sel === row.ghost.id ? box(x - 3, cy - 3, w + 6, ch + 6, { rx: 9, class: "sel" }) : ""}</g>`);
      return;
    }
    const s = v.of.get(row.id);
    const a = s.a;
    where.set(a.id, [x, cy]);
    const running = s.state === "running";
    const failed = s.state === "failed";
    const tie = `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"}`;
    if (row.in && where.has(a.parent)) {
      const [px, py] = where.get(a.parent);
      cards.push(path(elbow(px + 8, py + ch + 1, x, cy + ch / 2), { class: tie }));
      if (!s.known) cards.push(text(px + 12, py + ch + 12, "?", { size: 10, weight: 700, class: "t3" }));
    } else cards.push(path(fan(x, cy), { class: tie }));
    const g = [box(x, cy, w, ch, { rx: 7, class: `${running ? "f-livet s-live" : failed ? "f-card s-bad" : "f-card s-hair"} lift-1` })];
    g.push(text(x + 12, cy + 17, a.id, { size: 12, weight: 600, class: "mono" }));
    g.push(swatch(x + 40, cy + 10), text(x + 51, cy + 17, a.m.name, { size: 10.5, weight: 600 }));
    if (running) {
      const elapsed = short(t - s.since);
      g.push(text(x + w - 11, cy + 17, elapsed, { size: 10.5, anchor: "end", weight: 600, class: "mono t-live" }));
      g.push(liveDot(x + w - 19 - elapsed.length * 6.3, cy + 13.5, 2.8));
    } else {
      const word = failed ? "failed" : short(s.ran);
      g.push(text(x + w - 11, cy + 17, word, { size: 10.5, anchor: "end", class: failed ? "t-bad" : "mono t3" }));
      if (!failed) g.push(text(x + w - 17 - word.length * 6.3, cy + 17, "done", { size: 10, anchor: "end", class: "t3" }));
      else g.push(cross(x + w - 49, cy + 13.5, 2.8));
    }
    g.push(text(x + 12, cy + 31, `${a.type} · ${a.shape}${row.in ? ` · ${W < 340 ? "" : "started "}by ${a.parent}` : ""}`, { size: 10, class: "t2" }));
    if (s.runs > 1) g.push(text(x + w - 11, cy + 31, `run ${s.runs}`, { size: 10, anchor: "end", class: "t2" }));
    if (s.unsaid) g.push(diamond(x + 0.5, cy + 0.5, 4.5));
    if (o.sel === a.id) g.push(box(x - 3, cy - 3, w + 6, ch + 6, { rx: 9, class: "sel" }));
    cards.push(`<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${g.join("")}</g></g>`);
  });
  if (order.length === 0) cards.push(text(left, sy + 4, "Nothing has been started yet.", { size: 10.5, class: "t3" }));
  return { h: y + Math.max(rowsH, sr * 2 + 8) + pad, body: `${out.join("")}${cards.join("")}${sessionDisc(P, v, sx, sy, sr, o.sel)}` };
};
