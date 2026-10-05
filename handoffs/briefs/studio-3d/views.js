/* The 3D studio's drawing (slice 0094). One small stage that turns a list of things in space into a picture on a
   2D canvas, and five ways of placing a loop graph in that space. No library: the app could take any of these as it
   stands. What is drawn comes from DATA, which build.mjs worked out with core's own functions. */
(() => {
  "use strict";
  const DATA = window.STUDIO_DATA;
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const by = (list, id) => list.find((x) => x.id === id);

  /* ── the steps a view can be walked through ─────────────────────────────────────────────────────────────────
     A template has the app's own: the edges of a first pass in order, then one turn of each loop. A recorded run has
     its notes, as core replays them. Step 0 is the whole thing at once. */
  function stepsOf(m) {
    if (!m.run) {
      return [
        { says: `All ${m.pass.length} edges are lit. Press Play to follow a first pass, one edge at a time, and then one turn of each loop.` },
        ...m.pass.map((p, k) => {
          const e = by(m.edges, p.edge);
          return { says: `Step ${k + 1} of ${m.pass.length}: ${p.says}`, edge: e.id, nodes: [e.from, e.to], from: e.from, to: e.to, r0: 0, r1: p.loop ? 1 : 0, loop: p.loop };
        }),
      ];
    }
    const rounds = [...new Set(m.run.dispatches.map((d) => d.round))];
    const out = [{ says: `The whole run: ${m.run.dispatches.length} dispatches in rounds ${rounds.join(" and ")}. ${m.run.end} Press Play to follow its ${m.steps.length} notes.` }];
    let at = null;
    m.steps.forEach((s, k) => {
      const of = `Note ${k + 1} of ${m.steps.length}`;
      const step = { note: k, dispatch: s.dispatch };
      if (s.about === "node") {
        const round = s.round ?? at?.round ?? 0;
        // The edge the run took to get here: one from where it was, a way back if the round went up.
        const took = at && m.edges.filter((e) => e.from === at.node && e.to === s.id).sort((a, b) => (round > at.round ? (b.back ? 1 : 0) - (a.back ? 1 : 0) : (a.back ? 1 : 0) - (b.back ? 1 : 0)))[0];
        Object.assign(step, { says: `${of}: ${s.says}`, nodes: [s.id], to: s.id, r1: round, outcome: s.outcome }, took ? { edge: took.id, from: at.node, r0: at.round } : {});
        at = { node: s.id, round };
      } else if (s.about === "loop") Object.assign(step, { says: `${of}: ${s.says}`, loops: [s.id] });
      else if (s.about === "edge") {
        // A note about an edge is not a move along it: here, a proposal to change what the edge carries.
        const e = by(m.edges, s.id);
        Object.assign(step, { says: `${of}, ${s.what ? `a ${s.what}` : "a note"} about the edge ${s.says}, not a move along it: ${s.words}` }, e ? { edge: e.id, nodes: [e.from, e.to], about: true, r0: at?.round ?? 0 } : {});
      } else step.says = `${of}, ${s.what ? `an ${s.what}` : "about the run"}: ${s.words}`;
      out.push(step);
    });
    return out;
  }

  /* ── the stage: things in space, drawn on a canvas, turned by a finger ───────────────────────────────────── */
  const TOKENS = ["bg", "panel", "card", "ink", "ink-2", "ink-3", "line", "line-strong", "accent", "accent-soft", "loop-1", "loop-2", "loop-3", "loop-4", "k-agent", "k-check", "k-gate", "k-stop", "ok", "bad", "brake", "floor"];
  function Stage(canvas, start) {
    const g = canvas.getContext("2d");
    const view = { ...start, zoom: 1 };
    let prims = [];
    let fitted = 1;
    let center = [0, 0, 0];
    let shift = [0, 0];
    let colors = {};
    let w = 0;
    let h = 0;
    let asked = false;
    const turned = (p) => {
      const [x, y, z] = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
      const [cy, sy, cp, sp] = [Math.cos(view.yaw), Math.sin(view.yaw), Math.cos(view.pitch), Math.sin(view.pitch)];
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    };
    // Far things are a little smaller: enough to read depth by, not enough to bend a ring out of shape.
    const seen = (p) => {
      const [x, y, z] = turned(p);
      const k = (fitted * view.zoom * 2600) / (2600 - z * fitted * view.zoom);
      return [w / 2 + (x - shift[0]) * k, h / 2 - (y - shift[1]) * k, z, k];
    };
    const color = (name, alpha = 1) => {
      const c = colors[name] || name;
      return alpha >= 1 ? c : `color-mix(in srgb, ${c} ${Math.round(alpha * 100)}%, transparent)`;
    };
    function fit() {
      const pts = prims.flatMap((p) => p.pts || [p.at]);
      if (!pts.length) return;
      const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])));
      const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
      center = lo.map((v, k) => (v + hi[k]) / 2);
      // The largest it can be and still be whole in the frame at the starting view, with room for the cards, and in
      // the middle of the frame as it is seen from there.
      const was = { ...view };
      Object.assign(view, start, { zoom: 1 });
      // Each thing takes room round its point that does not shrink with the scene: a card its box, a block of
      // words its lines. The scene is as large as leaves all of that inside the frame, and is centered on it.
      const room = (p) => {
        if (p.t === "card") return p.side ? [8, p.small ? 104 : 128, 20, 20] : p.stand ? [p.small ? 46 : 58, p.small ? 46 : 58, p.small ? 40 : 56, 8] : [58, 58, 22, 22];
        if (p.t === "text") return [8, 8, p.up ? 16 * String(p.text).split("\n").length * 1.6 : 12, 12];
        return [3, 3, 3, 3];
      };
      const each = prims.flatMap((p) => (p.pts || [p.at]).map((q) => [turned(q), room(p)]));
      // As it will be seen: what is nearer is a little larger, and so reaches a little further.
      const near = (t, f) => (f * 2600) / (2600 - t[2] * f);
      const box = (f) => [Math.min(...each.map(([t, r]) => t[0] * near(t, f) - r[0])), Math.max(...each.map(([t, r]) => t[0] * near(t, f) + r[1])), Math.min(...each.map(([t, r]) => -t[1] * near(t, f) - r[2])), Math.max(...each.map(([t, r]) => -t[1] * near(t, f) + r[3]))];
      let [lo2, hi2] = [0.05, 1.5];
      for (let n = 0; n < 18; n += 1) {
        const f = (lo2 + hi2) / 2;
        const [x0, x1, y0, y1] = box(f);
        if (x1 - x0 <= w - 16 && y1 - y0 <= h - 16) lo2 = f;
        else hi2 = f;
      }
      fitted = lo2;
      const [x0, x1, y0, y1] = box(fitted);
      shift = [(x0 + x1) / 2 / fitted, -(y0 + y1) / 2 / fitted];
      Object.assign(view, was);
    }
    function inset(pts, head, tail) {
      const cut = (list, by) => {
        const out = [...list];
        let left = by;
        while (out.length > 2 && left > 0) {
          const d = Math.hypot(out[1][0] - out[0][0], out[1][1] - out[0][1]);
          if (d > left) break;
          left -= d;
          out.shift();
        }
        const d = Math.hypot(out[1][0] - out[0][0], out[1][1] - out[0][1]);
        if (d > left + 1) out[0] = [out[0][0] + ((out[1][0] - out[0][0]) * left) / d, out[0][1] + ((out[1][1] - out[0][1]) * left) / d];
        return out;
      };
      return cut(cut(pts, head).reverse(), tail).reverse();
    }
    function path(pts) {
      g.beginPath();
      pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    }
    function draw() {
      asked = false;
      const style = getComputedStyle(canvas);
      for (const name of TOKENS) colors[name] = style.getPropertyValue(`--${name}`).trim();
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      g.clearRect(0, 0, w, h);
      const lit = stage.lit;
      // At a step, what the step is about stands out: the other nodes, edges and loops step back. What belongs to
      // none of them (a lid, the faint rounds, a floor, a word) stays as it is.
      const dim = (p) => (lit && p.key && !lit.has(p.key) ? (p.t === "card" ? 0.62 : 0.42) : 1);
      const items = prims
        .filter((p) => !p.hide)
        .map((p) => {
          const pts = (p.pts || [p.at]).map(seen);
          const depth = pts.reduce((a, q) => a + q[2], 0) / pts.length + (p.t === "poly" ? -90 : p.t === "line" ? -20 : p.t === "dot" ? 4000 : p.t === "text" ? 60 : 0) + (p.lift || 0);
          return { p, pts, depth };
        })
        .sort((a, b) => a.depth - b.depth);
      for (const item of items) {
        const p = item.p;
        let pts = item.pts;
        const on = !!(lit && p.key && lit.has(p.key));
        g.globalAlpha = dim(p) * (p.alpha ?? 1);
        g.setLineDash(p.dash || []);
        g.lineJoin = g.lineCap = "round";
        // An edge stops short of what it runs to, by so many pixels of the screen, so that its head is seen.
        if (p.inset) pts = inset(pts, p.inset[0], p.inset[1]);
        if (p.t === "poly") {
          path(pts);
          g.closePath();
          if (p.fill) ((g.fillStyle = color(p.fill, on ? Math.min(1, (p.fa ?? 1) * 1.8) : (p.fa ?? 1))), g.fill());
          if (p.stroke) ((g.strokeStyle = color(on ? "accent" : p.stroke)), (g.lineWidth = (p.w || 1) * (on ? 2 : 1)), g.stroke());
        } else if (p.t === "line") {
          path(pts);
          g.strokeStyle = color(p.stroke || "ink-2");
          g.lineWidth = (p.w || 1.4) * (on ? 2.1 : 1);
          g.stroke();
          if (p.arrow && pts.length > 1) {
            const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
            g.setLineDash([]);
            g.beginPath();
            g.moveTo(b[0], b[1]);
            g.lineTo(b[0] - 9 * Math.cos(ang - 0.42), b[1] - 9 * Math.sin(ang - 0.42));
            g.lineTo(b[0] - 9 * Math.cos(ang + 0.42), b[1] - 9 * Math.sin(ang + 0.42));
            g.closePath();
            g.fillStyle = color(p.stroke || "ink-2");
            g.fill();
          }
        } else if (p.t === "dot") {
          g.beginPath();
          g.arc(pts[0][0], pts[0][1], p.r || 5, 0, TAU);
          if (p.fill) ((g.fillStyle = color(p.fill)), g.fill());
          if (p.stroke) ((g.strokeStyle = color(p.stroke)), (g.lineWidth = p.w || 2), g.stroke());
        } else if (p.t === "text") {
          g.font = `${p.bold ? 600 : 400} ${p.size || 11}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          g.textAlign = p.align || "left";
          g.textBaseline = "middle";
          // Words that would run past the frame are put on a line of their own, and a line is moved to stay in it.
          const room = Math.min(p.max || 220, w - 12);
          const lines = String(p.text).split("\n").flatMap((line, n) => {
            const out = [""];
            for (const word of line.split(" ")) {
              const next = out[out.length - 1] ? `${out[out.length - 1]} ${word}` : word;
              if (g.measureText(next).width > room && out[out.length - 1]) out.push(word);
              else out[out.length - 1] = next;
            }
            return out.map((text) => ({ text, head: n < (p.heads || 0) }));
          });
          lines.forEach(({ text: line, head }, k) => {
            const wide = g.measureText(line).width;
            const left = clamp(pts[0][0] - (p.align === "center" ? wide / 2 : p.align === "right" ? wide : 0), 4, Math.max(4, w - 4 - wide));
            // A block stands on its point and grows upward, or is centered on it.
            const y = pts[0][1] + (p.up ? k - (lines.length - 1) : k - (lines.length - 1) / 2) * ((p.size || 11) + 3);
            g.textAlign = "left";
            g.strokeStyle = color("panel", 0.9);
            g.lineWidth = 3.5;
            g.setLineDash([]);
            g.strokeText(line, left, y);
            g.fillStyle = color(head ? p.headFill : p.fill || "ink-2");
            g.fillText(line, left, y);
          });
        } else if (p.t === "card") {
          const s = clamp(pts[0][3], 0.72, 1.15);
          const [cw, ch] = p.small ? [84 * s, 22 * s] : [106 * s, 36 * s];
          // A card stands over its point, clear of it; or beside it, when edges come to the point from above and
          // below; or is centered on it.
          const [x, y] = [p.side ? pts[0][0] + 9 : pts[0][0] - cw / 2, p.stand && !p.side ? pts[0][1] - ch - 13 : pts[0][1] - ch / 2];
          g.beginPath();
          g.roundRect(x, y, cw, ch, 7 * s);
          g.fillStyle = color(on ? "accent-soft" : "card");
          g.fill();
          g.strokeStyle = color(on ? "accent" : "line-strong");
          g.lineWidth = on ? 2 : 1;
          g.stroke();
          g.beginPath();
          g.roundRect(x, y, 4 * s, ch, [7 * s, 0, 0, 7 * s]);
          g.fillStyle = color(`k-${p.kind}`);
          g.fill();
          g.textAlign = "left";
          g.textBaseline = "middle";
          const cut = (text, font, room) => {
            g.font = font;
            let out = text;
            while (out.length > 3 && g.measureText(out).width > room) out = `${out.slice(0, -2).trimEnd()}…`;
            return out;
          };
          g.fillStyle = color("ink");
          g.fillText(cut(p.name, `600 ${(p.small ? 10.5 : 11.5) * s}px system-ui, -apple-system, "Segoe UI", sans-serif`, cw - 16 * s), x + 10 * s, y + ch * (p.small ? 0.54 : 0.34));
          if (!p.small) ((g.fillStyle = color("ink-3")), g.fillText(cut(p.line, `400 ${9.5 * s}px system-ui, -apple-system, "Segoe UI", sans-serif`, cw - 16 * s), x + 10 * s, y + ch * 0.72));
        }
      }
      g.globalAlpha = 1;
      g.setLineDash([]);
    }
    const ask = () => {
      if (!asked) ((asked = true), requestAnimationFrame(draw));
    };
    function size() {
      const box = canvas.getBoundingClientRect();
      [w, h] = [Math.round(box.width), Math.round(box.height)];
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      fit();
      ask();
    }
    // A finger turns it; two move it in and out. The page scrolls from outside the picture, as in the app.
    const fingers = new Map();
    let apart = 0;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      apart = 0;
    });
    canvas.addEventListener("pointermove", (e) => {
      const was = fingers.get(e.pointerId);
      if (!was) return;
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      if (fingers.size === 1) {
        view.yaw = clamp(view.yaw + (e.clientX - was[0]) * 0.009, -1.9, 1.9);
        view.pitch = clamp(view.pitch + (e.clientY - was[1]) * 0.007, -0.15, 1.45);
      } else if (fingers.size === 2) {
        const [a, b] = [...fingers.values()];
        const now = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (apart) view.zoom = clamp((view.zoom * now) / apart, 0.5, 3.2);
        apart = now;
      }
      ask();
    });
    const up = (e) => (fingers.delete(e.pointerId), (apart = 0));
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener(
      "wheel",
      (e) => {
        // A pinch on a trackpad arrives as a wheel with the control key; a plain wheel is the page's.
        if (!e.ctrlKey) return;
        e.preventDefault();
        view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.01), 0.5, 3.2);
        ask();
      },
      { passive: false },
    );
    canvas.addEventListener("keydown", (e) => {
      const turn = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
      if (turn) ((view.yaw = clamp(view.yaw + turn[0], -1.9, 1.9)), (view.pitch = clamp(view.pitch + turn[1], -0.15, 1.45)));
      else if (e.key === "+" || e.key === "=") view.zoom = clamp(view.zoom * 1.2, 0.5, 3.2);
      else if (e.key === "-") view.zoom = clamp(view.zoom / 1.2, 0.5, 3.2);
      else if (e.key === "0" || e.key === "Home") Object.assign(view, start, { zoom: 1 });
      else return;
      e.preventDefault();
      ask();
    });
    new ResizeObserver(size).observe(canvas);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ask);
    new MutationObserver(ask).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const stage = {
      lit: null,
      set: (list) => ((prims = list), fit(), ask()),
      reset: () => (Object.assign(view, start, { zoom: 1 }), ask()),
      zoom: (by) => ((view.zoom = clamp(view.zoom * by, 0.5, 3.2)), ask()),
      ask,
    };
    return stage;
  }

  /* ── what every view draws alike ─────────────────────────────────────────────────────────────────────────── */
  const KIND = { agent: "agent", check: "check", "human-gate": "gate", merge: "gate", stop: "stop" };
  const hue = (m, loop) => `loop-${(m.loops.findIndex((l) => l.id === loop) % 4) + 1}`;
  const card = (n, at, more = { stand: true }) => ({ t: "card", at, name: n.name, line: n.line, kind: KIND[n.kind], key: `node:${n.id}`, ...more });
  const circle = (c, r, y, n = 40, from = 0, to = TAU) => Array.from({ length: n + 1 }, (_, k) => [c[0] + r * Math.cos(from + ((to - from) * k) / n), y, c[2] + r * Math.sin(from + ((to - from) * k) / n)]);
  // A curve from a to b, lifted in the middle: an edge that leaves the ground to get where it is going.
  const arch = (a, b, lift, n = 16) =>
    Array.from({ length: n + 1 }, (_, k) => {
      const t = k / n;
      const p = lerp(a, b, t);
      return [p[0], p[1] + lift * 4 * t * (1 - t), p[2]];
    });
  const edgeLine = (m, e, pts, more = {}) => ({ t: "line", pts, stroke: e.back ? hue(m, e.back) : "ink-2", dash: e.back ? [6, 4] : undefined, w: e.back ? 1.8 : 1.4, arrow: true, key: `edge:${e.id}`, inset: [2, 1], ...more });
  const along = (pts, t) => {
    const at = clamp(t, 0, 1) * (pts.length - 1);
    const k = Math.min(pts.length - 2, Math.floor(at));
    return lerp(pts[k], pts[k + 1], at - k);
  };
  /* The stations of a loop, in the order of a round: its own nodes, and a loop inside it as one stop. */
  function stations(m, loop) {
    const rank = new Map(m.rows.flat().map((id, k) => [id, k]));
    const inner = m.loops.filter((l) => l.inside === loop.id).map((l) => ({ loop: l, first: Math.min(...l.members.map((id) => rank.get(id))) }));
    return [...loop.own.map((id) => ({ node: id, first: rank.get(id) })), ...inner].sort((a, b) => a.first - b.first);
  }
  /* The top of the graph, left to right in the order of a first pass: nodes in no loop, and loops in no other. */
  function ground(m) {
    const rank = new Map(m.rows.flat().map((id, k) => [id, k]));
    return [...m.nodes.filter((n) => !n.loop).map((n) => ({ node: n.id, first: rank.get(n.id) })), ...m.loops.filter((l) => !l.inside).map((l) => ({ loop: l, first: Math.min(...l.members.map((id) => rank.get(id))) }))].sort((a, b) => a.first - b.first);
  }

  /* ── D0 · the stairs: what the app draws today, with this page's pencil ──────────────────────────────────── */
  function stairs(m) {
    const prims = [];
    const at = {};
    const rank = new Map(m.rows.flat().map((id, k) => [id, k]));
    const first = (l) => Math.min(...l.members.map((id) => rank.get(id)));
    // As the app's own: what is in no loop first, then the loops in the order a first pass meets them. The app also
    // writes each loop's stops on its floor and numbers its arcs; here the stops are under the picture, in a line.
    const sheets = [{ name: m.name, sub: "outside any loop", nodes: m.nodes.filter((n) => !n.loop) }, ...[...m.loops].sort((p, q) => first(p) - first(q) || p.members.length - q.members.length).map((l) => ({ loop: l, name: l.name, sub: `loop${l.inside ? ` inside ${by(m.loops, l.inside).name}` : ""}`, nodes: l.own.map((id) => by(m.nodes, id)) }))].filter((x) => x.nodes.length);
    sheets.forEach((sheet, k) => {
      const rows = Math.ceil(sheet.nodes.length / 3);
      const [y, z0] = [-k * 130, k * 104];
      const width = 3 * 116 + 16;
      const depth = rows * 60 + 30;
      const color = sheet.loop ? hue(m, sheet.loop.id) : "line-strong";
      prims.push({ t: "poly", pts: [[-width / 2, y, z0 - depth / 2], [width / 2, y, z0 - depth / 2], [width / 2, y, z0 + depth / 2], [-width / 2, y, z0 + depth / 2]], fill: sheet.loop ? color : "floor", fa: sheet.loop ? 0.16 : 0.8, stroke: color, key: sheet.loop ? `loop:${sheet.loop.id}` : undefined });
      prims.push({ t: "text", at: [-width / 2 + 2, y - 16, z0 + depth / 2], text: `${sheet.name} · ${sheet.sub}`, fill: sheet.loop ? color : "ink-2", size: 10.5, bold: true, max: 250 });
      sheet.nodes.sort((p, q) => rank.get(p.id) - rank.get(q.id)).forEach((n, i) => {
        const inRow = Math.min(3, sheet.nodes.length - Math.floor(i / 3) * 3);
        at[n.id] = [((i % 3) - (inRow - 1) / 2) * 116, y + 2, z0 - depth / 2 + 34 + Math.floor(i / 3) * 60];
        prims.push(card(n, at[n.id]));
      });
    });
    const paths = {};
    for (const e of m.edges) {
      const [p, q] = [at[e.from], at[e.to]].map((v) => [v[0], v[1] + 40, v[2]]);
      paths[e.id] = arch(p, q, 24 + Math.hypot(p[0] - q[0], p[1] - q[1]) * 0.1 + (e.back ? 22 : 0));
      prims.push(edgeLine(m, e, paths[e.id]));
    }
    return { prims, node: (id) => [at[id][0], at[id][1] + 40, at[id][2]], path: (e) => paths[e] };
  }

  /* ── D1 · rings: a loop is a ring, and a round is one trip round it ──────────────────────────────────────── */
  function rings(m) {
    const prims = [];
    const at = {};
    const ring = {};
    const paths = {};
    // A ring is large enough for its stations, and larger than any ring that stands on it.
    const R = (loop) => Math.max(loop.inside ? 60 : 84, stations(m, loop).length * (loop.inside ? 30 : 40), ...m.loops.filter((l) => l.inside === loop.id).map((l) => R(l) + 30));
    // A station's place on its ring: the first at the far side, where the way in arrives, and on round to the right.
    const where = (c, r, i, k) => [c[0] + r * Math.sin((TAU * i) / k), c[1], c[2] - r * Math.cos((TAU * i) / k)];
    function place(loop, c) {
      const stops = stations(m, loop);
      const r = R(loop);
      ring[loop.id] = { c, r, stops };
      const color = hue(m, loop.id);
      prims.push({ t: "poly", pts: [...circle(c, r + 15, c[1], 48), ...circle(c, r - 15, c[1], 48).reverse()], fill: color, fa: 0.2, key: `loop:${loop.id}` });
      prims.push({ t: "text", at: c, text: `${loop.name}\n${loop.cap ? `max iterations: ${loop.cap}` : "no cap on rounds"}`, align: "center", bold: true, fill: color, size: 10.5, max: r * 1.5 });
      stops.forEach((stop, i) => {
        const p = where(c, r, i, stops.length);
        if (stop.node) ((at[stop.node] = p), prims.push(card(by(m.nodes, stop.node), p)));
        else {
          // A loop inside this one: a ring of its own, standing on this ring where its members would be.
          const up = [p[0], p[1] + 64, p[2]];
          prims.push({ t: "line", pts: [p, up], stroke: hue(m, stop.loop.id), w: 1.2, dash: [2, 3] });
          prims.push({ t: "dot", at: p, r: 4, fill: hue(m, stop.loop.id), lift: -3990 });
          place(stop.loop, up);
        }
      });
    }
    let z = 0;
    for (const item of ground(m)) {
      if (item.node) ((at[item.node] = [0, 0, z]), prims.push(card(by(m.nodes, item.node), at[item.node], { stand: true, side: true })), prims.push({ t: "dot", at: at[item.node], r: 3, fill: "ink-2", lift: -3990 }), (z += 78));
      else {
        // A ring of its own at the first station stands where the way in arrives: room for it.
        const first = stations(m, item.loop)[0].loop;
        const r = R(item.loop) + 26;
        z += first ? R(first) + 24 : 0;
        place(item.loop, [0, 0, z + r - 20]);
        z += 2 * r + 38;
      }
    }
    // Where an edge runs. Inside a ring, to the next station: along the ring. The way back from the last station: the
    // rest of the ring, which is what closes it. Any other way back: an arch across, because it cuts the round short.
    const stationOf = (loop, id) => ring[loop.id].stops.findIndex((stop) => stop.node === id || stop.loop?.members.includes(id));
    for (const e of m.edges) {
      const [p, q] = [at[e.from], at[e.to]];
      const loop = m.loops.filter((l) => l.members.includes(e.from) && l.members.includes(e.to)).sort((x, y) => x.members.length - y.members.length)[0];
      let pts;
      if (loop) {
        const { c, r, stops } = ring[loop.id];
        const [i, j, k] = [stationOf(loop, e.from), stationOf(loop, e.to), stops.length];
        const arc = (from, to) => Array.from({ length: 25 }, (_, n) => where(c, r, from + ((to - from) * n) / 24, k));
        if (i !== j && !e.back && j === i + 1) pts = arc(i, j);
        else if (i !== j && e.back && i === k - 1 && j === 0) pts = arc(i, k);
        // A station that is a ring of its own is entered and left at the node, up on that ring.
        if (pts) pts = [...(stops[i].loop ? [p] : []), ...pts, ...(stops[j % k].loop ? [q] : [])];
      }
      paths[e.id] = pts || arch(p, q, e.back ? 54 : 0, 18);
      prims.push(edgeLine(m, e, paths[e.id]));
    }
    return { prims, node: (id) => at[id], path: (e) => paths[e] };
  }

  /* ── D2 · the spiral and its lid: a round is a turn upward, and a brake is a place on the way up ─────────── */
  function spiral(m, shown) {
    const prims = [];
    const at = {};
    const tower = {};
    const H = 54;
    // The rounds a run has taken of a loop, as far as the slider has come: one more than the last round it was in.
    const taken = (loop) => {
      if (!m.run) return 1;
      const seen = m.run.dispatches.filter((d, n) => loop.own.includes(d.node) && (shown.dispatches === undefined || n < shown.dispatches));
      return seen.length ? Math.max(...seen.map((d) => d.round)) + 1 : 0;
    };
    const R = (loop) => Math.max(64, stations(m, loop).length * 27);
    const on = (t, u, out = 0) => [t.c[0] - (t.r + out) * Math.cos(TAU * u), u * H, t.c[2] + (t.r + out) * Math.sin(TAU * u)];
    const helix = (t, u0, u1) => {
      const n = Math.max(1, Math.ceil(Math.abs(u1 - u0) * 36));
      return Array.from({ length: n + 1 }, (_, k) => on(t, u0 + ((u1 - u0) * k) / n));
    };
    function place(loop, c) {
      const stops = stations(m, loop);
      const k = stops.length;
      const t = (tower[loop.id] = { c, r: R(loop), stops, k });
      const color = hue(m, loop.id);
      const top = loop.cap ?? Math.max(taken(loop), 1) + 2;
      prims.push({ t: "poly", pts: circle(c, t.r + 12, 0), fill: "floor", fa: 0.8, stroke: "line", lift: -400 });
      prims.push({ t: "line", pts: [[c[0], 0, c[2]], [c[0], top * H, c[2]]], stroke: "line-strong", w: 1 });
      // Every round the lid allows, faint; the rounds that were taken (for a template, the first pass), solid.
      prims.push({ t: "line", pts: helix(t, 0, top), stroke: color, w: 1.3, alpha: 0.5, dash: [3, 4] });
      const done = shown.until?.[loop.id] ?? (m.run ? taken(loop) : 1) - 1 + (k - 1) / k;
      if (done > 0) prims.push({ t: "line", pts: helix(t, 0, done), stroke: color, w: 3.2, key: `loop:${loop.id}` });
      // The brakes, each where it is on the way up. The lid: the round at which max iterations stops the loop. A
      // person asked every so many rounds: a ring at each of those rounds. A budget in dispatches: a dashed ring at
      // the rounds it covers when each round is a full one, as the compiler tells a lead to count it; if that is far
      // over the lid it is said in words only.
      const words = [];
      if (loop.cap) {
        prims.push({ t: "poly", pts: circle(c, t.r + 18, loop.cap * H), fill: "brake", fa: 0.24, stroke: "brake", w: 1.8, lift: 300 });
        words.push(`max iterations: ${loop.cap} (the lid)`);
      } else words.push("no lid: no cap on rounds");
      if (loop.human) {
        // At the lid's own round too, where the person is asked before the cap is looked at: a ring inside the lid.
        for (let u = loop.human; u <= top; u += loop.human) prims.push({ t: "line", pts: circle(c, t.r + (u === loop.cap ? 9 : 18), u * H), stroke: "k-gate", w: 2.2, lift: 320 });
        words.push(`a person is asked every ${loop.human} rounds (the amber ring${top >= loop.human * 2 ? "s" : ""})`);
      }
      let over = top;
      if (loop.budget?.measure === "dispatches" && loop.perRound) {
        const [full, more] = [Math.floor(loop.budget.limit / loop.perRound), loop.budget.limit % loop.perRound];
        const u = loop.budget.limit / loop.perRound;
        const drawn = u <= top + 1.5;
        if (drawn) (prims.push({ t: "line", pts: circle(c, t.r + 18, u * H), stroke: "brake", w: 1.2, dash: [4, 4], alpha: 0.85 }), (over = Math.max(over, u)));
        words.push(`budget: ${loop.budget.limit} dispatches, ${full} full round${full === 1 ? "" : "s"}${more ? ` and ${more} more` : ""} (${drawn ? "dashed" : "far above the lid, not drawn"})`);
      }
      // The loop's name and its brakes, in one block over the spiral. Two spirals side by side say theirs at two
      // heights, so that neither is written over the other.
      const raise = (Object.keys(tower).length - 1) % 2 ? 78 : 0;
      prims.push({ t: "text", at: [c[0], over * H + 30 + raise, c[2]], text: [`${loop.name}${m.run ? ` · ${taken(loop)} of ${loop.cap ?? "any number of"} rounds taken` : ""}`, ...words].join("\n"), align: "center", up: true, heads: 1, headFill: color, fill: "brake", size: 10.5, bold: true, max: Math.max(138, 2 * t.r + 30) });
      if (raise) prims.push({ t: "line", pts: [[c[0], over * H + 6, c[2]], [c[0], over * H + raise + 18, c[2]]], stroke: "brake", w: 1, alpha: 0.5 });
      stops.forEach((stop, i) => {
        if (stop.node) ((at[stop.node] = ((p) => [p[0], p[1] - 30, p[2]])(on(t, i / k, 46))), prims.push(card(by(m.nodes, stop.node), at[stop.node])), prims.push({ t: "line", pts: [on(t, i / k), on(t, i / k, 30)], stroke: color, w: 1, alpha: 0.7 }));
        else prims.push({ t: "text", at: on(t, i / k, 34), text: `${stop.loop.name}: the spiral beside`, align: "center", fill: hue(m, stop.loop.id), size: 10.5, bold: true, max: 96 });
      });
      // A run's dispatches, each a bead where it happened: the round it was in, and whether it passed.
      if (m.run)
        m.run.dispatches.forEach((d, n) => {
          const i = stops.findIndex((stop) => stop.node === d.node);
          if (i < 0 || (shown.dispatches !== undefined && n >= shown.dispatches)) return;
          prims.push({ t: "dot", at: on(t, d.round + i / k), r: 6, fill: d.outcome === "fail" ? "bad" : "ok", stroke: "card" });
        });
    }
    // The ground: what comes before the loops recedes behind the first spiral, the spirals stand side by side (one
    // inside another stands before it: its rounds start afresh each time the outer one comes round), and what
    // comes after them comes forward.
    const order = [];
    const nest = (loop) => (m.loops.filter((l) => l.inside === loop.id).forEach(nest), order.push({ loop }));
    for (const item of ground(m)) item.node ? order.push(item) : nest(item.loop);
    const firstLoop = order.findIndex((item) => item.loop);
    const lastLoop = order.length - 1 - [...order].reverse().findIndex((item) => item.loop);
    let x = 0;
    order.forEach((item, n) => {
      if (item.loop) {
        const r = R(item.loop) + 40;
        place(item.loop, [x + r, 0, 0]);
        x += 2 * r + 56;
      } else if (n > firstLoop && n < lastLoop) ((at[item.node] = [x + 50, 0, 0]), (x += 130));
    });
    order.slice(0, Math.max(0, firstLoop)).reverse().forEach((item, n) => (at[item.node] = [-70 - n * 24, 0, -150 - n * 150]));
    order.slice(lastLoop + 1).forEach((item, n) => (at[item.node] = [x - 6 + n * 24, 0, 170 + n * 150]));
    // What is in no loop is small here: this view is of the loops.
    for (const item of order) if (item.node) (prims.push(card(by(m.nodes, item.node), at[item.node], { stand: true, side: true, small: true })), prims.push({ t: "dot", at: at[item.node], r: 3, fill: "ink-2", lift: -3990 }));
    // Where a node is in a given round: on its own loop's spiral, that many turns up.
    const spot = (id, round = 0) => {
      const loop = by(m.loops, by(m.nodes, id).loop);
      if (!loop) return at[id];
      const t = tower[loop.id];
      return on(t, round + t.stops.findIndex((stop) => stop.node === id) / t.k);
    };
    const round = (e) => m.loops.find((l) => l.own.includes(e.from) && l.own.includes(e.to));
    const path = (id, r0 = 0, r1 = 0) => {
      const e = by(m.edges, id);
      const loop = round(e);
      if (loop) {
        const t = tower[loop.id];
        const [i, j] = [t.stops.findIndex((stop) => stop.node === e.from), t.stops.findIndex((stop) => stop.node === e.to)];
        // Onward round the spiral when that is where the edge goes. A way back from the middle of a round still
        // arrives one turn up, by the short way across.
        if ((!e.back && j === i + 1) || (e.back && i === t.k - 1 && j === 0)) return helix(t, r0 + i / t.k, (e.back ? r0 + 1 : r1) + j / t.k);
        return arch(on(t, r0 + i / t.k), on(t, r1 + j / t.k), 26, 18);
      }
      // Between a loop and what is outside it, or between two loops: from where each is in its round. A way back
      // into a loop inside the one it belongs to arrives at that loop's first round: its rounds start afresh.
      const rise = (node, r) => (by(m.nodes, node).loop ? r : 0);
      return arch(spot(e.from, rise(e.from, r0)), spot(e.to, e.back ? 0 : rise(e.to, r1)), e.back ? 40 : 0, 18);
    };
    // The edges. A template's are drawn as they are in round 0. A run's are drawn where the run took them, in the
    // round it took them, as far as the slider has come; one it never took is faint, at round 0. An edge that is
    // the spiral itself is not drawn twice: it is shown when it is the one a step is about.
    const drawn = new Set();
    const line = (e, r0, r1, more = {}) => {
      const key = `edge:${e.id}@${r0}`;
      if (drawn.has(key)) return;
      drawn.add(key);
      const hidden = round(e) && !e.back && !shown.lit?.has(key);
      prims.push(edgeLine(m, e, path(e.id, r0, r1), { key, ...(round(e) && !e.back ? { hide: hidden, stroke: hue(m, round(e).id), w: 3.2 } : {}), ...more }));
    };
    for (const e of m.edges) {
      const took = (shown.took || []).filter((x) => x.edge === e.id && (shown.k === undefined || shown.k === 0 || x.step <= shown.k));
      if (!m.run) line(e, 0, e.back ? 1 : 0);
      else if (took.length) for (const x of took) line(e, x.r0, x.r1);
      else if (!(shown.took || []).some((x) => x.edge === e.id)) line(e, 0, e.back ? 1 : 0, { alpha: 0.3 });
    }
    // A note about an edge the run has not walked yet at this point is shown where the run stood.
    if (shown.about) line(by(m.edges, shown.about.edge), shown.about.r0, shown.about.r0);
    return { prims, node: spot, path };
  }

  /* ── D3 · panes: the flat picture, with each loop and each box lifted toward the eye ─────────────────────── */
  function panes(m) {
    const prims = [];
    const at = {};
    const members = (group) => group.members.flatMap((id) => (by(m.groups, id) ? members(by(m.groups, id)) : [id]));
    const boxes = [...m.loops.map((l) => ({ loop: l, name: l.name, ids: l.members, sub: "loop" })), ...m.groups.map((group) => ({ group, name: group.name, ids: members(group), sub: group.from ? `subgrooph, from ${group.from}` : "group" }))];
    // A box is inside another that holds all of its nodes and more; a loop with the very nodes of a subgrooph is inside it.
    const holds = (outer, inner) => outer !== inner && inner.ids.every((id) => outer.ids.includes(id)) && (outer.ids.length > inner.ids.length || (!!outer.group && !!inner.loop));
    for (const box of boxes) box.depth = boxes.filter((outer) => holds(outer, box)).length + 1;
    const depth = (id) => Math.max(0, ...boxes.filter((box) => box.ids.includes(id)).map((box) => box.depth));
    const STEP = 84;
    for (const n of m.nodes) at[n.id] = [n.at[0] * 0.62 + 62, -n.at[1] * 0.4, depth(n.id) * STEP];
    for (const n of m.nodes) prims.push(card(n, at[n.id], {}));
    const around = (ids, pad) => {
      const pts = ids.map((id) => at[id]);
      return [Math.min(...pts.map((p) => p[0])) - 58 - pad, Math.max(...pts.map((p) => p[0])) + 58 + pad, Math.min(...pts.map((p) => p[1])) - 22 - pad, Math.max(...pts.map((p) => p[1])) + 22 + pad];
    };
    // The picture's own plane, where the nodes in no loop and no box stay: what the panes are seen to be lifted from.
    const [gx0, gx1, gy0, gy1] = around(m.nodes.map((n) => n.id), 42);
    prims.push({ t: "poly", pts: [[gx0, gy0, -8], [gx1, gy0, -8], [gx1, gy1, -8], [gx0, gy1, -8]], fill: "floor", fa: 0.7, stroke: "line-strong", lift: -600 });
    prims.push({ t: "text", at: [gx0 + 4, gy1 + 10, -8], text: "the picture", fill: "ink-3", size: 10 });
    for (const box of boxes) {
      const [x0, x1, y0, y1] = around(box.ids, 8 + (4 - Math.min(4, box.depth)) * 9);
      const z = box.depth * STEP - 12;
      const color = box.loop ? hue(m, box.loop.id) : "ink-3";
      prims.push({ t: "poly", pts: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: color, fa: box.loop ? 0.15 : 0.08, stroke: color, dash: box.loop ? undefined : [5, 4], w: 1.3, key: box.loop ? `loop:${box.loop.id}` : undefined, lift: box.depth * 30 - 80 });
      prims.push({ t: "text", at: [x0 + 4, box.depth % 2 ? y1 + 10 : y0 - 10, z], text: `${box.name} · ${box.sub}`, fill: color, size: 10.5, bold: true, max: 200 });
      // Its shadow on the picture: where the picture draws its outline.
      prims.push({ t: "line", pts: [[x0, y0, -8], [x1, y0, -8], [x1, y1, -8], [x0, y1, -8], [x0, y0, -8]], stroke: color, w: 1, dash: [2, 4], alpha: 0.6 });
    }
    const paths = {};
    for (const e of m.edges) {
      const [p, q] = [at[e.from], at[e.to]];
      // A way back bows out to the side, as it does on the flat picture.
      const bow = 70 + Math.abs(p[1] - q[1]) * 0.2;
      paths[e.id] = e.back ? Array.from({ length: 19 }, (_, n) => ((v) => [v[0] + bow * 4 * (n / 18) * (1 - n / 18), v[1], v[2]])(lerp([p[0] + 50, p[1], p[2]], [q[0] + 50, q[1], q[2]], n / 18))) : [p, q];
      prims.push(edgeLine(m, e, paths[e.id], { inset: e.back ? [4, 8] : [20, 24] }));
    }
    return { prims, node: (id) => at[id], path: (e) => paths[e] };
  }

  /* ── D4 · columns: a node is as tall as what it costs ────────────────────────────────────────────────────── */
  function columns(m, shown) {
    const prims = [];
    const foot = {};
    const TIER = { frontier: 104, strong: 68, fast: 34, unset: 68 };
    const box = (c, wide, deep, y0, y1, fill, more = {}) => {
      const [x0, x1, z0, z1] = [c[0] - wide / 2, c[0] + wide / 2, c[2] - deep / 2, c[2] + deep / 2];
      const side = (pts, fa) => prims.push({ t: "poly", pts, fill, fa, stroke: "panel", w: 0.8, ...more });
      side([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], 0.5);
      side([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 0.62);
      side([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], 0.62);
      side([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0.8);
      side([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 1);
    };
    for (const n of m.nodes) {
      const c = (foot[n.id] = [n.at[0] * 0.6 + 60, 0, n.at[1] * 0.6]);
      let top = 5;
      if (m.run) {
        box(c, 66, 42, 0, 4, "floor");
        top = 4;
        m.run.dispatches.forEach((d, k) => {
          if (d.node !== n.id || (shown.dispatches !== undefined && k >= shown.dispatches)) return;
          const tall = Math.max(3, d.minutes * 7.5);
          box(c, 58, 36, top, top + tall, d.outcome === "fail" ? "bad" : "ok", { key: `node:${n.id}` });
          prims.push({ t: "text", at: [c[0] + 36, top + tall / 2, c[2] + 18], text: `round ${d.round}: ${d.minutes} min${d.outcome === "fail" ? ", fail" : ""}`, size: 10, fill: "ink-2", max: 120 });
          top += tall + 2;
        });
      } else if (n.tier) {
        top = TIER[n.tier];
        box(c, 58, 36, 0, top, "k-agent", { key: `node:${n.id}`, alpha: n.tier === "unset" ? 0.4 : 1 });
        prims.push({ t: "text", at: [c[0] + 38, top / 2, c[2] + 18], text: n.tier === "unset" ? "session default" : n.tier, size: 10, fill: "ink-2" });
      } else box(c, 58, 36, 0, 5, "floor", { key: `node:${n.id}` });
      prims.push(card(n, [c[0], top + 2, c[2]]));
    }
    for (const loop of m.loops) {
      const pts = loop.members.map((id) => foot[id]);
      const grow = loop.inside ? 0 : 12;
      const [x0, x1, z0, z1] = [Math.min(...pts.map((p) => p[0])) - 48 - grow, Math.max(...pts.map((p) => p[0])) + 48 + grow, Math.min(...pts.map((p) => p[2])) - 38 - grow, Math.max(...pts.map((p) => p[2])) + 38 + grow];
      prims.push({ t: "poly", pts: [[x0, -1, z0], [x1, -1, z0], [x1, -1, z1], [x0, -1, z1]], fill: hue(m, loop.id), fa: 0.14, stroke: hue(m, loop.id), key: `loop:${loop.id}`, lift: -600 });
      prims.push({ t: "text", at: [x0 - 4, 0, z1], text: loop.name, align: "right", fill: hue(m, loop.id), size: 10.5, bold: true });
    }
    const paths = {};
    const side = (id) => [foot[id][0] - 42, 1, foot[id][2]];
    for (const e of m.edges) {
      const [p, q] = [side(e.from), side(e.to)];
      const bow = 34 + Math.abs(p[2] - q[2]) * 0.16;
      paths[e.id] = e.back ? Array.from({ length: 19 }, (_, n) => ((v) => [v[0] - bow * 4 * (n / 18) * (1 - n / 18), v[1], v[2]])(lerp(p, q, n / 18))) : [p, q];
      prims.push(edgeLine(m, e, paths[e.id]));
    }
    return { prims, node: side, path: (e) => paths[e] };
  }

  /* ── the page: one switch of documents over five views, each with its own stage and its own slider ───────── */
  const VIEWS = { stairs: [stairs, { yaw: -0.46, pitch: 0.46 }], rings: [rings, { yaw: -0.5, pitch: 0.86 }], spiral: [spiral, { yaw: -0.42, pitch: 0.3 }], panes: [panes, { yaw: -0.86, pitch: 0.16 }], columns: [columns, { yaw: -0.62, pitch: 0.44 }] };
  let doc = 0;
  let playing = null;
  const all = [...document.querySelectorAll("[data-view]")].map((root) => {
    const [build, start] = VIEWS[root.dataset.view];
    const canvas = root.querySelector("canvas");
    const stage = Stage(canvas, start);
    const range = root.querySelector('input[type="range"]');
    const says = root.querySelector("output");
    const play = root.querySelector('[data-do="play"]');
    let steps = [];
    let took = [];
    let made;
    let timer = 0;
    let frame = 0;
    const m = () => DATA[doc];
    function show(k, move = true) {
      const step = steps[(k = clamp(k, 0, steps.length - 1))];
      range.value = String(k);
      says.textContent = step.says;
      // A run is drawn as far as the note it is at; step 0 is all of it.
      const shown = {};
      shown.k = k;
      shown.took = took;
      if (step.about && step.edge) shown.about = { edge: step.edge, r0: step.r0 ?? 0 };
      if (m().run && k > 0) {
        shown.dispatches = steps.slice(1, k + 1).filter((s) => s.dispatch !== undefined).length;
        shown.until = {};
        const last = [...steps.slice(1, k + 1)].reverse().find((s) => s.to);
        for (const loop of m().loops) shown.until[loop.id] = last && loop.own.includes(last.to) ? last.r1 + stations(m(), loop).findIndex((s) => s.node === last.to) / stations(m(), loop).length : last && !by(m().nodes, last.to).loop ? undefined : 0.001;
      }
      // An edge is lit by its name, and in the spiral by its name and the round it is taken in.
      stage.lit = shown.lit = k === 0 ? null : new Set([...(step.nodes || []).map((id) => `node:${id}`), ...(step.edge ? [`edge:${step.edge}`, `edge:${step.edge}@${step.r0 ?? 0}`] : []), ...(step.loops || []).map((id) => `loop:${id}`)]);
      made = build(m(), shown);
      const prims = made.prims;
      // What is at this step travels to it: along the edge it took, or it is simply where the note is.
      cancelAnimationFrame(frame);
      const route = step.edge && !step.about ? made.path(step.edge, step.r0, step.r1) : step.to ? [made.node(step.to, step.r1), made.node(step.to, step.r1)] : null;
      if (!route) return stage.set(prims);
      // A ring, so that what it stands on (a run's bead, amber for a fail) is seen through it.
      const token = { t: "dot", at: route[0], r: 9.5, stroke: "accent", w: 3 };
      stage.set([...prims, token]);
      if (!move || still()) return ((token.at = route[route.length - 1]), stage.ask());
      const from = performance.now();
      const go = (now) => {
        const t = clamp((now - from) / 620, 0, 1);
        token.at = along(route, 1 - (1 - t) ** 3);
        stage.ask();
        if (t < 1) frame = requestAnimationFrame(go);
      };
      frame = requestAnimationFrame(go);
    }
    const stop = () => (clearInterval(timer), (timer = 0), (play.textContent = "Play"), play.setAttribute("aria-pressed", "false"), playing === api && (playing = null));
    const api = {
      load() {
        stop();
        steps = stepsOf(m());
        // The edges a run took, each with the rounds it was taken between and the step it was taken at.
        took = m().run ? steps.flatMap((step, n) => (step.edge && !step.about ? [{ edge: step.edge, r0: step.r0, r1: step.r1, step: n }] : [])) : [];
        range.max = String(steps.length - 1);
        const also = root.querySelector("[data-also]");
        if (also) also.textContent = m().loops.map((loop) => `${loop.name} stops on: ${loop.stops.map((x) => x.words).join("; ")}.`).join(" ");
        canvas.setAttribute("aria-label", `${root.dataset.name}: ${m().name}, drawn in three dimensions. Drag to turn it, pinch to move in and out; the arrow keys turn it too.`);
        show(0, false);
      },
      stop,
    };
    play.addEventListener("click", () => {
      if (timer) return stop();
      playing?.stop();
      playing = api;
      play.textContent = "Pause";
      play.setAttribute("aria-pressed", "true");
      if (Number(range.value) >= steps.length - 1) show(0, false);
      const next = () => (Number(range.value) >= steps.length - 1 ? stop() : show(Number(range.value) + 1));
      next();
      timer = setInterval(next, 1150);
    });
    root.querySelector('[data-do="prev"]').addEventListener("click", () => (stop(), show(Number(range.value) - 1)));
    root.querySelector('[data-do="next"]').addEventListener("click", () => (stop(), show(Number(range.value) + 1)));
    root.querySelector('[data-do="reset"]').addEventListener("click", () => stage.reset());
    root.querySelector('[data-do="in"]').addEventListener("click", () => stage.zoom(1.25));
    root.querySelector('[data-do="out"]').addEventListener("click", () => stage.zoom(0.8));
    range.addEventListener("input", () => (stop(), show(Number(range.value), false)));
    return api;
  });
  const picks = [...document.querySelectorAll("[data-doc]")];
  const pick = (k) => {
    doc = k;
    picks.forEach((b, i) => b.setAttribute("aria-checked", String(i === k)));
    document.querySelector("[data-about]").textContent = DATA[k].about;
    all.forEach((v) => v.load());
  };
  picks.forEach((b, k) => b.addEventListener("click", () => pick(k)));
  pick(0);
})();
