/* The watching studio's page (slice 0109): one clock for all six drawings, the switch of sessions, the made-up
   statements' switch, and each drawing's own bar. The last part of the page's one script (build.mjs). */
const READY = DATA.samples.map(prepare);
const state = { s: OPEN_ON, i: 0, said: true, sel: null, playing: null, timer: null };
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
  view.stage.innerHTML = frame(view.el.dataset.name, view.draw, p, v, W, { said: state.said, sel: state.sel });
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
/** With the made-up statements off, the clock does not stop where one was said: nothing changed in the record there. */
function settle(i, way) {
  const m = P().moments;
  i = clamp(i, 0, m.length - 1);
  while (!state.said && m[i].kind === "said" && m[i + way]) i += way;
  return i;
}
function go(i, way = 1) {
  state.i = settle(i, way);
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
    else state.i = settle(state.i + 1, 1);
    refresh();
  }, every);
  refresh();
}
function choose(s) {
  stop();
  state.s = s;
  state.sel = null;
  state.i = settle(opensAt(P()), 1);
  document.querySelectorAll("[data-doc]").forEach((b, k) => b.setAttribute("aria-checked", String(k === s)));
  document.querySelector("[data-about]").textContent = aboutLine(P());
  refresh();
}

for (const view of views) {
  view.el.querySelector(".bar").addEventListener("click", (e) => {
    const what = e.target.closest("button")?.dataset.do;
    if (!what) return;
    if (what === "play") return play(view);
    stop();
    if (what === "prev") go(state.i - 1, -1);
    else go(what === "next" ? state.i + 1 : P().moments.length - 1);
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
  go(state.i);
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
choose(asked ? Math.max(0, READY.findIndex((p) => p.id === asked[1])) : OPEN_ON);
if (asked) go(Number(asked[2]));
window.STUDIO = { state, READY, go, choose };
