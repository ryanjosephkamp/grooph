/* W1 · The tree that grows. The session at the top, and under it everything it started, in the order of starting:
   a rail a row, a stub down to each one, and a subagent's own subagents hung under it. Nothing moves once it has a
   place; a thing changes where it stands. With six or fewer it is drawn as the app's cards; with dozens, as tokens. */
DRAW.tree = (P, v, W, o) => {
  const n = P.agents.length;
  const tier = n <= 6 ? "card" : n <= 16 ? "mid" : "tok";
  const pad = 12;
  const trunk = pad + 10;
  const left = pad + 28;
  const gap = tier === "tok" ? 8 : 10;
  const wide = W >= 600;
  const cols = tier === "card" ? (wide ? 4 : 2) : tier === "mid" ? (wide ? 6 : 3) : Math.floor((W - left - pad + gap) / (30 + gap));
  const tw = tier === "tok" ? 30 : (W - left - pad - gap * (cols - 1)) / cols;
  const th = tier === "card" ? 62 : tier === "mid" ? 44 : 30;
  const under = tier === "tok" ? 13 : 0;

  // Every place is given before anything is drawn, from the whole record: a thing that starts later has its place
  // waiting. (Live, a place is given when a thing starts, which comes to the same: the order is the order of starting.)
  const key = `tree ${W} ${o.said}`;
  let at = P.cache.get(key);
  if (!at) {
    at = new Map();
    const ghosts = o.said ? P.plans.flatMap((p) => p.never) : [];
    const top = [];
    for (const a of P.agents.filter((x) => !x.parent)) {
      top.push(a.id);
      for (const g of ghosts.filter((x) => x.after === a.id)) top.push(g.id);
    }
    let y = pad + 44 + 16;
    for (let r = 0; r * cols < top.length; r++) {
      const row = top.slice(r * cols, (r + 1) * cols);
      const nested = row.some((id) => P.byId.get(id)?.kids.length);
      row.forEach((id, c) => {
        at.set(id, { x: left + c * (tw + gap), y: y + 12, rail: y, row: r, end: y + 12 + th + under + (nested ? 14 + th + under : 0) + 12 });
        (P.byId.get(id)?.kids ?? []).forEach((kid, j) => at.set(kid, { x: Math.min(left + (c + j) * (tw + gap) + (tier === "tok" ? 0 : 14), W - pad - tw), y: y + 12 + th + under + 14, row: r, under: id }));
      });
      y += 12 + th + under + (nested ? 14 + th + under : 0) + 12;
    }
    P.cache.set(key, at);
  }

  const out = [];
  const shown = [...v.all.map((s) => s.a.id), ...v.ghosts.map((g) => g.id)];
  const tops = shown.filter((id) => !at.get(id).under);
  // The trunk, and a rail for each row that has something on it.
  const rows = [...new Set(tops.map((id) => at.get(id).row))];
  if (rows.length > 0) {
    const lastRail = Math.max(...tops.map((id) => at.get(id).rail));
    out.push(line(trunk, pad + 44, trunk, lastRail, { class: "tie", "stroke-width": 1.6 }));
    for (const r of rows) {
      const here = tops.filter((id) => at.get(id).row === r);
      const end = Math.max(...here.map((id) => at.get(id).x)) + tw / 2;
      out.push(line(trunk, at.get(here[0]).rail, end, at.get(here[0]).rail, { class: "tie", "stroke-width": 1.6 }));
    }
  }
  // The session: the one in charge.
  const sw = Math.min(W - pad * 2, 230);
  out.push(
    `<g data-id="session">${tag("rect", { x: pad, y: pad, width: sw, height: 44, rx: 10, class: "f-surface s-ink", "stroke-width": 1.6 })}${v.working && !v.ended ? tag("circle", { cx: pad + 16, cy: pad + 22, r: 5, class: "f-accent glow" }) : tag("circle", { cx: pad + 16, cy: pad + 22, r: 4.5, class: "f-none s-ink", "stroke-width": 1.5 })}${text(pad + 30, pad + 19, "session", { size: 12, weight: 700 })}${text(pad + 30, pad + 34, `${P.lead.name} · ${v.ended ? "ended" : v.working ? "in a turn" : "between turns"}`, { size: 10.5, class: "t2" })}${text(pad + sw - 10, pad + 19, `${v.running.length} running`, { size: 10.5, anchor: "end", class: "t2" })}${text(pad + sw - 10, pad + 34, `${v.all.length - v.running.length} finished`, { size: 10.5, anchor: "end", class: "t3" })}${o.sel === "session" ? tag("rect", { x: pad - 3, y: pad - 3, width: sw + 6, height: 50, rx: 12, class: "sel" }) : ""}</g>`,
  );

  for (const g of v.ghosts) {
    const p = at.get(g.id);
    out.push(line(p.x + tw / 2, p.rail, p.x + tw / 2, p.y, { class: "said" }));
    out.push(`<g data-id="${g.id}"${g.fresh ? ' class="fresh"' : ""}>${tag("rect", { x: r1(p.x), y: p.y, width: r1(tw), height: th, rx: tier === "tok" ? 8 : 10, class: "said f-said" })}${tier === "tok" ? text(p.x + tw / 2, p.y + th + 10, "said", { size: 8.5, anchor: "middle", class: "t-said" }) : `${text(p.x + 12, p.y + 18, "said, never seen", { size: tier === "card" ? 11.5 : 9.5, weight: 600, class: "t-said" })}${text(p.x + 12, p.y + (tier === "card" ? 36 : 33), `${g.type}${tier === "card" ? " · made up" : ""}`, { size: tier === "card" ? 10.5 : 9, class: "t2" })}`}${o.sel === g.id ? tag("rect", { x: r1(p.x - 3), y: p.y - 3, width: r1(tw + 6), height: th + 6, rx: 11, class: "sel" }) : ""}</g>`);
  }

  for (const s of v.all) {
    const a = s.a;
    const p = at.get(a.id);
    const cx = p.x + tw / 2;
    const running = s.state === "running";
    const tie = `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"} m-${a.m.key}`;
    if (p.under) {
      const q = at.get(p.under);
      const px = q.x + (tier === "tok" ? tw / 2 : 12);
      const d = tier === "tok" && Math.abs(px - cx) < 1 ? `M${r1(px)} ${q.y + th + under}V${p.y}` : tier === "tok" ? `M${r1(px)} ${q.y + th + under}V${p.y - 7}H${r1(cx)}V${p.y}` : elbow(px, q.y + th, p.x, p.y + th / 2);
      out.push(path(d, { class: tie }));
      if (!s.known) out.push(text(px + 6, q.y + th + under + 10, "?", { size: 10, weight: 700, class: "t3" }));
    } else out.push(line(cx, p.rail, cx, p.y, { class: tie }));
    const body = [];
    if (tier === "tok") {
      if (running) body.push(tag("rect", { x: p.x - 4, y: p.y - 4, width: tw + 8, height: th + 8, rx: 11, class: "halo" }));
      body.push(tag("rect", { x: p.x, y: p.y, width: tw, height: th, rx: 8, class: running ? "f-m s-m" : "f-surface s-m", "stroke-width": 2 }));
      body.push(text(cx, p.y + 20, a.m.letter, { size: 14, weight: 700, anchor: "middle", class: running ? "t-on" : "t-m" }));
      body.push(text(cx, p.y + th + 10, a.id, { size: 8.5, anchor: "middle", class: `mono ${running ? "" : "t3"}` }));
      if (s.state === "failed") body.push(cross(p.x + tw - 2, p.y + 2, 4.5));
      if (s.runs > 1) body.push(plate(p.x + tw - 1, p.y + th - 1, s.runs));
      if (s.unsaid) body.push(diamond(p.x + 1, p.y + 1));
    } else {
      const big = tier === "card";
      if (running) body.push(tag("rect", { x: r1(p.x - 4), y: p.y - 4, width: r1(tw + 8), height: th + 8, rx: 13, class: "halo" }));
      body.push(tag("rect", { x: r1(p.x), y: p.y, width: r1(tw), height: th, rx: 10, class: `f-surface ${running ? "s-m" : "s-line"}`, "stroke-width": running ? 2 : 1.3 }));
      body.push(tag("rect", { x: r1(p.x + 5), y: p.y + 7, width: 4, height: th - 14, rx: 2, class: running ? "f-m" : "f-surface s-m", "stroke-width": 1.2 }));
      const word = s.state === "running" ? short(v.t - s.since) : s.state === "failed" ? "failed" : "done";
      body.push(text(p.x + 16, p.y + (big ? 20 : 17), a.id, { size: big ? 13 : 11.5, weight: 700, class: "mono" }));
      body.push(text(p.x + tw - 9, p.y + (big ? 20 : 17), `${big && s.runs > 1 ? `run ${s.runs} · ` : ""}${big && running ? "running " : ""}${word}`, { size: big ? 11 : 9.5, anchor: "end", class: s.state === "failed" ? "t-bad" : running ? "t-m" : "t3", weight: running ? 600 : 400 }));
      if (!big && s.runs > 1) body.push(plate(p.x + tw - 2, p.y + th - 2, s.runs));
      if (big) {
        body.push(text(p.x + 16, p.y + 36, a.type, { size: 11, class: "t2" }));
        body.push(text(p.x + 16, p.y + 52, `${a.m.name} · ${a.shape}`, { size: 11, class: "t-m", weight: 600 }));
      } else body.push(text(p.x + 16, p.y + 33, `${a.m.short} · ${a.shape === "background" ? "backgr." : "foregr."}`, { size: 9.5, class: "t-m", weight: 600 }));
      if (s.unsaid) body.push(diamond(p.x + 1, p.y + 1, 5.5));
    }
    if (o.sel === a.id) body.push(tag("rect", { x: r1(p.x - 3), y: p.y - 3, width: r1(tw + 6), height: th + 6, rx: tier === "tok" ? 10 : 12, class: "sel" }));
    out.push(`<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${body.join("")}</g></g>`);
  }
  // The stage is as tall as the tree has grown.
  return { h: Math.max(pad + 44 + pad, ...tops.map((id) => at.get(id).end)) + 2, body: out.join("") };
};
