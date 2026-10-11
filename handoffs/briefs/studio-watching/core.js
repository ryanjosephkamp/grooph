/* The watching studio's shared part (slice 0109): the samples made ready, the session at one moment, the words for
   a moment, and the small things every drawing draws with. build.mjs puts this file, the six drawings and boot.js
   into one script, in that order, inside one function: a name defined here is in reach of all of them.

   A drawing is a function `(P, v, W, o) => { h, body }`: P is a sample made ready, v is the session at one moment,
   W is the stage's width in CSS pixels, o is `{ said, sel }`. It returns the height it wants and the inside of an
   SVG that is W wide. It is drawn again at every moment; nothing is kept between two. */
const DATA = window.STUDIO_DATA;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = (v) => Math.round(v * 10) / 10;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** A model's name as the record has it, in the words a person uses. */
function modelOf(name) {
  const m = /^claude-([a-z]+)-(\d+)-(\d+)/.exec(name ?? "");
  if (!m) return { key: "none", name: "model not known", short: "?", letter: "?" };
  return { key: ["opus", "sonnet", "haiku"].includes(m[1]) ? m[1] : "none", name: `${cap(m[1])} ${m[2]}.${m[3]}`, short: cap(m[1]), letter: m[1][0].toUpperCase() };
}

/** A length of time. The page shows no clock: every time is how long since the session's first moment. */
function dur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 600) return `${Math.floor(s / 60)} m ${String(s % 60).padStart(2, "0")} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} m`;
  if (m < 1440) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`;
  return `${Math.floor(m / 1440)} d ${String(Math.floor((m % 1440) / 60)).padStart(2, "0")} h`;
}
/** The same, as short as it can be said: for a label inside a drawing. */
function short(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 100) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 100) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
  return `${Math.floor(m / 1440)}d${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}h`;
}
const NUMBER = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const num = (n) => NUMBER[n] ?? String(n);
const count = (n, word) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];

/** Runs with less than this between them are one burst of work. The page's own reading: no record says "burst". */
const BURST_GAP = 10 * 60 * 1000;

/** A sample made ready: its agents with their models and children, its moments in order, its bursts, its made-up statements. */
function prepare(sample) {
  const agents = sample.agents.map((a, k) => ({ ...a, k, m: modelOf(a.model), kids: [] }));
  const byId = new Map(agents.map((a) => [a.id, a]));
  for (const a of agents) if (a.parent) byId.get(a.parent).kids.push(a.id);
  const plans = (DATA.said[sample.id] ?? []).map((p, k) => ({ ...p, k, at: Math.max(0, byId.get(p.before).runs[0].from - p.seconds * 1000) }));

  const moments = [{ t: 0, kind: "begin", order: 0 }];
  for (const p of plans) moments.push({ t: p.at, kind: "said", plan: p.k, order: 1 });
  for (const a of agents) {
    a.runs.forEach((r, k) => {
      moments.push({ t: r.from, kind: k === 0 ? "start" : "resume", id: a.id, run: k, order: 3 });
      moments.push({ t: r.to, kind: r.end === "failed" ? "fail" : "stop", id: a.id, run: k, order: 2 });
    });
    if (a.parentKnown !== null) moments.push({ t: a.parentKnown, kind: "known", id: a.id, order: 4 });
  }
  moments.push({ t: Math.max(sample.ended, ...moments.map((m) => m.t)), kind: "end", order: 9 });
  moments.sort((a, b) => a.t - b.t || a.order - b.order);
  moments.forEach((m, i) => (m.i = i));

  const runs = agents.flatMap((a) => a.runs.map((r, k) => ({ id: a.id, k, from: r.from, to: r.to, end: r.end }))).sort((a, b) => a.from - b.from);
  const bursts = [];
  for (const r of runs) {
    const b = bursts.at(-1);
    if (b && r.from - b.to < BURST_GAP) {
      b.to = Math.max(b.to, r.to);
      b.runs.push(r);
    } else bursts.push({ k: bursts.length, from: r.from, to: r.to, runs: [r] });
  }
  for (const b of bursts) {
    b.ids = [...new Set(b.runs.map((r) => r.id))];
    const edges = b.runs.flatMap((r) => [[r.from, 1], [r.to, -1]]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let now = 0;
    b.most = 0;
    for (const [, d] of edges) b.most = Math.max(b.most, (now += d));
  }
  const most = Math.max(...bursts.map((b) => b.most));
  const longest = Math.max(...agents.map((a) => a.runs.reduce((t, r) => t + r.to - r.from, 0)));
  return { sample, id: sample.id, agents, byId, plans, moments, bursts, most, longest, lead: modelOf(sample.lead), cache: new Map() };
}

/** The burst a time is in, or the last one begun before it, or the first. */
const burstAt = (P, t) => [...P.bursts].reverse().find((b) => b.from <= t) ?? P.bursts[0];

/** The session at moment i: what exists, what is running, what has finished, and what is known. */
function viewAt(P, i, saidOn) {
  const mo = P.moments[i];
  const state = new Map(P.agents.map((a) => [a.id, { a, exists: false, state: "absent", runs: 0, since: null, ran: 0, known: a.parentKnown === null, fresh: false, unsaid: false }]));
  const said = [];
  for (let k = 0; k <= i; k++) {
    const e = P.moments[k];
    const s = e.id ? state.get(e.id) : null;
    if (e.kind === "start" || e.kind === "resume") Object.assign(s, { exists: true, state: "running", runs: e.run + 1, since: e.t });
    else if (e.kind === "stop" || e.kind === "fail") Object.assign(s, { state: e.kind === "fail" ? "failed" : "done", since: null });
    else if (e.kind === "known") s.known = true;
    else if (e.kind === "said") said.push(P.plans[e.plan]);
  }
  for (const s of state.values()) {
    if (!s.exists) continue;
    s.ran = s.a.runs.slice(0, s.runs).reduce((t, r, k) => t + (k === s.runs - 1 && s.state === "running" ? mo.t - r.from : r.to - r.from), 0);
    s.fresh = mo.id === s.a.id;
  }
  const ghosts = saidOn ? said.flatMap((p) => p.never.map((g) => ({ ...g, plan: p.k, fresh: mo.kind === "said" && mo.plan === p.k }))) : [];
  if (saidOn) for (const p of said) for (const id of p.unsaid) state.get(id).unsaid = state.get(id).exists;
  const all = [...state.values()].filter((s) => s.exists);
  return {
    i, t: mo.t, mo, of: state, all, said: saidOn ? said : [], saidOn, ghosts,
    running: all.filter((s) => s.state === "running"),
    working: P.sample.turns.some(([a, b]) => a <= mo.t && mo.t < b),
    ended: mo.kind === "end",
    burst: burstAt(P, mo.t),
  };
}

/** What a made-up statement says, in a sentence. */
function planWords(p, byId) {
  const types = new Map();
  for (const type of [...p.covers.map((id) => byId.get(id).type), ...p.never.map((g) => g.type)]) types.set(type, (types.get(type) ?? 0) + 1);
  return [...types].map(([type, n]) => `${num(n)} ${type}`).join(" and ");
}

/** A moment in a sentence: what changed, as the record has it. HTML: ids are set in <b>. */
function sayMoment(P, v) {
  const mo = v.mo;
  const a = mo.id ? P.byId.get(mo.id) : null;
  const who = a ? `<b>${a.id}</b>` : "";
  const by = a ? (a.parent ? `<b>${a.parent}</b>` : "the session") : "";
  const head = `Moment ${v.i + 1} of ${P.moments.length} · ${dur(mo.t)} in. `;
  const n = v.running.length;
  const tail = n === 0 ? " Nothing is running." : ` ${cap(num(n))} running.`;
  if (mo.kind === "begin") return `${head}The session begins on ${P.lead.name}. Nothing has been started yet. Press Play.`;
  if (mo.kind === "end") return `${head}The last line of the record: ${count(P.agents.length, "subagent")}, ${count(P.agents.reduce((t, x) => t + x.runs.length, 0), "run")}${P.agents.some((x) => x.runs.some((r) => r.end === "failed")) ? ", one of them failed" : ""}.`;
  if (mo.kind === "said") {
    const p = P.plans[mo.plan];
    if (!v.saidOn) return `${head}Nothing changes in the record here. With Said on, a made-up statement stands at this moment.${tail}`;
    return `${head}<i>Made up, to show the place:</i> the session says it will start ${planWords(p, P.byId)}.${tail}`;
  }
  if (mo.kind === "start") {
    const late = a.parentKnown !== null ? ` The hook does not know yet who started it (it learns when ${a.id} ends); the harness's own file says ${a.parent ?? "the session"}.` : "";
    const before = !a.hook.start ? " The hook was not installed yet: only the harness's own files have this one." : "";
    return `${head}${cap(by)} starts ${who} in the ${a.shape}: ${a.type} on ${a.m.name}.${late}${before}${tail}`;
  }
  if (mo.kind === "resume") return `${head}${who} is resumed: its ${ORDINAL[mo.run + 1] ?? `${mo.run + 1}th`} run.${tail}`;
  if (mo.kind === "known") return `${head}The hook learns that <b>${a.parent}</b> started ${who}, ${dur(mo.t - a.runs[0].from)} after it began: a foreground call is written down when it returns.${tail}`;
  const took = dur(a.runs[mo.run].to - a.runs[mo.run].from);
  if (mo.kind === "fail") return `${head}${who} fails after ${took}. The hook has no stop line for it; the harness's own files say how it ended.${tail}`;
  return `${head}${who} is done after ${took}${a.runs.length > 1 ? ` (run ${mo.run + 1})` : ""}.${tail}`;
}

