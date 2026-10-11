/* W3 · The line map. The session is the trunk; a run is a line that leaves at one station and comes back at
   another. A station is a moment and stations are evenly spaced, so the map shows order and not duration, and it is
   folded into rows like the strip map over a train's doors. A background run comes back to the trunk, where its
   notice is queued for the session; a foreground run comes back to the line that called it, which waits meanwhile.
   What was seen is above the trunk. What was said has the side under it. */
DRAW.lines = (P, v, W, o) => {
  const pad = 14;
  const key = `lines ${W} ${o.said}`;
  let L = P.cache.get(key);
  if (!L) {
    const stations = P.moments.filter((m) => ["start", "resume", "stop", "fail"].includes(m.kind) || (o.said && m.kind === "said"));
    const n = stations.length;
    const one = n * 22 <= W - pad * 2;
    const dx = one ? Math.min(40, (W - pad * 2) / n) : W < 500 ? 13.2 : 16;
    const cols = one ? n : Math.floor((W - pad * 2) / dx);
    const col = new Map(stations.map((m, c) => [m.i, c]));
    // A track for every run: the lowest that is free, and above its parent's when its parent is out.
    const tracks = new Map();
    const busy = [];
    let most = 1;
    stations.forEach((m, c) => {
      if (m.kind === "start" || m.kind === "resume") {
        const parent = P.byId.get(m.id).parent;
        const under = parent ? [...tracks.values()].find((r) => r.id === parent && r.c0 <= c && r.c1 === undefined)?.track ?? 0 : 0;
        let k = under + 1;
        while (busy[k] !== undefined && busy[k] >= c) k++;
        busy[k] = Infinity;
        tracks.set(`${m.id}/${m.run}`, { id: m.id, run: m.run, track: k, c0: c, under });
        most = Math.max(most, k);
      } else if (m.kind !== "said") {
        const r = tracks.get(`${m.id}/${m.run}`);
        r.c1 = c;
        r.failed = m.kind === "fail";
        busy[r.track] = c;
      }
    });
    const tk = one ? 14 : 11;
    const rowH = 12 + most * tk + 30;
    L = { stations, cols, dx, col, tracks: [...tracks.values()], most, tk, rowH, rows: Math.ceil(n / cols) };
    P.cache.set(key, L);
  }
  const { stations, cols, dx, col, tk, rowH } = L;
  const X = (c) => pad + ((c % cols) + 0.5) * dx;
  const row = (c) => Math.floor(c / cols);
  const trunkY = (r) => pad + r * rowH + 12 + L.most * tk;
  const Y = (c, track) => trunkY(row(c)) - track * tk;
  // Where the clock is: the last station at or before this moment.
  const now = Math.max(-1, ...stations.filter((m) => m.i <= v.i).map((m) => col.get(m.i)));
  const out = [];
  const marks = [];
  const names = [];

  // The trunk, a row at a time, as far as the clock; a break and a word where a night or more went by.
  for (let r = 0; r <= row(Math.max(now, 0)); r++) {
    if (now < 0) break;
    const first = r * cols;
    const last = Math.min(now, first + cols - 1);
    const y = trunkY(r);
    out.push(line(X(first) - (r > 0 ? dx / 2 : 0), y, X(last) + (last === first + cols - 1 && now > last ? dx / 2 : 0), y, { class: "s-ink", "stroke-width": 4.5, "stroke-linecap": "round", "data-id": "session" }));
    if (r > 0) out.push(path(`M${pad - 8} ${y - 4}l4 4l-4 4`, { class: "f-none s-ink", "stroke-width": 1.6, "stroke-linecap": "round" }));
    if (last === first + cols - 1 && now > last) out.push(path(`M${r1(X(last) + dx / 2 + 3)} ${y - 4}l4 4l-4 4`, { class: "f-none s-ink", "stroke-width": 1.6, "stroke-linecap": "round" }));
  }
  for (let c = 1; c <= now; c++) {
    const gap = stations[c].t - stations[c - 1].t;
    if (gap < 3 * 3600000) continue;
    const y = trunkY(row(c));
    const x = c % cols === 0 ? X(c) - dx / 2 : (X(c - 1) + X(c)) / 2;
    marks.push(tag("rect", { x: r1(x - 2.2), y: y - 4, width: 4.4, height: 8, class: "f-ground" }));
    marks.push(line(x - 3.6, y + 4.5, x - 0.6, y - 4.5, { class: "s-ink", "stroke-width": 1.3 }), line(x + 0.6, y + 4.5, x + 3.6, y - 4.5, { class: "s-ink", "stroke-width": 1.3 }));
    names.push(text(x, y + 13, short(gap), { size: 7.5, anchor: "middle", class: "t3 mono lift" }));
  }

  for (const r of L.tracks) {
    if (r.c0 > now) continue;
    const s = v.of.get(r.id);
    const a = s.a;
    const running = r.c1 === undefined || r.c1 > now;
    const end = running ? now : r.c1;
    const fore = a.shape === "foreground";
    const bend = dx * 0.5;
    // Leave from the trunk, or from the line that started it; come back to the trunk, or to the line that waited.
    const d = [`M${r1(X(r.c0))} ${r1(Y(r.c0, r.under))}Q${r1(X(r.c0))} ${r1(Y(r.c0, r.track))} ${r1(X(r.c0) + bend)} ${r1(Y(r.c0, r.track))}`];
    for (let k = row(r.c0); k <= row(end); k++) {
      const rowEnd = k * cols + cols - 1;
      const from = k === row(r.c0) ? X(r.c0) + bend : pad;
      const y = trunkY(k) - r.track * tk;
      if (k > row(r.c0)) d.push(`M${pad} ${r1(y)}`);
      if (k < row(end)) d.push(`H${r1(X(rowEnd) + dx / 2)}`);
      else if (running) d.push(`H${r1(Math.max(from, X(end)))}`);
      else d.push(`H${r1(Math.max(from, X(end) - bend))}Q${r1(X(end))} ${r1(y)} ${r1(X(end))} ${r1(Y(end, fore ? r.under : 0))}`);
    }
    const g = [];
    if (o.sel === a.id) g.push(path(d.join(""), { class: "f-none s-ink", "stroke-width": 8, opacity: 0.22, "stroke-linecap": "round" }));
    g.push(path(d.join(""), { class: "f-none s-m", "stroke-width": running ? 3.6 : 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    // The line that waits for a foreground child is drawn hollow for as long.
    if (fore && r.under > 0) {
      const y = Y(r.c0, r.under);
      const parent = P.byId.get(a.parent);
      if (row(r.c0) === row(end)) g.push(line(X(r.c0) + 3, y, X(end) - (running ? 0 : 3), y, { class: "s-ground", "stroke-width": 1.5, "data-of": parent.id }));
    }
    if (!s.known && r.run === 0) {
      g.push(path(`M${r1(X(r.c0))} ${r1(Y(r.c0, r.under))}Q${r1(X(r.c0))} ${r1(Y(r.c0, r.track))} ${r1(X(r.c0) + bend)} ${r1(Y(r.c0, r.track))}`, { class: "f-none s-ground", "stroke-width": 4.2 }));
      g.push(path(`M${r1(X(r.c0))} ${r1(Y(r.c0, r.under))}Q${r1(X(r.c0))} ${r1(Y(r.c0, r.track))} ${r1(X(r.c0) + bend)} ${r1(Y(r.c0, r.track))}`, { class: "tie unknown" }));
      names.push(text(X(r.c0) - 7, Y(r.c0, r.track) + 3, "?", { size: 10, weight: 700, class: "t3 lift" }));
    }
    if (running) g.push(tag("circle", { cx: r1(X(end)), cy: r1(Y(end, r.track)), r: 7.5, class: "halo" }), tag("circle", { cx: r1(X(end)), cy: r1(Y(end, r.track)), r: 4.6, class: "f-m" }));
    out.push(`<g data-id="${a.id}" class="m-${a.m.key}">${g.join("")}</g>`);
    // Stations: where it left, and where it came back.
    marks.push(tag("circle", { cx: r1(X(r.c0)), cy: r1(Y(r.c0, r.under)), r: 3, class: "f-surface s-ink", "stroke-width": 1.5 }));
    if (s.unsaid && r.run === 0) marks.push(diamond(X(r.c0), Y(r.c0, r.under) + 9, 4));
    if (!running) {
      const ey = Y(end, fore ? r.under : 0);
      marks.push(r.failed ? cross(X(end), ey, 4.5) : tag("circle", { cx: r1(X(end)), cy: r1(ey), r: 3, class: "f-surface s-ink", "stroke-width": 1.5 }));
    }
    const label = `${a.id}${r.run > 0 ? `·${r.run + 1}` : ""}`;
    const lx = X(r.c0) + bend + 1;
    if (lx + label.length * 4.9 < W - 2) names.push(text(lx, Y(r.c0, r.track) - 3.5, label, { size: 8, weight: 600, class: `mono t-m lift m-${a.m.key}` }));
  }

  // What was said, under the trunk: a flag where it was said, and a stub that ends in nothing for what never ran.
  for (const p of v.said) {
    const c = col.get(P.moments.find((m) => m.kind === "said" && m.plan === p.k).i);
    if (c === undefined || c > now) continue;
    const x = X(c);
    const y = trunkY(row(c));
    marks.push(path(`M${r1(x)} ${y + 2}v18`, { class: "s-said", "stroke-width": 1.5 }), tag("circle", { cx: r1(x), cy: y, r: 3.4, class: "f-said s-said", "stroke-width": 1.5 }));
    names.push(text(x - 3, y + 23, "said", { size: 8, weight: 600, anchor: "end", class: "t-said lift" }));
    p.never.forEach((g, k) => {
      const x2 = x + 20 + k * 12;
      marks.push(`<g data-id="${g.id}">${path(`M${r1(x)} ${y + 20}H${r1(x2 - 4)}`, { class: "said" })}${tag("circle", { cx: r1(x2), cy: y + 20, r: 4, class: "said f-said" })}${o.sel === g.id ? tag("circle", { cx: r1(x2), cy: y + 20, r: 7, class: "sel" }) : ""}</g>`);
    });
  }
  // The clock: a ring on the trunk at the station it is at.
  if (now >= 0) marks.push(tag("circle", { cx: r1(X(now)), cy: trunkY(row(now)), r: 6.5, class: "f-none s-accent", "stroke-width": 2.2 }));
  else names.push(text(pad, trunkY(0) + 4, "The session has begun. Nothing has left it yet.", { size: 10.5, class: "t3" }));
  // The map is as long as the session has gone.
  return { h: pad + (row(Math.max(now, 0)) + 1) * rowH + 2, body: `${out.join("")}${marks.join("")}${names.join("")}` };
};
