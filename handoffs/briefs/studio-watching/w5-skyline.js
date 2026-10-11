/* W5 · The skyline. The app's columns and floors, fed by what was seen: every subagent is a column on the session's
   floor, as tall as the time it ran, one block a run. A column that is running is solid and lit on top; one that
   has finished is pale with its model's edges. A subagent's own subagent stands a step up beside it when it ran in
   the background, and on top of it when its parent waited for it. Drawn flat-on in two-to-one isometric: the app's
   stage turns under a finger, and this page's pencil does not. */
DRAW.skyline = (P, v, W, o) => {
  const pad = 12;
  const key = `sky ${o.said}`;
  let G = P.cache.get(key);
  if (!G) {
    const ghosts = o.said ? P.plans.flatMap((p) => p.never) : [];
    const rides = (a) => a.parent && a.shape === "foreground";
    const items = P.agents.filter((a) => !rides(a)).flatMap((a) => [a.id, ...ghosts.filter((g) => g.after === a.id).map((g) => g.id)]);
    G = { items, at: new Map(items.map((id, k) => [id, k])) };
    P.cache.set(key, G);
  }
  const n = G.items.length;
  const cols = n <= 3 ? n : n <= 16 ? Math.ceil(n / 2) : 8;
  // The scale is the whole session's, so nothing moves; the floor is laid a row at a time, as far as it is stood on.
  const allRows = Math.ceil(n / cols);
  const stood = Math.max(-1, ...v.all.map((s) => G.at.get(s.a.id) ?? -1), ...v.ghosts.map((g) => G.at.get(g.id)));
  const rows = Math.max(1, Math.floor(stood / cols) + 1);
  const hw = Math.min(40, (W - pad * 2) / (cols + allRows));
  const hh = hw / 2;
  const tall = W < 500 ? 92 : 124;
  const scale = tall / P.longest;
  const ox = pad + allRows * hw + (W - pad * 2 - (cols + allRows) * hw) / 2;
  const oy = pad + tall + 26;
  const iso = (gx, gy) => [ox + (gx - gy) * hw, oy + (gx + gy) * hh];
  const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
  const f = 0.6;

  const out = [];
  // The session's floor: a slab everything it started stands on.
  const corners = [iso(0, 0), iso(cols, 0), iso(cols, rows), iso(0, rows)];
  const slab = 7;
  out.push(tag("polygon", { points: pts([corners[3], corners[2], [corners[2][0], corners[2][1] + slab], [corners[3][0], corners[3][1] + slab]]), class: "slab-l" }));
  out.push(tag("polygon", { points: pts([corners[1], corners[2], [corners[2][0], corners[2][1] + slab], [corners[1][0], corners[1][1] + slab]]), class: "slab-r" }));
  out.push(tag("polygon", { points: pts(corners), class: `f-surface ${v.working && !v.ended ? "s-accent" : "s-ink"}`, "stroke-width": 1.6, "data-id": "session" }));
  for (let c = 1; c < cols; c++) out.push(line(...iso(c, 0), ...iso(c, rows), { class: "s-line", "stroke-width": 0.7, opacity: 0.6 }));
  for (let r = 1; r < rows; r++) out.push(line(...iso(0, r), ...iso(cols, r), { class: "s-line", "stroke-width": 0.7, opacity: 0.6 }));
  const fy = corners[2][1] + slab + 16;
  out.push(text(W / 2, fy, `the session's floor · ${P.lead.name} · ${v.ended ? "ended" : v.working ? "in a turn" : "between turns"}`, { size: 10.5, anchor: "middle", class: "t2" }));
  if (o.sel === "session") out.push(tag("polygon", { points: pts(corners), class: "sel" }));

  const cell = (id) => {
    const k = G.at.get(id);
    return iso((k % cols) + 0.5, Math.floor(k / cols) + 0.5);
  };
  /** One block: a prism from z0 up to z1 over a point on the floor, w wide (as a share of a tile). */
  const block = (cx, cy, z0, z1, w, kind) => {
    const a = hw * w;
    const b = hh * w;
    const top = [[cx, cy - b - z1], [cx + a, cy - z1], [cx, cy + b - z1], [cx - a, cy - z1]];
    return `${tag("polygon", { points: pts([[cx - a, cy - z1], [cx, cy + b - z1], [cx, cy + b - z0], [cx - a, cy - z0]]), class: `${kind}-l` })}${tag("polygon", { points: pts([[cx + a, cy - z1], [cx, cy + b - z1], [cx, cy + b - z0], [cx + a, cy - z0]]), class: `${kind}-r` })}${tag("polygon", { points: pts(top), class: `${kind}-t` })}`;
  };
  /** A column of blocks, one a run, from z up; returns its drawing and where its top is. */
  const column = (s, cx, cy, z, w) => {
    const a = s.a;
    const g = [];
    a.runs.slice(0, s.runs).forEach((r, k) => {
      const live = k === s.runs - 1 && s.state === "running";
      const h = Math.max(3.5, ((live ? v.t : r.to) - r.from) * scale);
      g.push(block(cx, cy, z, z + h, w, live ? "on" : "off"));
      z += h;
    });
    return { g, z };
  };

  // Ties on the floor from a parent's tile to its child's, then the columns from the back to the front.
  for (const s of v.all) {
    if (!s.a.parent || !G.at.has(s.a.id)) continue;
    const [x1, y1] = cell(s.a.parent);
    const [x2, y2] = cell(s.a.id);
    out.push(line(x1, y1, x2, y2, { class: `tie ${s.a.shape === "background" ? "bg" : ""} ${s.state === "running" ? "live" : ""} m-${s.a.m.key}` }));
  }
  const names = [];
  const order = [...G.items].sort((p, q) => {
    const kp = G.at.get(p);
    const kq = G.at.get(q);
    return (kp % cols) + Math.floor(kp / cols) - ((kq % cols) + Math.floor(kq / cols)) || kp - kq;
  });
  for (const id of order) {
    const [cx, cy] = cell(id);
    const ghost = v.ghosts.find((g) => g.id === id);
    if (ghost) {
      const a = hw * f;
      const b = hh * f;
      const z = 26;
      const d = `M${r1(cx - a)} ${r1(cy)}L${r1(cx)} ${r1(cy + b)}L${r1(cx + a)} ${r1(cy)}L${r1(cx)} ${r1(cy - b)}ZM${r1(cx - a)} ${r1(cy - z)}L${r1(cx)} ${r1(cy + b - z)}L${r1(cx + a)} ${r1(cy - z)}L${r1(cx)} ${r1(cy - b - z)}ZM${r1(cx - a)} ${r1(cy)}v${-z}M${r1(cx)} ${r1(cy + b)}v${-z}M${r1(cx + a)} ${r1(cy)}v${-z}`;
      out.push(`<g data-id="${id}"${ghost.fresh ? ' class="fresh"' : ""}>${path(d, { class: "said", fill: "transparent" })}</g>`);
      if (n <= 16) names.push(text(cx, cy - z - b - 5, "said", { size: 9, anchor: "middle", weight: 600, class: "t-said lift" }));
      if (o.sel === id) names.push(tag("ellipse", { cx: r1(cx), cy: r1(cy), rx: r1(a + 4), ry: r1(b + 3), class: "sel" }));
      continue;
    }
    const s = v.of.get(id);
    if (!s?.exists) continue;
    const a = s.a;
    const step = a.parent ? 9 : 0;
    const g = [];
    if (step) g.push(block(cx, cy, 0, step, 0.82, "step"));
    const col = column(s, cx, cy, step, f);
    g.push(...col.g);
    let top = col.z;
    const running = s.state === "running";
    const mark = (z, m, live, size) => text(cx, cy - z + size * 0.36, m.letter, { size, weight: 700, anchor: "middle", class: live ? "t-on" : "t-m" });
    if (hw * f >= 21) g.push(text(cx, cy - top + 3.2, a.m.short, { size: 9.5, weight: 700, anchor: "middle", class: running ? "t-on" : "t-m" }));
    else if (hw >= 15) g.push(mark(top, a.m, running, Math.min(11, hh * 0.9)));
    if (s.state === "failed") g.push(cross(cx, cy - top, 5));
    // A foreground child rides on the column that waits for it.
    const riders = [];
    let rode = 0;
    for (const kid of a.kids.map((k) => v.of.get(k)).filter((k) => k.exists && !G.at.has(k.a.id))) {
      const rider = column(kid, cx, cy, top, 0.36);
      riders.push(`<g data-id="${kid.a.id}" class="${cls(kid)}"><g${kid.fresh ? ' class="fresh"' : ""}>${rider.g.join("")}${kid.state === "failed" ? cross(cx, cy - rider.z, 4) : ""}</g></g>`);
      if (kid.state === "running" || n <= 16 || o.sel === kid.a.id) names.push(text(cx, cy - rider.z - hh * 0.36 - 5, `${kid.a.id}${kid.known ? "" : " ?"}`, { size: 9, weight: 700, anchor: "middle", class: `mono lift ${kid.state === "running" ? "" : "t3"}` }));
      rode = rider.z + 11;
      if (o.sel === kid.a.id) names.push(tag("ellipse", { cx: r1(cx), cy: r1(cy - rider.z), rx: r1(hw * 0.36 + 4), ry: r1(hh * 0.36 + 3), class: "sel" }));
      top = Math.max(top, rider.z);
    }
    out.push(`<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${g.join("")}</g></g>${riders.join("")}`);
    top = Math.max(top, rode);
    if (running || n <= 6 || o.sel === a.id) names.push(text(cx, cy - top - hh * (rode ? 0.36 : f) - 5, `${a.id}${s.runs > 1 ? ` · run ${s.runs}` : ""}`, { size: n <= 16 ? 10 : 9, weight: 700, anchor: "middle", class: `mono lift ${running ? "" : "t3"}` }));
    if (s.unsaid) names.push(diamond(cx - hw * f - 1, cy - top, 5));
    if (o.sel === a.id) names.push(tag("ellipse", { cx: r1(cx), cy: r1(cy), rx: r1(hw * f + 4), ry: r1(hh * f + 3), class: "sel" }));
  }
  return { h: fy + 12, body: `${out.join("")}${names.join("")}` };
};