/** One agent at this moment, in a line: for the place under a drawing when one is touched. */
function sayAgent(P, v, id) {
  const ghost = v.ghosts.find((g) => g.id === id);
  if (ghost) return `Made up: a ${ghost.type} subagent the session said it would start and never did. Nothing in the record answers it.`;
  if (id === "session") return `The session itself, on ${P.lead.name}: the one in charge. It ${v.ended ? "has ended" : v.working ? "is in a turn of its own" : "is between turns"}. Everything it started is tied to it.`;
  const s = v.of.get(id);
  if (!s || !s.exists) return "";
  const a = s.a;
  const source = !a.hook.start ? "in the harness's files only (it ran before the hook was installed)" : !a.hook.stop && s.state !== "running" ? "its start by the hook, its end by the harness's files only" : "by the hook and in the harness's files";
  const state = s.state === "running" ? `running for ${dur(v.t - s.since)}` : s.state === "failed" ? "failed" : "done";
  return `${a.id} · ${a.type} · ${a.m.name}${a.asked ? ` (the call asked for ${a.asked})` : " (the call named no model)"} · ${a.shape} · started by ${a.parent ?? "the session"}${s.known ? "" : " (not yet known to the hook)"} · ${state}${s.runs > 1 ? `, run ${s.runs}` : ""}, ${dur(s.ran)} in all · seen ${source}${s.unsaid ? " · made up: never said" : ""}.`;
}

