/* W7 · The punch card. A row a subagent, in the order of starting; a column a burst of work; a mark where that
   subagent ran in that burst. New agents make the diagonal; an agent sent back out is a second mark along its row;
   a tall column is a burst that fanned out. The whole history of a session of days in a few hundred pixels. */
DRAW.card = (P, v, W, o) => {
  const pad = 14;
  const places = placesOf(P, o.said);
  const n = places.n;
  const nb = P.bursts.length;
  const left = pad + 30;
  const top = pad + 22;
  const cw = Math.min(26, (W - left - pad) / nb);
  const rh = clamp(264 / n, 4.6, 18);
  const X = (k) => left + k * cw;
  const Y = (k) => top + k * rh;
  const lastBurst = Math.max(v.burst.k, ...P.bursts.filter((b) => b.runs.some((r) => begun(v, r))).map((b) => b.k));
  const shown = [...v.all.map((s) => places.get(s.a.id)), ...v.ghosts.map((g) => places.get(g.id))];
  const rows = Math.max(0, ...shown.map((k) => k + 1));
  const out = [];
  // The card as far as the session has gone: a hairline frame, a rule every five rows, a tick where a day has gone by.
  const right = X(lastBurst + 1);
  const bottom = Y(Math.max(rows, 1));
  out.push(box(left - 0.5, top - 0.5, right - left, bottom - top, { rx: 3, class: "f-card s-hair lift-1", "data-id": "session" }));
  for (let k = 5; k < rows; k += 5) out.push(rule(left, Y(k), right, Y(k), { class: "s-rule", "stroke-width": 0.75 }));
  let day = 0;
  for (const b of P.bursts.slice(0, lastBurst + 1)) {
    const d = Math.floor(b.from / 86400000);
    if (d !== day) {
      day = d;
      out.push(rule(X(b.k), top - 8, X(b.k), bottom, { class: "s-hair", "stroke-width": 0.75 }), text(X(b.k) + 2, top - 9, `${d}d`, { size: 8.5, class: "mono t3" }));
    }
  }
  out.push(text(left, top - 9, nb > 1 ? "bursts →" : "one burst", { size: 8.5, class: "t3" }));
  // The column the clock is in.
  out.push(tag("rect", { x: r1(X(v.burst.k)), y: top - 0.5, width: r1(cw), height: r1(bottom - top), class: "f-livet", opacity: 0.9 }), rule(X(v.burst.k) + cw / 2, bottom, X(v.burst.k) + cw / 2, bottom + 5, { class: "s-live", "stroke-width": 1 }));
  for (let b = 0; b <= lastBurst; b++) out.push(tag("rect", { x: r1(X(b)), y: top - 10, width: r1(cw), height: r1(bottom - top + 14), class: "hit", "data-go": P.moments.find((m) => m.t >= P.bursts[b].from && (m.kind === "start" || m.kind === "resume")).i }));

  const mh = Math.max(2.6, rh - 1.6);
  const mw = Math.max(2.6, cw - 2);
  const rowsOut = [];
  for (const s of v.all) {
    const a = s.a;
    const k = places.get(a.id);
    const y = Y(k) + (rh - mh) / 2;
    const g = [tag("rect", { x: pad, y: r1(Y(k)), width: r1(right - pad), height: r1(rh), class: "hit" })];
    if (n <= 16 || k % 5 === 4) g.push(text(left - 5, Y(k) + rh / 2 + 3, a.id, { size: 8.5, anchor: "end", weight: s.state === "running" ? 700 : 400, class: `mono${s.state === "running" ? "" : " t3"}` }));
    if (a.parent) {
      const py = Y(places.get(a.parent)) + rh / 2;
      g.push(path(`M${sn(pad + 3)} ${r1(py)}V${r1(Y(k) + rh / 2)}H${r1(pad + 8)}`, { class: `tie ${a.shape === "background" ? "bg" : ""} ${s.known ? "" : "unknown"}` }));
    }
    for (const b of P.bursts) {
      const runs = b.runs.filter((r) => r.id === a.id && begun(v, r));
      if (runs.length === 0) continue;
      const running = live(v, runs.at(-1));
      const failed = runs.at(-1).end === "failed" && !running;
      const x = X(b.k) + (cw - mw) / 2;
      g.push(tag("rect", { x: r1(x), y: r1(y), width: r1(mw), height: r1(mh), rx: Math.min(2, mh / 2), class: `mark ${running ? "f-m" : "f-mm"}` }));
      if (running) g.push(tag("circle", { cx: r1(x + mw / 2), cy: r1(y + mh / 2), r: Math.max(2.5, mh / 2), class: "halo" }));
      if (failed) g.push(cross(x + mw / 2, y + mh / 2, Math.max(2, mh / 2)));
    }
    if (s.unsaid) g.push(diamond(X(burstAt(P, a.runs[0].from).k) - 1, Y(k) + rh / 2, Math.min(3.2, rh / 2 + 0.6)));
    if (o.sel === a.id) g.push(tag("rect", { x: sn(left - 28), y: sn(Y(k) - 1), width: Math.round(right - left + 30), height: Math.round(rh + 2), rx: 2, class: "sel" }));
    rowsOut.push(`<g data-id="${a.id}" class="${cls(s)}">${g.join("")}</g>`);
  }
  for (const ghost of v.ghosts) {
    const k = places.get(ghost.id);
    const b = burstOfPlan(P, P.plans[ghost.plan]);
    const x = X(b.k) + (cw - mw) / 2;
    const y = Y(k) + (rh - mh) / 2;
    rowsOut.push(`<g data-id="${ghost.id}"${ghost.fresh ? ' class="fresh"' : ""}>${tag("rect", { x: r1(x - 4), y: r1(y - 4), width: r1(mw + 8), height: r1(mh + 8), class: "hit" })}${tag("rect", { x: r1(x), y: r1(y), width: r1(mw), height: r1(mh), rx: Math.min(2, mh / 2), class: "said f-said" })}${cw >= 20 || right + 28 < W ? text(x + mw + 4, y + mh / 2 + 3, "said", { size: 8.5, weight: 600, class: "t-said lift" }) : ""}${o.sel === ghost.id ? tag("rect", { x: r1(x - 3), y: r1(y - 3), width: r1(mw + 6), height: r1(mh + 6), rx: 2, class: "sel" }) : ""}</g>`);
  }
  return { h: bottom + 12 + 22, body: `${out.join("")}${rowsOut.join("")}${tallyLine(v, W / 2, bottom + 24)}` };
};
