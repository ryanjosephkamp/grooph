/* The watching studio's page (slice 0109): one clock for all six drawings, the switch of sessions, the made-up
   statements' switch, and each drawing's own bar. The last part of the page's one script (build.mjs). */
const READY = DATA.samples.map(prepare);
/** Where each sample opens: a moment that has something running and something finished. */
const OPENS = { small: (P) => P.moments.findIndex((m) => m.kind === "stop" && m.id === "a04"), large: (P) => P.moments.findIndex((m) => m.kind === "start" && m.id === "a16"), resumed: (P) => P.moments.findIndex((m) => m.kind === "resume" && m.id === "a10") };
const state = { s: 0, i: 0, said: true, sel: null, playing: null, timer: null };
const views = [...document.querySelectorAll("[data-view]")].map((el) => ({
  el,
  draw: DRAW[el.dataset.view],
  stage: el.querySelector(".stage"),
  says: el.querySelector(".says"),
  who: el.querySelector(".who"),
  range: el.querySelector('input[type="range"]'),
  play: el.querySelector('[data-do="play"]'),
  seen: true,
  stale: true,
}));
const P = () => READY[state.s];

function paint(view) {
  const p = P();
  const v = viewAt(p, state.i, state.said);
  const W = Math.max(280, Math.round(view.stage.clientWidth));
  const { h, body } = view.draw(p, v, W, { said: state.said, sel: state.sel });
  view.stage.innerHTML = `<svg viewBox="0 0 ${W} ${Math.ceil(h)}" width="${W}" height="${Math.ceil(h)}" role="img" aria-label="${view.el.dataset.name}: ${p.sample.name}, ${dur(v.t)} in, ${v.running.length} running, ${v.all.length - v.running.length} finished">${body}</svg>`;
  view.says.innerHTML = sayMoment(p, v);
  view.who.textContent = state.sel ? sayAgent(p, v, state.sel) : "Touch anything in the drawing to read what the record has of it.";
  view.range.max = String(p.moments.length - 1);
  view.range.value = String(state.i);
  view.play.setAttribute("aria-pressed", String(state.playing === view));
  view.play.textContent = state.playing === view ? "Pause" : "Play";
  view.stale = false;
}
/** Draw what is on the screen now; what is not is drawn when it comes. */
function refresh() {
  for (const view of views) {
    view.stale = true;
    if (view.seen) paint(view);
  }
}
function stop() {
  clearInterval(state.timer);
  state.timer = null;
  state.playing = null;
}
function go(i) {
  state.i = clamp(i, 0, P().moments.length - 1);
  refresh();
}
function play(view) {
  if (state.playing === view) {
    stop();
    return refresh();
  }
  stop();
  state.playing = view;
  if (state.i >= P().moments.length - 1) state.i = 0;
  // The whole of a long session in about half a minute; a short one a step at a time. With reduced motion, one
  // step a second and nothing between two steps.
  const every = still() ? 1000 : clamp(32000 / P().moments.length, 170, 800);
  state.timer = setInterval(() => {
    if (state.i >= P().moments.length - 1) stop();
    else state.i += 1;
    refresh();
  }, every);
  refresh();
}
function choose(s) {
  stop();
  state.s = s;
  state.sel = null;
  state.i = Math.max(0, OPENS[P().id]?.(P()) ?? 0);
  document.querySelectorAll("[data-doc]").forEach((b, k) => b.setAttribute("aria-checked", String(k === s)));
  const p = P();
  const runs = p.agents.reduce((t, a) => t + a.runs.length, 0);
  document.querySelector("[data-about]").textContent = `${p.agents.length} subagents · ${runs} runs · ${dur(p.moments.at(-1).t)} · ${num(p.most)} at once at most`;
  refresh();
}

for (const view of views) {
  view.el.querySelector(".bar").addEventListener("click", (e) => {
    const what = e.target.closest("button")?.dataset.do;
    if (!what) return;
    if (what === "play") return play(view);
    stop();
    go(what === "prev" ? state.i - 1 : what === "next" ? state.i + 1 : what === "start" ? 0 : P().moments.length - 1);
  });
  view.range.addEventListener("input", () => {
    stop();
    go(Number(view.range.value));
  });
  view.stage.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-go]")?.dataset.go;
    if (jump !== undefined) {
      stop();
      return go(Number(jump));
    }
    const id = e.target.closest("[data-id]")?.dataset.id ?? null;
    state.sel = id === state.sel ? null : id;
    refresh();
  });
  new ResizeObserver(() => view.seen && paint(view)).observe(view.stage);
}
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const view = views.find((x) => x.el === entry.target);
        view.seen = entry.isIntersecting;
        if (view.seen && view.stale) paint(view);
        if (!view.seen && state.playing === view) {
          stop();
          refresh();
        }
      }
    },
    { rootMargin: "200px 0px" },
  );
  for (const view of views) io.observe(view.el);
}
document.querySelectorAll("[data-doc]").forEach((b, k) => b.addEventListener("click", () => choose(k)));
const saidButton = document.querySelector("[data-said]");
saidButton.addEventListener("click", () => {
  state.said = !state.said;
  saidButton.setAttribute("aria-pressed", String(state.said));
  saidButton.textContent = `Said: ${state.said ? "on" : "off"}`;
  // The moments are the same either way; only the marks come and go.
  refresh();
});
const themeButton = document.querySelector("[data-theme-switch]");
themeButton.addEventListener("click", () => {
  const order = ["auto", "light", "dark"];
  const next = order[(order.indexOf(document.documentElement.dataset.theme ?? "auto") + 1) % 3];
  if (next === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  themeButton.textContent = `Theme: ${next}`;
});
// A test, or the page's pictures, may ask for one state by the address: #large/40 is the large session at moment 41.
const asked = /^#(\w+)\/(\d+)$/.exec(location.hash);
choose(asked ? Math.max(0, READY.findIndex((p) => p.id === asked[1])) : 0);
if (asked) go(Number(asked[2]));
window.STUDIO = { state, READY, go, choose };