/* ── small things every drawing draws with ─────────────────────────────────────────────────────────────────── */
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== false && v !== null).map(([k, v]) => ` ${k}="${v}"`).join("");
const tag = (name, o, inner) => (inner === undefined ? `<${name}${attrs(o)}/>` : `<${name}${attrs(o)}>${inner}</${name}>`);
const text = (x, y, s, o = {}) => tag("text", { x: r1(x), y: r1(y), "font-size": o.size ?? 10, "text-anchor": o.anchor, "font-weight": o.weight, class: o.class, "data-id": o.id }, s);
const line = (x1, y1, x2, y2, o = {}) => tag("line", { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), ...o });
const path = (d, o = {}) => tag("path", { d, ...o });
/** A small red cross: a run that failed. */
const cross = (x, y, r = 4) => `<g class="s-bad" stroke-width="2" stroke-linecap="round">${line(x - r, y - r, x + r, y + r)}${line(x - r, y + r, x + r, y - r)}</g>`;
/** A small amber diamond: seen, and never said (made up on this page). */
const diamond = (x, y, r = 4.5) => path(`M${r1(x)} ${r1(y - r)}L${r1(x + r)} ${r1(y)}L${r1(x)} ${r1(y + r)}L${r1(x - r)} ${r1(y)}Z`, { class: "s-said f-said", "stroke-width": 1.5 });
/** How many runs so far, when more than one: a small plate. */
const plate = (x, y, n) => `${tag("rect", { x: r1(x - 6.5), y: r1(y - 6), width: 13, height: 12, rx: 4, class: "f-ink" })}${text(x, y + 3.2, n, { size: 8.5, anchor: "middle", weight: 700, class: "mono t-plate" })}`;
/** An agent's classes: its model, its state, whether this moment is about it. */
const cls = (s, more = "") => `m-${s.a.m.key} is-${s.state}${more ? ` ${more}` : ""}`;
/** The elbow that hangs one thing under another. */
const elbow = (x1, y1, x2, y2) => `M${r1(x1)} ${r1(y1)}V${r1(y2 - 6)}Q${r1(x1)} ${r1(y2)} ${r1(x1 + Math.sign(x2 - x1) * 6)} ${r1(y2)}H${r1(x2)}`;

const DRAW = {};
