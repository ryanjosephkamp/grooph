/* W10 · The pulse. The plainest of them: how many were running at once, moment by moment, stacked by model. A
   step is a moment, so days of waiting cost nothing. Under the line, a tick where each subagent first started. It
   reads in a glance, and a glance is often all there is. */
DRAW.pulse = (P, v, W, o) => {
  const pad = 14;
  const left = pad + 14;
  const right = W - pad;
  const top = pad + 44;
  const levels = P.most + (o.said && P.plans.some((p) => p.never.length) ? 1 : 0);
  const unit = clamp(150 / levels, 14, 34);
  const base = Math.round(top + levels * unit);
  const M = P.moments.length;
  // The line fills the width as far as the session has gone, as a live one would: the clock is at its right end.
  const span = Math.max(v.i, 24);
  const X = (i) => left + (i / span) * (right - left);
  const KEYS = ["opus", "sonnet", "haiku", "none"];
  // How many were running after each moment, by model: once, from the whole list of moments.
  let pulse = P.cache.get("pulse");
  if (!pulse) {
    const on = new Map();
    pulse = P.moments.map((m) => {
      if (m.kind === "start" || m.kind === "resume") on.set(m.id, P.byId.get(m.id).m.key);
      if (m.kind === "stop" || m.kind === "fail") on.delete(m.id);
      const c = Object.fromEntries(KEYS.map((k) => [k, 0]));
      for (const key of on.values()) c[key] += 1;
      return c;
    });
    P.cache.set("pulse", pulse);
  }
  const out = [];
  for (let k = 1; k <= levels; k++) {
    out.push(rule(left, base - k * unit, right, base - k * unit, { class: "s-rule", "stroke-width": 0.75 }));
    if (k <= P.most) out.push(text(left - 5, base - k * unit + 3, String(k), { size: 8.5, anchor: "end", class: "mono t3" }));
  }
  out.push(text(pad, pad + 9, "running at once, moment by moment", { size: 9.5, weight: 600, class: "t2" }));
  // The stack, a model a layer, as far as the clock.
  const layers = [];
  let outline = "";
  let under = Array.from({ length: v.i + 1 }, () => 0);
  for (const key of KEYS) {
    if (!pulse.slice(0, v.i + 1).some((c) => c[key] > 0)) continue;
    const over = under.map((u, i) => u + pulse[i][key]);
    const up = [];
    const down = [];
    for (let i = 0; i <= v.i; i++) {
      const x0 = X(i);
      const x1 = i < v.i ? X(i + 1) : X(i) + (i < M - 1 ? 0 : 0);
      up.push(`${i === 0 ? "M" : "L"}${r1(x0)} ${r1(base - over[i] * unit)}L${r1(x1)} ${r1(base - over[i] * unit)}`);
      down.unshift(`L${r1(x1)} ${r1(base - under[i] * unit)}L${r1(x0)} ${r1(base - under[i] * unit)}`);
    }
    layers.push(`<g class="m-${key}">${path(`${up.join("")}${down.join("")}Z`, { class: "f-mm" })}</g>`);
    outline = up.join("");
    under = over;
  }
  // One hairline along the top of the whole stack.
  if (outline) layers.push(path(outline, { class: "f-none s-ink", "stroke-width": 1, "stroke-linejoin": "round" }));
  out.push(rule(left, base, right, base, { class: "s-ink", "stroke-width": 1 }));
  // Under the line: a tick where each subagent first started, and a mark where a day has gone by.
  const ticks = [];
  let day = 0;
  let lastLabel = -99;
  P.moments.slice(0, v.i + 1).forEach((m) => {
    const d = Math.floor(m.t / 86400000);
    if (d !== day) {
      day = d;
      ticks.push(rule(X(m.i), base, X(m.i), base + 20, { class: "s-hair", "stroke-width": 0.75 }));
      if (X(m.i) - lastLabel > 16) ticks.push(text(X(m.i) + 2, base + 28, `${d}d`, { size: 8.5, class: "mono t3" }));
      if (X(m.i) - lastLabel > 16) lastLabel = X(m.i);
    }
  });
  for (const s of v.all) {
    const a = s.a;
    const i = P.moments.find((m) => m.kind === "start" && m.id === a.id).i;
    const x = sn(X(i));
    const running = s.state === "running";
    const g = [tag("rect", { x: r1(x - 5), y: base + 2, width: 10, height: 18, class: "hit" }), line(x, base + 4, x, base + (a.parent ? 16 : 12), { class: "s-m", "stroke-width": running ? 2 : 1.25, "stroke-linecap": "round" })];
    if (running) g.push(tag("circle", { cx: x, cy: base + 15.5, r: 2, class: "halo" }), tag("circle", { cx: x, cy: base + 15.5, r: 2, class: "f-live" }));
    if (s.state === "failed") g.push(cross(x, base + 16, 2.2));
    if (s.unsaid) g.push(diamond(x, base + 18, 2.8));
    if (o.sel === a.id) g.push(tag("rect", { x: r1(x - 4), y: base + 2, width: 8, height: 17, rx: 2, class: "sel" }));
    ticks.push(`<g data-id="${a.id}" class="${cls(s)}">${g.join("")}</g>`);
  }
  // What was said: a flag where it was said, and a dashed step above the stack for what was said and never ran.
  for (const p of v.said) {
    const i = P.moments.find((m) => m.kind === "said" && m.plan === p.k).i;
    const x = Math.round(X(i));
    ticks.push(path(`M${sn(x)} ${top - 2}v-10h7l-2.2 2.6l2.2 2.6h-7`, { class: "s-said f-said", "stroke-width": 1, "stroke-linejoin": "round" }), rule(x, top - 2, x, base, { class: "said f-none" }));
    p.never.forEach((g, j) => {
      const after = P.moments.find((m) => m.kind === "start" && m.id === p.covers.at(-1))?.i ?? i + 1;
      const level = Math.max(...pulse.slice(i, Math.min(M, after + 2)).map((c) => KEYS.reduce((t, key) => t + c[key], 0))) + j;
      const w = Math.max(16, Math.min(right, X(Math.min(M - 1, after + 3))) - x);
      ticks.push(`<g data-id="${g.id}"${g.fresh ? ' class="fresh"' : ""}>${tag("rect", { x: sn(x), y: sn(base - (level + 1) * unit), width: Math.round(w), height: Math.round(unit), rx: 2, class: "said f-said" })}${o.sel === g.id ? tag("rect", { x: sn(x - 2), y: sn(base - (level + 1) * unit - 2), width: Math.round(w + 4), height: Math.round(unit + 4), rx: 3, class: "sel" }) : ""}</g>`);
      if (x + w + 26 < right) ticks.push(text(x + w + 4, base - (level + 0.5) * unit + 3, "said", { size: 8.5, weight: 600, class: "t-said lift" }));
    });
  }
  // The clock.
  const nx = X(v.i);
  const total = v.running.length;
  const chip = `${total} at once`;
  const cw = chip.length * 5 + 10;
  const cxp = clamp(nx, left + cw / 2, right - cw / 2);
  const sessionHit = tag("rect", { x: left, y: base - 4, width: r1(right - left), height: 7, class: "hit", "data-id": "session" });
  const clock = `${sessionHit}${rule(nx, top - 4, nx, base + 20, { class: "s-live", "stroke-width": 1 })}${tag("rect", { x: r1(cxp - cw / 2), y: top - 18, width: r1(cw), height: 13, rx: 3, class: "f-live" })}${text(cxp, top - 8.5, chip, { size: 8.5, anchor: "middle", weight: 600, class: "mono t-clock" })}`;
  return { h: base + 34 + 22, body: `${out.join("")}${layers.join("")}${ticks.join("")}${clock}${tallyLine(v, W / 2, base + 48)}` };
};
