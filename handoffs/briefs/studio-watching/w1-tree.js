/* W1 · The tree that grows. The session at the top, and under it everything it started, in the order of starting:
   a rail a row, a stub down to each one, and a subagent's own subagents hung under it. Nothing moves once it has a
   place; a thing changes where it stands. With six or fewer it is drawn as cards; with dozens, as small tiles. */
DRAW.tree = (P, v, W, o) => {
  const n = P.agents.length;
  const tier = n <= 6 ? "card" : n <= 16 ? "mid" : "tile";
  const pad = 14;
  const trunk = pad + 8;
  const left = pad + 22;
  const gap = tier === "tile" ? 6 : 8;
  const wide = W >= 600;
  const cols = tier === "card" ? (wide ? 4 : W < 340 ? 1 : 2) : tier === "mid" ? (wide ? 6 : 3) : wide ? 12 : 6;
  const tw = Math.floor((W - left - pad - gap * (cols - 1)) / cols);
  const th = tier === "card" ? 58 : tier === "mid" ? 40 : 32;
  const head = 40;

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
    let y = pad + head + 14;
    for (let r = 0; r * cols < top.length; r++) {
      const row = top.slice(r * cols, (r + 1) * cols);
      const nested = row.some((id) => P.byId.get(id)?.kids.length);
      const end = y + 10 + th + (nested ? 12 + th : 0) + 12;
      row.forEach((id, c) => {
        at.set(id, { x: left + c * (tw + gap), y: y + 10, rail: y, row: r, end });
        (P.byId.get(id)?.kids ?? []).forEach((kid, j) => at.set(kid, { x: Math.min(left + (c + j) * (tw + gap) + (tier === "tile" ? 0 : 12), W - pad - tw), y: y + 10 + th + 12, row: r, under: id }));
      });
      y = end;
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
    const d = [`M${sn(trunk)} ${pad + head}V${sn(lastRail) - 5}`];
    for (const r of rows) {
      const here = tops.filter((id) => at.get(id).row === r);
      const rail = sn(at.get(here[0]).rail);
      const end = Math.max(...here.map((id) => at.get(id).x)) + tw / 2;
      d.push(`M${sn(trunk)} ${rail - 5}Q${sn(trunk)} ${rail} ${sn(trunk) + 5} ${rail}H${sn(end)}`);
    }
    out.push(path(d.join(""), { class: "tie" }));
  }
  // The session: the one in charge.
  const sw = Math.min(W - pad * 2, 248);
  const word = leadWord(v);
  out.push(
    `<g data-id="session">${box(pad, pad, sw, head, { rx: 8, class: "f-card s-ink lift-1" })}${v.working && !v.ended ? tag("circle", { cx: pad + 15, cy: pad + 20.5, r: 3.5, class: "f-live glow" }) : tag("circle", { cx: pad + 15, cy: pad + 20.5, r: 3, class: "f-none s-ink", "stroke-width": 1 })}${text(pad + 27, pad + 17.5, "Session", { size: 12, weight: 600 })}${text(pad + 27, pad + 31, word ? `${P.lead.name} · ${word}` : P.lead.name, { size: 10, class: "t2" })}${text(pad + sw - 11, pad + 17.5, `${v.running.length} running`, { size: 10.5, anchor: "end", weight: 600, class: v.running.length ? "t-live" : "t3" })}${text(pad + sw - 11, pad + 31, `${v.all.length - v.running.length} finished`, { size: 10, anchor: "end", class: "t3" })}${o.sel === "session" ? box(pad - 3, pad - 3, sw + 6, head + 6, { rx: 10, class: "sel" }) : ""}</g>`,
  );

  for (const g of v.ghosts) {
    const p = at.get(g.id);
    out.push(rule(p.x + tw / 2, p.rail, p.x + tw / 2, p.y, { class: "said f-none" }));
    const words =
      tier === "tile"
        ? text(p.x + tw / 2, p.y + th / 2 + 3, "said", { size: 8.5, anchor: "middle", weight: 600, class: "t-said" })
        : `${text(p.x + 10, p.y + (tier === "card" ? 19 : 16), "Said, never seen", { size: tier === "card" ? 11 : 9.5, weight: 600, class: "t-said" })}${text(p.x + 10, p.y + (tier === "card" ? 35 : 30), `${g.type}${tier === "card" ? " · made up" : ""}`, { size: tier === "card" ? 10 : 9, class: "t2" })}`;
    out.push(`<g data-id="${g.id}"${g.fresh ? ' class="fresh"' : ""}>${box(p.x, p.y, tw, th, { rx: tier === "tile" ? 5 : 7, class: "said f-said" })}${words}${o.sel === g.id ? box(p.x - 3, p.y - 3, tw + 6, th + 6, { rx: 9, class: "sel" }) : ""}</g>`);
  }

  for (const s of v.all) {
    const a = s.a;
    const p = at.get(a.id);
    const cx = p.x + tw / 2;
    const running = s.state === "running";
    const failed = s.state === "failed";
    const tie = `tie ${a.shape === "background" ? "bg" : ""} ${running ? "live" : ""} ${s.known ? "" : "unknown"}`;
    if (p.under) {
      const q = at.get(p.under);
      const px = q.x + (tier === "tile" ? tw / 2 : 10);
      const d = tier === "tile" ? `M${sn(px)} ${q.y + th + 1}V${p.y - 6}${Math.abs(px - cx) < 1 ? "" : `H${sn(cx)}`}V${p.y}` : elbow(px, q.y + th + 1, p.x, p.y + th / 2);
      out.push(path(d, { class: tie }));
      if (!s.known) out.push(text(px + 5, q.y + th + 10, "?", { size: 9.5, weight: 700, class: "t3" }));
    } else out.push(rule(cx, p.rail, cx, p.y, { class: tie }));

    const body = [box(p.x, p.y, tw, th, { rx: tier === "tile" ? 5 : 7, class: `${running ? "f-livet s-live" : failed ? "f-card s-bad" : "f-card s-hair"}${tier === "tile" ? "" : " lift-1"}` })];
    if (tier === "tile") {
      // A tile: its name, whether it runs, and its model as a small square of color and a letter.
      body.push(text(p.x + 6, p.y + 13, a.id, { size: 10, weight: running ? 700 : 500, class: `mono${running ? "" : " t2"}` }));
      if (running) body.push(liveDot(p.x + tw - 8, p.y + 9.5, 2.5));
      if (failed) body.push(cross(p.x + tw - 8, p.y + 9.5, 2.8));
      body.push(swatch(p.x + 6, p.y + 19.5, 6), text(p.x + 15, p.y + 25.5, a.m.letter, { size: 8.5, weight: 600, class: "t2" }));
      if (s.runs > 1) body.push(times(p.x + tw - 5, p.y + 25.5, s.runs, "end"));
    } else {
      const big = tier === "card";
      const y1 = p.y + (big ? 20 : 16);
      body.push(text(p.x + 10, y1, a.id, { size: big ? 12.5 : 11, weight: 600, class: "mono" }));
      if (running) {
        const elapsed = short(v.t - s.since);
        body.push(text(p.x + tw - 10, y1, elapsed, { size: big ? 10.5 : 9.5, anchor: "end", weight: 600, class: "mono t-live" }));
        body.push(liveDot(p.x + tw - 18 - elapsed.length * (big ? 6.3 : 5.7), y1 - 3.5, 2.8));
      } else body.push(text(p.x + tw - 10, y1, failed ? "failed" : "done", { size: big ? 10.5 : 9.5, anchor: "end", class: failed ? "t-bad" : "t3" }));
      if (failed) body.push(cross(p.x + tw - (big ? 47 : 42), y1 - 3.5, 2.8));
      if (big) {
        body.push(text(p.x + 10, p.y + 35, a.type, { size: 10, class: "t2" }));
        body.push(swatch(p.x + 10, p.y + 43), text(p.x + 21, p.y + 49.5, a.m.name, { size: 10, weight: 600 }), text(p.x + 21 + a.m.name.length * 5.4 + 4, p.y + 49.5, `· ${a.shape}`, { size: 10, class: "t3" }));
        if (s.runs > 1) body.push(text(p.x + tw - 10, p.y + 35, `run ${s.runs}`, { size: 10, anchor: "end", class: "t2" }));
      } else {
        body.push(swatch(p.x + 10, p.y + 24.5, 6.5), text(p.x + 20, p.y + 30.5, a.m.short, { size: 9.5, class: "t2" }));
        if (s.runs > 1) body.push(times(p.x + tw - 10, p.y + 30.5, s.runs, "end"));
      }
    }
    if (s.unsaid) body.push(diamond(p.x + 0.5, p.y + 0.5, tier === "tile" ? 3.5 : 4.5));
    if (o.sel === a.id) body.push(box(p.x - 3, p.y - 3, tw + 6, th + 6, { rx: tier === "tile" ? 7 : 9, class: "sel" }));
    out.push(`<g data-id="${a.id}" class="${cls(s)}"><g${s.fresh ? ' class="fresh"' : ""}>${body.join("")}</g></g>`);
  }
  // The stage is as tall as the tree has grown.
  return { h: Math.max(pad + head + pad, ...tops.map((id) => at.get(id).end)), body: out.join("") };
};
