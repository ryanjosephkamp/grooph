/* W3 · The line map. The session is the trunk; a run is a line that leaves at one station and comes back at
   another. A station is a moment and stations are evenly spaced, so the map shows order and not duration, and it is
   folded into rows like the strip map over a train's doors. A background run comes back to the trunk, where its
   notice is queued for the session; a foreground run comes back to the line that called it, which waits meanwhile.
   What was seen is above the trunk. What was said has the side under it. */
DRAW.lines = (P, v, W, o) => {
  const pad = 16;
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
    // A row is as tall as the highest track that crosses it.
    const rows = Math.ceil(n / cols);
    const high = Array.from({ length: rows }, () => 1);
    for (const r of tracks.values()) for (let k = Math.floor(r.c0 / cols); k <= Math.floor((r.c1 ?? n - 1) / cols); k++) high[k] = Math.max(high[k], r.track);
    const tops = [];
    let y = pad;
    for (const h of high) {
      tops.push(y);
      y += 12 + h * tk + 30;
    }
    tops.push(y);
    L = { stations, cols, dx, col, tracks: [...tracks.values()], high, tops, tk, rows };
    P.cache.set(key, L);
  }
  const { stations, cols, dx, col, tk } = L;
  const X = (c) => pad + ((c % cols) + 0.5) * dx;
  const row = (c) => Math.floor(c / cols);
  const trunkY = (r) => L.tops[r] + 12 + L.high[r] * tk;
  const Y = (c, track) => trunkY(row(c)) - track * tk;
  // Where the clock is: the last station at or before this moment.
  const now = Math.max(-1, ...stations.filter((m) => m.i <= v.i).map((m) => col.get(m.i)));
  const out = [];
  const trunkLines = [];
  const marks = [];
  const names = [];

  // The trunk, a row at a time, as far as the clock; a break and a word where a night or more went by.
  for (let r = 0; r <= row(Math.max(now, 0)); r++) {
    if (now < 0) break;
    const first = r * cols;
    const last = Math.min(now, first + cols - 1);
    const y = trunkY(r);
    trunkLines.push(line(X(first) - (r > 0 ? dx / 2 : 0), y, X(last) + (last === first + cols - 1 && now > last ? dx / 2 : 0), y, { class: "s-ink", "stroke-width": 3, "stroke-linecap": "round", "data-id": "session" }));
    if (r > 0) trunkLines.push(path(`M${pad - 9} ${y - 3.5}l3.5 3.5l-3.5 3.5`, { class: "f-none s-ink", "stroke-width": 1, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    if (last === first + cols - 1 && now > last) trunkLines.push(path(`M${r1(X(last) + dx / 2 + 3.5)} ${y - 3.5}l3.5 3.5l-3.5 3.5`, { class: "f-none s-ink", "stroke-width": 1, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  }
  for (let c = 1; c <= now; c++) {
    const gap = stations[c].t - stations[c - 1].t;
    if (gap < 3 * 3600000) continue;
    const y = trunkY(row(c));
    const x = c % cols === 0 ? X(c) - dx / 2 : (X(c - 1) + X(c)) / 2;
    marks.push(tag("rect", { x: r1(x - 1.75), y: y - 3, width: 3.5, height: 6, class: "f-ground" }));
    marks.push(line(x - 3, y + 4, x - 0.5, y - 4, { class: "s-ink", "stroke-width": 1 }), line(x + 0.5, y + 4, x + 3, y - 4, { class: "s-ink", "stroke-width": 1 }));
    names.push(text(x, y + 14, short(gap), { size: 8, anchor: "middle", class: "t3 mono lift" }));
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
    // Each line is laid over a wider one in the paper's color, so a crossing reads as over and under.
    g.push(path(d.join(""), { class: "f-none s-ground", "stroke-width": 3.6 }));
    if (o.sel === a.id) g.push(path(d.join(""), { class: "f-none s-ink", "stroke-width": 6, opacity: 0.2, "stroke-linecap": "round" }));
    g.push(path(d.join(""), { class: "f-none s-m", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    g.push(path(d.join(""), { fill: "none", stroke: "transparent", "stroke-width": 11, "pointer-events": "stroke" }));
    // The line that waits for a foreground child is drawn hollow for as long.
    if (fore && r.under > 0) {
      const y = Y(r.c0, r.under);
      const parent = P.byId.get(a.parent);
      if (row(r.c0) === row(end)) g.push(line(X(r.c0) + 3, y, X(end) - (running ? 0 : 3), y, { class: "s-ground", "stroke-width": 1, "stroke-dasharray": "2 2", "data-of": parent.id }));
    }
    if (!s.known && r.run === 0) {
      g.push(path(`M${r1(X(r.c0))} ${r1(Y(r.c0, r.under))}Q${r1(X(r.c0))} ${r1(Y(r.c0, r.track))} ${r1(X(r.c0) + bend)} ${r1(Y(r.c0, r.track))}`, { class: "f-none s-ground", "stroke-width": 3 }));
      g.push(path(`M${r1(X(r.c0))} ${r1(Y(r.c0, r.under))}Q${r1(X(r.c0))} ${r1(Y(r.c0, r.track))} ${r1(X(r.c0) + bend)} ${r1(Y(r.c0, r.track))}`, { class: "tie unknown" }));
      names.push(text(X(r.c0) - 7, Y(r.c0, r.track) + 3, "?", { size: 9.5, weight: 700, class: "t3 lift" }));
    }
    if (running) g.push(tag("circle", { cx: r1(X(end)), cy: r1(Y(end, r.track)), r: 3.5, class: "halo" }), tag("circle", { cx: r1(X(end)), cy: r1(Y(end, r.track)), r: 3.5, class: "f-m s-ground", "stroke-width": 1 }));
    out.push(`<g data-id="${a.id}" class="m-${a.m.key}">${g.join("")}</g>`);
    // Stations: where it left, and where it came back.
    marks.push(tag("circle", { cx: r1(X(r.c0)), cy: r1(Y(r.c0, r.under)), r: 2.5, class: "f-card s-ink", "stroke-width": 1, "data-id": a.id }));
    if (s.unsaid && r.run === 0) marks.push(diamond(X(r.c0), Y(r.c0, r.under) + 8.5, 3.5));
    if (!running) {
      const ey = Y(end, fore ? r.under : 0);
      marks.push(r.failed ? cross(X(end), ey, 3.5) : tag("circle", { cx: r1(X(end)), cy: r1(ey), r: 2.5, class: "f-card s-ink", "stroke-width": 1, "data-id": a.id }));
    }
    const label = `${a.id}${r.run > 0 ? `·${r.run + 1}` : ""}`;
    const lx = X(r.c0) + bend + 1;
    if (lx + label.length * 4.9 < W - 2) names.push(text(lx, Y(r.c0, r.track) - 3.5, label, { size: 8, weight: running ? 700 : 500, class: `mono lift${running ? "" : " t2"}`, id: a.id }));
  }

  // What was said, under the trunk: a flag where it was said, and a stub that ends in nothing for what never ran.
  for (const p of v.said) {
    const c = col.get(P.moments.find((m) => m.kind === "said" && m.plan === p.k).i);
    if (c === undefined || c > now) continue;
    const x = X(c);
    const y = trunkY(row(c));
    marks.push(path(`M${r1(x)} ${y + 2}v18`, { class: "s-said f-none", "stroke-width": 1 }), tag("circle", { cx: r1(x), cy: y, r: 2.5, class: "f-said s-said", "stroke-width": 1 }));
    const flip = x + 32 > W - pad;
    names.push(text(x + (flip ? 4 : -3), y + 31 - (flip ? 0 : 8), "said", { size: 8.5, weight: 600, anchor: flip ? "start" : "end", class: "t-said lift" }));
    p.never.forEach((g, k) => {
      // The stub runs on to the right, or back to the left where the row ends.
      const way = x + 32 + k * 12 > W - pad ? -1 : 1;
      const x2 = x + way * (20 + k * 12);
      marks.push(`<g data-id="${g.id}">${path(`M${r1(x)} ${y + 20}H${r1(x2 - way * 4)}`, { class: "said f-none" })}${tag("circle", { cx: r1(x2), cy: y + 20, r: 3.5, class: "said f-said" })}${tag("circle", { cx: r1(x2), cy: y + 20, r: 10, class: "hit" })}${o.sel === g.id ? tag("circle", { cx: r1(x2), cy: y + 20, r: 7, class: "sel" }) : ""}</g>`);
    });
  }
  // The clock: a ring on the trunk at the station it is at.
  if (now >= 0) marks.push(tag("circle", { cx: r1(X(now)), cy: trunkY(row(now)), r: 6, class: "f-none s-live", "stroke-width": 1.5 }));
  else names.push(text(pad, trunkY(0) + 4, "The session has begun. Nothing has left it yet.", { size: 10.5, class: "t3" }));
  // The map is as long as the session has gone.
  return { h: L.tops[row(Math.max(now, 0)) + 1] + 2, body: `${trunkLines.join("")}${out.join("")}${marks.join("")}${names.join("")}` };
};
