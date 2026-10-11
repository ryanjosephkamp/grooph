/* W2 · Lanes over time. Time runs left to right and a run is a bar as long as it took. A session of days is mostly
   waiting, so the strip on top is the whole session, a block a burst, and under it the burst the clock is in is
   opened to the full width. A run takes the highest lane that is free; a subagent's own subagent, one under it.
   A bar that is running is solid in its model's color; one that has finished is a tint of it. */
DRAW.lanes = (P, v, W, o) => {
  const pad = 14;
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
    out.push(text(pad, y + 8, `Whole session · ${P.bursts.length} bursts of work`, { size: 9.5, weight: 600, class: "t2" }));
    if (W >= 340) out.push(text(W - pad, y + 8, "a tick where a day has gone by", { size: 9, anchor: "end", class: "t3" }));
    const base = y + 50;
    out.push(rule(pad, base + 0.5, W - pad, base + 0.5, { class: "s-hair", "stroke-width": 1 }));
    let day = 0;
    P.bursts.forEach((burst, k) => {
      const x = pad + k * bw;
      const d = Math.floor(burst.from / 86400000);
      if (d !== day) {
        day = d;
        out.push(rule(x, base - 30, x, base + 4, { class: "s-hair", "stroke-width": 1 }));
        out.push(text(x + 3, base - 24, `${d}d`, { size: 8.5, class: "t3 mono" }));
      }
      const h = Math.round(4 + (burst.most / P.most) * 18);
      const past = burst !== b && burst.runs.every((r) => begun(v, r) && !live(v, r));
      const here = burst === b;
      out.push(tag("rect", { x: r1(x + 1), y: base - h, width: r1(Math.max(2, bw - 2)), height: h, rx: 1.5, class: here ? "f-accent" : past ? "f-ink" : "f-line", opacity: here ? 1 : past ? 0.42 : 0.7 }));
      if (here) out.push(path(`M${r1(x + bw / 2 - 3.5)} ${base + 9}h7l-3.5 -5z`, { class: "f-accent" }));
      // Touch a burst to go to its first moment.
      out.push(tag("rect", { x: r1(x), y: base - 30, width: r1(bw), height: 40, class: "hit", "data-go": P.moments.find((m) => m.t >= burst.from && (m.kind === "start" || m.kind === "resume")).i }));
    });
    y = base + 24;
  }

  // The open burst.
  const span = Math.max(b.to - b.from, 1000);
  const lead = Math.min(span * 0.06, b.from);
  const t0 = b.from - lead;
  const t1 = b.to + span * 0.03;
  const x = (at) => pad + ((clamp(at, t0, t1) - t0) / (t1 - t0)) * (W - pad * 2);
  out.push(text(pad, y + 9, many ? `burst ${b.k + 1} of ${P.bursts.length} · begins ${dur(b.from)} in · ${dur(span)} long` : `the whole session · ${dur(P.moments.at(-1).t)}`, { size: 10.5, weight: 600 }));
  y += 26;
  // The session's own lane: a hairline, thick where the hook timed a turn of its own.
  const sy = Math.round(y + 6);
  const top = sy + 16;
  const bh = 18;
  const pitch = 25;
  const laneY = (k) => top + k * pitch;
  const bottom = laneY(lanes.tallest + (o.said && P.plans.some((p) => p.never.length) ? 1 : 0)) + 1;
  // A few marks of time, as hairlines the bars lie on.
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200].map((s) => s * 1000);
  const step = steps.find((s) => span / s <= (W < 500 ? 4.5 : 8)) ?? 14400000;
  for (let m = 0; m <= span; m += step) {
    const mx = x(b.from + m);
    out.push(rule(mx, sy, mx, bottom, { class: "s-rule", "stroke-width": 1 }));
    out.push(text(mx + (m === 0 ? 0 : 0), bottom + 12, m === 0 ? "0" : `+${short(m)}`, { size: 8.5, anchor: m === 0 ? "start" : "middle", class: "t3 mono" }));
  }
  out.push(rule(pad, sy, W - pad, sy, { class: "s-line", "stroke-width": 1, "data-id": "session" }));
  for (const [a, z] of P.sample.turns) if (z > t0 && a < Math.min(t, t1)) out.push(line(x(a), sn(sy), Math.max(x(a) + 1.5, x(Math.min(z, t))), sn(sy), { class: "s-ink", "stroke-width": 3, "stroke-linecap": "round", "data-id": "session" }));
  out.push(text(W - pad, sy - 7, `session · ${P.lead.short}`, { size: 9, anchor: "end", class: "t3" }));
  const defs = `<defs><pattern id="sw-wait" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" class="f-card"/><line x1="0.5" y1="0" x2="0.5" y2="4" class="s-ink" stroke-width="1" opacity="0.45"/></pattern></defs>`;

  const bars = [];
  const ties = [];
  const prev = new Map();
  // Where every bar of this burst lies, so that a name set beside a short bar is not set over the next one.
  const span2 = (r) => [Math.round(x(r.from)), Math.max(Math.round(x(r.from)) + 4, Math.round(x(live(v, r) ? t : r.to)))];
  const drawn = b.runs.filter((r) => begun(v, r)).map((r) => ({ r, lane: lanes.get(`${r.id}/${r.k}`), at: span2(r) }));
  const clear = (r, lane, from, to) => !drawn.some((d) => d.r !== r && d.lane === lane && d.at[0] < to && d.at[1] > from);
  for (const r of b.runs) {
    if (!begun(v, r)) continue;
    const s = v.of.get(r.id);
    const a = s.a;
    const k = lanes.get(`${r.id}/${r.k}`);
    const running = live(v, r);
    const x1 = Math.round(x(r.from));
    const x2 = Math.max(x1 + 4, Math.round(x(running ? t : r.to)));
    const by = laneY(k);
    const fresh = v.mo.id === r.id && v.mo.run === r.k;
    // The tie from whoever started it: from the session's lane, or from its parent's bar.
    const from = a.parent ? laneY(lanes.get(`${a.parent}/${P.byId.get(a.parent).runs.findIndex((q) => q.from <= r.from && r.from <= q.to)}`) ?? 0) + bh : sy;
    if (r.k === 0) {
      ties.push(rule(x1, from, x1, by, { class: `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"}` }));
      ties.push(tag("circle", { cx: sn(x1), cy: r1(from + 0.5), r: 1.75, class: "f-ink" }));
      if (!s.known) ties.push(text(x1 + 4, by - 3, "?", { size: 9.5, weight: 700, class: "t3" }));
    } else if (prev.has(r.id) && prev.get(r.id).k === k) ties.push(line(prev.get(r.id).x2 + 3, sn(by + bh / 2), x1 - 3, sn(by + bh / 2), { class: "s-mh", "stroke-width": 1, "stroke-dasharray": "1 3", "stroke-linecap": "round" }));
    prev.set(r.id, { k, x2 });
    const g = [];
    const failed = r.end === "failed" && !running;
    g.push(tag("rect", { x: sn(x1), y: sn(by), width: x2 - x1, height: bh, rx: 4, class: running ? "f-m s-m" : failed ? "f-mt s-bad" : "f-mt s-mh", "stroke-width": 1 }));
    // A short bar is touched through a wider place.
    if (x2 - x1 < 24) g.push(tag("rect", { x: x1 - 4, y: by - 2, width: Math.max(24, x2 - x1 + 8), height: bh + 4, class: "hit" }));
    if (running) g.push(tag("circle", { cx: r1(x2 + 0.5), cy: r1(by + bh / 2 + 0.5), r: 3, class: "halo" }));
    // A foreground child holds its parent still: hatched for as long as the child ran.
    for (const kid of a.kids.map((id) => P.byId.get(id)).filter((c) => c.shape === "foreground" && begun(v, { id: c.id, k: 0 }) && c.runs[0].from >= r.from && c.runs[0].from <= r.to)) {
      const h1 = x(kid.runs[0].from);
      const h2 = x(live(v, { id: kid.id, k: 0 }) ? t : kid.runs[0].to);
      if (h2 - h1 > 2) g.push(tag("rect", { x: r1(h1), y: by + 2, width: r1(h2 - h1), height: bh - 3, fill: "url(#sw-wait)" }));
    }
    const name = `${a.id}${r.k > 0 ? `·${r.k + 1}` : ""}`;
    const wName = name.length * 5.6 + 12;
    const wFull = wName + a.m.short.length * 5 + 4;
    const waits = a.kids.some((id) => P.byId.get(id).shape === "foreground" && begun(v, { id, k: 0 }));
    const ty = by + 13;
    const inside = running ? "t-on" : "";
    if (x2 - x1 >= wFull && !waits) g.push(text(x1 + 7, ty, name, { size: 9.5, weight: 600, class: `mono ${inside}` }), text(x1 + wName, ty, a.m.short, { size: 9, class: running ? "t-on" : "t2" }));
    else if (x2 - x1 >= wName && !waits) g.push(text(x1 + 7, ty, name, { size: 9.5, weight: 600, class: `mono ${inside}` }));
    else if (x2 + wFull + 4 < W - pad && clear(r, k, x2 + 2, x2 + wFull + 6)) g.push(text(x2 + 7, ty, name, { size: 9.5, weight: 600, class: "mono" }), text(x2 + wName, ty, a.m.short, { size: 9, class: "t2" }));
    else if (x2 + wName + 2 < W - pad && clear(r, k, x2 + 2, x2 + wName + 2)) g.push(text(x2 + 7, ty, name, { size: 9.5, weight: 600, class: "mono" }));
    else if (x1 - wName > pad && clear(r, k, x1 - wName, x1 - 2)) g.push(text(x1 - 6, ty, name, { size: 9.5, weight: 600, anchor: "end", class: "mono" }));
    if (failed) g.push(cross(x2 + 0.5, by + bh / 2 + 0.5, 3.5));
    if (s.unsaid && r.k === 0) g.push(diamond(x1 + 0.5, by + 0.5, 4));
    if (o.sel === a.id) g.push(tag("rect", { x: sn(x1 - 3), y: sn(by - 3), width: x2 - x1 + 6, height: bh + 6, rx: 6, class: "sel" }));
    bars.push(`<g data-id="${a.id}" class="m-${a.m.key}"><g${fresh && running ? ' class="fresh"' : ""}>${g.join("")}</g></g>`);
  }
  // What was said: a flag on the session's lane where it was said, and a dashed bar for what was said and never seen.
  let spare = lanes.tallest;
  for (const p of v.said) {
    if (burstAt(P, P.byId.get(p.before).runs[0].from) !== b) continue;
    const fx = Math.round(x(p.at));
    ties.push(path(`M${sn(fx)} ${sy}v-11.5h8l-2.5 3l2.5 3h-8`, { class: "s-said f-said", "stroke-width": 1, "stroke-linejoin": "round" }));
    ties.push(text(fx + 11, sy - 5, "said", { size: 8.5, weight: 600, class: "t-said" }));
    for (const g of p.never) {
      const by = laneY(spare++);
      bars.push(`<g data-id="${g.id}"${g.fresh ? ' class="fresh"' : ""}>${tag("rect", { x: sn(fx), y: sn(by), width: 112, height: bh, rx: 4, class: "said f-said" })}${text(fx + 7, by + 13, "said, never seen", { size: 9.5, weight: 600, class: "t-said" })}${o.sel === g.id ? tag("rect", { x: sn(fx - 3), y: sn(by - 3), width: 118, height: bh + 6, rx: 6, class: "sel" }) : ""}</g>`);
    }
  }
  // The clock: a hairline in the accent, and how far into the burst it is.
  const nx = x(t);
  const into = t >= b.from ? `+${short(t - b.from)}` : "";
  const cw = into.length * 5.2 + 8;
  const cx = clamp(nx, pad + cw / 2, W - pad - cw / 2);
  const clock = t >= t0 && t <= t1 ? `${rule(nx, sy - 5, nx, bottom, { class: "s-live", "stroke-width": 1 })}${into ? `${tag("rect", { x: r1(cx - cw / 2), y: sy - 19, width: r1(cw), height: 13, rx: 3, class: "f-live" })}${text(cx, sy - 9.5, into, { size: 8.5, anchor: "middle", weight: 600, class: "mono t-clock" })}` : ""}` : "";
  return { h: bottom + 22, body: `${defs}${out.join("")}${ties.join("")}${bars.join("")}${clock}` };
};
