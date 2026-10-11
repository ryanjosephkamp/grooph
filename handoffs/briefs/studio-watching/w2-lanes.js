/* W2 · Lanes over time. Time runs left to right and a run is a bar as long as it took. A session of days is mostly
   waiting, so the strip on top is the whole session, a block a burst, and under it the burst the clock is in is
   opened to the full width. A run takes the highest lane that is free; a subagent's own subagent, one under it. */
DRAW.lanes = (P, v, W, o) => {
  const pad = 12;
  const many = P.bursts.length > 1;
  const b = v.burst;
  const t = v.t;
  const out = [];

  // Lanes for every burst, once: the height is the tallest burst's, so the page does not jump as the clock moves.
  let lanes = P.cache.get("lanes");
  if (!lanes) {
    lanes = new Map();
    let tallest = 1;
    for (const burst of P.bursts) {
      // An agent keeps one lane for the whole of a burst, from its first run in it to its last: a resume comes back
      // to the lane it left.
      const ends = [];
      const last = new Map();
      for (const r of burst.runs) {
        if (!last.has(r.id)) {
          const parent = P.byId.get(r.id).parent;
          const until = Math.max(...burst.runs.filter((q) => q.id === r.id).map((q) => q.to));
          let k = parent && last.has(parent) ? last.get(parent) + 1 : 0;
          while ((ends[k] ?? -1) > r.from) k++;
          ends[k] = until;
          last.set(r.id, k);
        }
        lanes.set(`${r.id}/${r.k}`, last.get(r.id));
      }
      tallest = Math.max(tallest, ends.length);
    }
    lanes.tallest = tallest;
    P.cache.set("lanes", lanes);
  }

  let y = pad;
  if (many) {
    // The whole session: one block a burst, as tall as the most that ran at once in it. A tick where a new day begins.
    const bw = (W - pad * 2) / P.bursts.length;
    out.push(text(pad, y + 8, `the whole session · ${P.bursts.length} bursts of work${W < 340 ? "" : " · a mark where a day has gone by"}`, { size: 9.5, class: "t3" }));
    const base = y + 54;
    let day = 0;
    P.bursts.forEach((burst, k) => {
      const x = pad + k * bw;
      const d = Math.floor(burst.from / 86400000);
      if (d !== day) {
        day = d;
        out.push(line(x - 0.5, base - 38, x - 0.5, base + 3, { class: "s-line", "stroke-width": 1 }));
        out.push(text(x + 2.5, base - 31, `${d}d`, { size: 8, class: "t3 mono" }));
      }
      const h = 5 + (burst.most / P.most) * 22;
      const past = burst !== b && burst.runs.every((r) => begun(v, r) && !live(v, r));
      const here = burst === b;
      out.push(tag("rect", { x: r1(x + 1), y: r1(base - h), width: r1(Math.max(2, bw - 2)), height: r1(h), rx: 1.5, class: here ? "f-accent" : past ? "f-ink" : "f-none s-line", opacity: here ? 1 : past ? 0.5 : 1, "stroke-width": 1 }));
      if (here) out.push(path(`M${r1(x + bw / 2 - 4)} ${base + 5}h8l-4 5z`, { class: "f-accent" }));
      // Touch a burst to go to its first moment.
      out.push(tag("rect", { x: r1(x), y: base - 30, width: r1(bw), height: 36, class: "hit", "data-go": P.moments.find((m) => m.t >= burst.from && (m.kind === "start" || m.kind === "resume")).i }));
    });
    y = base + 20;
  }

  // The open burst.
  const span = Math.max(b.to - b.from, 1000);
  const lead = Math.min(span * 0.06, b.from);
  const t0 = b.from - lead;
  const t1 = b.to + span * 0.03;
  const x = (at) => pad + 2 + ((clamp(at, t0, t1) - t0) / (t1 - t0)) * (W - pad * 2 - 4);
  out.push(text(pad, y + 9, many ? `burst ${b.k + 1} of ${P.bursts.length} · begins ${dur(b.from)} in · ${dur(span)} long` : `the whole session · ${dur(P.moments.at(-1).t)}`, { size: 10.5, class: "t2", weight: 600 }));
  y += 20;
  // The session's own lane: a thin line, thick where it was in a turn of its own.
  const sy = y + 6;
  out.push(line(pad, sy, W - pad, sy, { class: "s-line", "stroke-width": 2, "data-id": "session" }));
  for (const [a, z] of P.sample.turns) if (z > t0 && a < Math.min(t, t1)) out.push(line(x(a), sy, Math.max(x(a) + 1.5, x(Math.min(z, t))), sy, { class: "s-ink", "stroke-width": 5, "stroke-linecap": "round", "data-id": "session" }));
  out.push(text(W - pad, sy - 7, `session · ${P.lead.short}`, { size: 9, anchor: "end", class: "t3" }));
  const top = sy + 14;
  const laneY = (k) => top + k * 29;
  const bh = 22;
  const defs = `<defs><pattern id="sw-wait" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="f-surface"/><line x1="0" y1="0" x2="0" y2="5" class="s-ink" stroke-width="1.6" opacity="0.55"/></pattern></defs>`;

  const bars = [];
  const ties = [];
  const prev = new Map();
  for (const r of b.runs) {
    if (!begun(v, r)) continue;
    const s = v.of.get(r.id);
    const a = s.a;
    const k = lanes.get(`${r.id}/${r.k}`);
    const running = live(v, r);
    const x1 = x(r.from);
    const x2 = Math.max(x1 + 4, x(running ? t : r.to));
    const by = laneY(k);
    const fresh = v.mo.id === r.id && v.mo.run === r.k;
    // The tie from whoever started it: from the session's lane, or from its parent's bar.
    const from = a.parent ? laneY(lanes.get(`${a.parent}/${P.byId.get(a.parent).runs.findIndex((q) => q.from <= r.from && r.from <= q.to)}`) ?? 0) + bh : sy;
    if (r.k === 0) {
      ties.push(line(x1, from, x1, by, { class: `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"} m-${a.m.key}` }));
      if (!s.known) ties.push(text(x1 + 4, by - 2, "?", { size: 10, weight: 700, class: "t3" }));
    } else if (prev.has(r.id) && prev.get(r.id).k === k) ties.push(line(prev.get(r.id).x2 + 2, by + bh / 2, x1 - 2, by + bh / 2, { class: `s-m m-${a.m.key}`, "stroke-width": 1.4, "stroke-dasharray": "1.5 3", "stroke-linecap": "round" }));
    prev.set(r.id, { k, x2 });
    const g = [];
    if (running) g.push(tag("rect", { x: r1(x2 - 5), y: by - 3, width: 8, height: bh + 6, rx: 4, class: "halo" }));
    g.push(tag("rect", { x: r1(x1), y: by, width: r1(x2 - x1), height: bh, rx: 6, class: running ? "f-m s-m" : "f-surface s-m", "stroke-width": 1.8 }));
    // A foreground child holds its parent still: hatched for as long as the child ran.
    for (const kid of a.kids.map((id) => P.byId.get(id)).filter((c) => c.shape === "foreground" && begun(v, { id: c.id, k: 0 }) && c.runs[0].from >= r.from && c.runs[0].from <= r.to)) {
      const h1 = x(kid.runs[0].from);
      const h2 = x(live(v, { id: kid.id, k: 0 }) ? t : kid.runs[0].to);
      if (h2 - h1 > 2) g.push(tag("rect", { x: r1(h1), y: by + 1.5, width: r1(h2 - h1), height: bh - 3, fill: "url(#sw-wait)" }));
    }
    const name = `${a.id}${r.k > 0 ? `·${r.k + 1}` : ""}`;
    const full = `${name} ${a.m.short}`;
    const wFull = full.length * 5.7 + 10;
    const wName = name.length * 5.7 + 8;
    const waits = a.kids.some((id) => P.byId.get(id).shape === "foreground" && begun(v, { id, k: 0 }));
    if (x2 - x1 >= wFull && !waits) g.push(text(x1 + 6, by + 15, full, { size: 10, weight: 600, class: `mono ${running ? "t-on" : "t-m"}` }));
    else if (x2 - x1 >= wName && !waits) g.push(text(x1 + 5, by + 15, name, { size: 10, weight: 600, class: `mono ${running ? "t-on" : "t-m"}` }));
    else if (x2 + wFull < W - pad) g.push(text(x2 + 4, by + 15, full, { size: 10, weight: 600, class: "mono t-m" }));
    else g.push(text(x1 - 4, by + 15, name, { size: 10, weight: 600, anchor: "end", class: "mono t-m" }));
    if (r.end === "failed" && !running) g.push(cross(x2, by + bh / 2, 5));
    if (s.unsaid && r.k === 0) g.push(diamond(x1, by, 5));
    if (o.sel === a.id) g.push(tag("rect", { x: r1(x1 - 3), y: by - 3, width: r1(x2 - x1 + 6), height: bh + 6, rx: 8, class: "sel" }));
    bars.push(`<g data-id="${a.id}" class="m-${a.m.key}"><g${fresh && running ? ' class="fresh"' : ""}>${g.join("")}</g></g>`);
  }
  // What was said: a flag on the session's lane where it was said, and a dashed bar for what was said and never seen.
  let spare = lanes.tallest;
  for (const p of v.said) {
    if (burstAt(P, P.byId.get(p.before).runs[0].from) !== b) continue;
    const fx = x(p.at);
    ties.push(path(`M${r1(fx)} ${sy}v-12h9l-3 3.5l3 3.5h-9`, { class: "s-said f-said", "stroke-width": 1.5, "stroke-linejoin": "round" }));
    ties.push(text(fx + 12, sy - 4.5, "said", { size: 9, weight: 600, class: "t-said" }));
    for (const g of p.never) {
      const by = laneY(spare++);
      bars.push(`<g data-id="${g.id}">${tag("rect", { x: r1(fx), y: by, width: 132, height: bh, rx: 6, class: "said f-said" })}${text(fx + 7, by + 15, "said, never seen", { size: 10, weight: 600, class: "t-said" })}${o.sel === g.id ? tag("rect", { x: r1(fx - 3), y: by - 3, width: 138, height: bh + 6, rx: 8, class: "sel" }) : ""}</g>`);
    }
  }
  const bottom = laneY(lanes.tallest + (o.said && P.plans.some((p) => p.never.length) ? 1 : 0)) + 2;
  // The clock, and a few marks of time along the bottom.
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200].map((s) => s * 1000);
  const step = steps.find((s) => span / s <= (W < 500 ? 4.5 : 8)) ?? 14400000;
  for (let m = 0; m <= span; m += step) {
    const mx = x(b.from + m);
    out.push(line(mx, top - 4, mx, bottom, { class: "s-line", "stroke-width": 1, "stroke-dasharray": "2 4" }));
    out.push(text(mx, bottom + 12, m === 0 ? "0" : `+${short(m)}`, { size: 8.5, anchor: m === 0 ? "start" : "middle", class: "t3 mono" }));
  }
  const nx = x(t);
  const clock = t >= t0 && t <= t1 ? `${line(nx, sy - 4, nx, bottom, { class: "s-ink", "stroke-width": 1.4 })}${path(`M${r1(nx - 4)} ${sy - 9}h8l-4 6z`, { class: "f-ink" })}` : "";
  return { h: bottom + 22, body: `${defs}${out.join("")}${ties.join("")}${bars.join("")}${clock}` };
};
