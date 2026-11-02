/**
 * An operation map in three dimensions, with a slider through its handoffs: each lane a sheet, the
 * sheets stacked with the people on top, each session a card standing on its lane's sheet, each handoff an arc from
 * one card's top to another's. It is drawn with CSS 3D transforms on plain elements: no canvas and no library, so
 * the words are the page's own text, and every card and arc is an element a keyboard and a screen reader can reach.
 *
 * It is a piece of the app fetched only when someone chooses it: `views.tsx` asks for it, the page
 * names it, and no other address carries it. Of core it imports only types and the stairs' own door
 * (`packages/core/src/picture/stage/stairs.ts`), which imports only types; both are handed core's parts
 * (`packages/core/src/picture/map-kit.ts` says why). Its styles ride in the script.
 *
 * Two halves. `plan` is the markup for core's arithmetic: where every sheet, card and arc is, the stops of the
 * slider and what each says (the same arithmetic draws a still from the command line). `attach` gives the markup
 * its behavior: drag to turn, pinch or wheel to move in and out, the slider, and a watch on how fast it is drawn.
 */
import type { Id, MapKit, MapPictureOptions, OperationMap } from "@grooph/core";
import { bow, CARD, cross, esc, fit, layout, mapScene, scaled, START, sub, unit, type Arc, type Scene, type Stop, type V } from "@grooph/core/stairs";

import css from "./space.css?inline";
import full from "../canvas/full.css?inline";

export type { Arc, Card, Link, Scene, Sheet, Stop, V } from "@grooph/core/stairs";
export { CARD, START, apart, bow, fit, toEye, turned } from "@grooph/core/stairs";
type Live = NonNullable<MapPictureOptions["live"]>;

const YAW = 0.96;
const PITCH: [number, number] = [0.1, 1.05];
/** A view that cannot be drawn this many times a second is not worth turning: the flat views are offered instead. */
export const FRAMES = 30;
/** With room to spare the view is shown larger, up to this many pixels to the unit. */
const LARGEST = 1.4;

export type Plan = { html: string; box: { min: V; max: V }; arcs: Arc[]; stops: Stop[]; cards: Map<Id, { at: V; h: number }>; floors: number[] };

/**
 * Where everything is, and the markup for it. `per` is how many cards stand in a row: three at a phone's width,
 * more where there is room. With `live` the cards carry what the hooks saw, and the slider has a last stop, now.
 * What stands where is core's (`mapScene` and `layout` in `picture/stage/stairs.ts`).
 */
export function plan(kit: MapKit, map: OperationMap, opts: { per?: number; live?: Live; at?: string } = {}): Plan {
  return scene(kit, mapScene(kit, map, opts));
}

/** The markup for a scene, with every sheet, card and arc where core's arithmetic puts it (`layout`). */
export function scene(kit: MapKit, made: Scene): Plan {
  const { title, sheets, links, stops, link, links_, none, range, note, flat, step = link } = made;
  const [, , , , , , , , , , , fmt, frame, , , inkFor, , numberBadge, , , , , , , stroke] = kit;
  const ink = inkFor("auto");
  const { width, placed, cards, arcs, floors, box } = layout(made);
  const parts: string[] = [];
  for (const { sheet, floor, front, back, depth, at } of placed) {
    parts.push(
      `<div class="space-sheet${sheet.cls}" ${sheet.mark} style="width:${fmt(width)}px;height:${fmt(depth)}px;transform:translate3d(0,${fmt(floor)}px,${fmt(back)}px) rotateX(90deg)"></div>` +
        `<div class="space-label" style="width:${fmt(width)}px;transform:translate3d(0,${fmt(floor + 3)}px,${fmt(front)}px)"><b>${esc(sheet.name)}</b>${sheet.place ? `<i>${esc(sheet.place)}</i>` : ""}<span>${esc(sheet.sub)}${sheet.items.length ? "" : none}</span></div>`,
    );
    sheet.items.forEach((c, j) => {
      const [x, y, z] = at[j]!;
      parts.push(`<div class="space-card" style="width:${CARD}px;height:${fmt(c.h)}px;transform:translate3d(${fmt(x)}px,${fmt(y)}px,${fmt(z)}px)"><svg viewBox="0 0 ${CARD} ${fmt(c.h)}" width="${CARD}" height="${fmt(c.h)}">${c.svg()}</svg></div>`);
    });
  }
  const HEAD = 9;
  arcs.forEach((arc, k) => {
    const h = links[k]!;
    const style = h.style;
    const color = ink(style.color);
    const length = Math.max(1, Math.hypot(arc.b[0] - arc.a[0], arc.b[1] - arc.a[1], arc.b[2] - arc.a[2]));
    const tall = arc.lift + HEAD;
    // A quadratic from one end to the other; its control point is twice the lift above the line between them.
    const [cx, cy] = [length / 2, tall - 2 * arc.lift];
    const slope = Math.atan2(tall - cy, length - cx);
    const [ex, ey] = [length - Math.cos(slope) * 5, tall - Math.sin(slope) * 5];
    const d = `M0,${fmt(tall)} Q${fmt(cx)},${fmt(cy)} ${fmt(ex)},${fmt(ey)}`;
    parts.push(
      `<div class="space-arc" data-arc="${k}" style="width:${fmt(length)}px;height:${fmt(tall + HEAD)}px"><svg viewBox="0 0 ${fmt(length)} ${fmt(tall + HEAD)}" width="${fmt(length)}" height="${fmt(tall + HEAD)}">` +
        `<g data-${link}="${esc(h.id)}" tabindex="0"><path d="${d}" ${stroke(style, color)}/><path class="space-hit" d="${d}"/><circle cx="0" cy="${fmt(tall)}" r="2.4" style="fill:${color}"/>` +
        `<path d="M0,0 L-8,-3.8 L-8,3.8 z" transform="translate(${fmt(length)},${fmt(tall)}) rotate(${fmt((slope * 180) / Math.PI)})" style="fill:${color}"/></g></svg></div>` +
        `<div class="space-n" data-arc="${k}" aria-hidden="true"><svg data-number="${esc(h.id)}" viewBox="-11 -9 22 18" width="22" height="18">${numberBadge(0, 0, String(arc.n), color, ink)}</svg></div>`,
    );
  });

  const palette = /<style>[\s\S]*?<\/style>/.exec(frame(1, 1, "", "auto", ink, "", "space"))?.[0] ?? "";
  const last = stops.length - 1;
  const html =
    `<div class="space grooph-picture" data-picture="space">${palette}` +
    `<div class="space-bar"><span>Drag to turn. Pinch to move in and out, or pick the scene and scroll.</span><button type="button" data-do="out" aria-label="Move out">−</button><button type="button" data-do="in" aria-label="Move in">+</button><button type="button" data-do="reset">Starting view</button></div>` +
    `<div class="space-scene" tabindex="0" role="group" aria-label="${esc(title)} in three dimensions: ${sheets.length} sheets, ${cards.size} cards, ${links.length} ${links_}. Drag, or use the arrow keys, to turn it; pinch, scroll, or use plus and minus, to move in and out."><div class="space-lens"><div class="space-world">${parts.join("")}</div></div></div>` +
    `<div class="space-time"><div class="space-steps"><button type="button" data-do="play" aria-label="Play"${last === 0 ? " disabled" : ""}>Play</button><button type="button" data-do="back" aria-label="Previous ${step}"${last === 0 ? " disabled" : ""}>‹</button><button type="button" data-do="next" aria-label="Next ${step}"${last === 0 ? " disabled" : ""}>›</button>` +
    `<input type="range" min="0" max="${last}" step="1" value="0" aria-label="${range}"${last === 0 ? " disabled" : ""}></div>` +
    `<output>${esc(stops[0]!.says)}</output><p class="space-note">${note}</p></div>` +
    `<p class="space-flat" role="status" hidden><span></span>${flat}</p></div>`;
  return { html, box, arcs, stops, cards, floors };
}


/**
 * Whether the frames just drawn came too slowly: the middle one of the last two dozen gaps, as a rate, against
 * `FRAMES` a second. The middle and not the mean, so that one long frame (a tab coming back, a first paint) is not
 * a slow device; and the rate is compared as it is said, in whole frames, so the note never says "30, too slow".
 */
export function tooSlow(gaps: number[]): number | undefined {
  if (gaps.length < 24) return undefined;
  const rate = Math.round(1000 / gaps.slice(-24).sort((a, b) => a - b)[12]!);
  return rate < FRAMES ? rate : undefined;
}

/**
 * What a stop of the slider lights: for each arc, whether it is the one, before it or after it, and the two ends
 * of the one. At the first stop every arc is lit alike; at the last of a live map, now, every handoff is behind.
 */
export function lights(made: Plan, step: number): { stop: Stop; arcs: ("lit" | "past" | "ahead" | "")[]; ends: Id[] } {
  const stop = made.stops[Math.max(0, Math.min(made.stops.length - 1, step))]!;
  const at = made.arcs.findIndex((a) => a.id === stop.handoff);
  return { stop, arcs: made.arcs.map((_, k) => (stop.now ? "past" : at < 0 ? "" : k === at ? "lit" : stop.alone ? "" : k < at ? "past" : "ahead")), ends: at < 0 ? (stop.ends ?? []) : [made.arcs[at]!.from, made.arcs[at]!.to] };
}

// ─── behavior ─────────────────────────────────────────────────────────────

/** What a view keeps while its markup is drawn again (a new room, a new theme): how it is turned and where the slider is. */
export type Held = { yaw: number; pitch: number; zoom: number; step: number };
export const held = (): Held => ({ ...START, zoom: 1, step: 0 });

let styled = false;

/**
 * Give the markup its behavior. `scene` is the element `plan`'s markup became; `flat` is called when the reader
 * takes one of the flat views instead. Returns what to call when the markup goes.
 */
export function attach(root: HTMLElement, made: Plan, state: Held, flat: (view: "picture" | "sequence") => void): () => void {
  if (!styled) {
    const sheet = document.createElement("style");
    sheet.textContent = css + full;
    document.head.append(sheet);
    styled = true;
  }
  const $ = <T extends Element = HTMLElement>(q: string): T => root.querySelector<T>(q)!;
  const scene = $(".space-scene");
  const glass = $(".space-lens");
  const world = $(".space-world");
  const stage = root.closest<HTMLElement>(".map-stage");
  const range = $<HTMLInputElement>('input[type="range"]');
  const says = $("output");
  const note = $(".space-flat");
  const play = $<HTMLButtonElement>('[data-do="play"]');
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: Element | Document, name: K, fn: (e: HTMLElementEventMap[K]) => void, more?: AddEventListenerOptions): void => {
    el.addEventListener(name, fn as EventListener, more);
    off.push(() => el.removeEventListener(name, fn as EventListener, more));
  };

  // A browser that cannot stand one element behind another says so, and offers the flat views.
  const refuse = (why: string): void => {
    note.querySelector("span")!.textContent = why;
    note.hidden = false;
  };
  on(note, "click", (e) => {
    const view = (e.target as Element).closest<HTMLElement>("[data-flat]")?.dataset["flat"];
    if (view) flat(view as "picture" | "sequence");
    e.stopPropagation();
  });
  if (typeof CSS === "undefined" || !CSS.supports("transform-style", "preserve-3d")) {
    root.classList.add("is-flat");
    refuse("This browser cannot draw the map in three dimensions.");
    return () => off.forEach((f) => f());
  }

  const center: V = [(made.box.min[0] + made.box.max[0]) / 2, (made.box.min[1] + made.box.max[1]) / 2, (made.box.min[2] + made.box.max[2]) / 2];
  const arcs = [...root.querySelectorAll<HTMLElement>(".space-arc")];
  const numbers = [...root.querySelectorAll<HTMLElement>(".space-n")];
  const sides: (V | undefined)[] = made.arcs.map(() => undefined);
  let lens = 1400;
  let fitted = 1;

  /** Put the world, each arc and each number where the view now has them. */
  const pose = (): void => {
    const { yaw, pitch } = state;
    // Moving in and out enlarges the picture the lens has made, so that nothing passes the eye however near it is taken.
    glass.style.transform = `scale(${state.zoom})`;
    world.style.transform = `translate3d(${scene.clientWidth / 2}px,${scene.clientHeight / 2}px,0) scale3d(${fitted},${fitted},${fitted}) rotateX(${-pitch}rad) rotateY(${yaw}rad) translate3d(${-center[0]}px,${-center[1]}px,${-center[2]}px)`;
    made.arcs.forEach((arc, k) => {
      const along = unit(sub(arc.b, arc.a));
      const side = (sides[k] = bow(arc, yaw, pitch, sides[k]));
      const face = cross(along, scaled(side, -1));
      const tall = arc.lift + 9;
      const o: V = [arc.a[0] + side[0] * tall, arc.a[1] + side[1] * tall, arc.a[2] + side[2] * tall];
      arcs[k]!.style.transform = `matrix3d(${along[0]},${along[1]},${along[2]},0,${-side[0]},${-side[1]},${-side[2]},0,${face[0]},${face[1]},${face[2]},0,${o[0]},${o[1]},${o[2]},1)`;
      const top: V = [(arc.a[0] + arc.b[0]) / 2 + side[0] * arc.lift, (arc.a[1] + arc.b[1]) / 2 + side[1] * arc.lift, (arc.a[2] + arc.b[2]) / 2 + side[2] * arc.lift];
      numbers[k]!.style.transform = `translate3d(${top[0]}px,${top[1]}px,${top[2]}px) rotateY(${-yaw}rad) rotateX(${pitch}rad) translate(-50%,-50%)`;
    });
  };
  let room = stage?.clientHeight ?? 0;
  const measure = (): void => {
    // The scene is never taller than the room the screen's stage has. With details open under it (on a phone they
    // take the lower half of the screen) the whole of it is then in view above them, and what was picked with it.
    // In full screen it may take all the room there is.
    const want = stage?.closest(".is-focus") ? innerHeight : Math.max(340, Math.min(820, innerHeight - 300));
    // A stage may say how much of its height is not the scene's: what stands above and below it there (`data-keep`).
    scene.style.height = `${Math.max(180, Math.min(want, stage ? stage.clientHeight - 12 - Number(stage.dataset["keep"] ?? 0) : want))}px`;
    if (stage && stage.clientHeight < room && root.querySelector(".is-on")) scene.scrollIntoView({ block: "nearest" });
    room = stage?.clientHeight ?? 0;
    lens = Math.max(900, scene.clientWidth * 1.7);
    glass.style.perspective = `${lens}px`;
    // A small map is not blown up to fill a large frame: past this its text is drawn soft.
    fitted = Math.min(LARGEST, fit(made.box, scene.clientWidth, scene.clientHeight, lens));
    pose();
  };

  // Frames are drawn only while something moves the view, and a little after; how fast they come is watched.
  const gaps: number[] = [];
  let frame = 0;
  let last = 0;
  let until = 0;
  let asked = false;
  let posed = "";
  let glide: { from: Held; start: number } | undefined;
  const tick = (now: number): void => {
    frame = 0;
    // By the frames' own clock, so that the two times compared are of one kind.
    if (asked) until = now + 160;
    asked = false;
    if (glide) {
      const t = Math.min(1, (now - (glide.start ||= now)) / 320);
      const e = 1 - (1 - t) ** 3;
      state.yaw = glide.from.yaw + (START.yaw - glide.from.yaw) * e;
      state.pitch = glide.from.pitch + (START.pitch - glide.from.pitch) * e;
      state.zoom = glide.from.zoom + (1 - glide.from.zoom) * e;
      if (t >= 1) glide = undefined;
    }
    // Only a frame that changed the view, straight after another, says how fast the view is drawn.
    const now_ = `${state.yaw} ${state.pitch} ${state.zoom}`;
    if (last && now_ !== posed) gaps.push(now - last);
    if (gaps.length > 96) gaps.splice(0, 48);
    posed = now_;
    last = now;
    pose();
    const rate = tooSlow(gaps);
    if (rate !== undefined && note.hidden) refuse(`This device is drawing the map in three dimensions ${rate} times a second, fewer than ${FRAMES}: too slowly to turn it smoothly.`);
    if (glide || now < until) frame = requestAnimationFrame(tick);
    else last = 0;
  };
  const draw = (): void => {
    asked = true;
    if (!frame) frame = requestAnimationFrame(tick);
  };
  off.push(() => cancelAnimationFrame(frame));
  // A page that was out of sight drew nothing: the gap across that is not a frame.
  const unseen = (): void => {
    last = 0;
    gaps.length = 0;
  };
  document.addEventListener("visibilitychange", unseen);
  off.push(() => document.removeEventListener("visibilitychange", unseen));

  const turn = (yaw: number, pitch: number): void => {
    state.yaw = Math.max(-YAW, Math.min(YAW, yaw));
    state.pitch = Math.max(PITCH[0], Math.min(PITCH[1], pitch));
    draw();
  };
  const move = (by: number): void => {
    state.zoom = Math.max(0.4, Math.min(5, state.zoom * by));
    draw();
  };
  const reset = (): void => {
    if (still) {
      Object.assign(state, START, { zoom: 1 });
      pose();
    } else {
      glide = { from: { ...state }, start: 0 };
      draw();
    }
  };

  // One finger turns it, two move in and out; a drag is not a tap, so what it ends on is not picked.
  const fingers = new Map<number, [number, number]>();
  let dragged = false;
  let forget = 0;
  on(scene, "pointerdown", (e) => {
    // Only a mouse's main button turns it: the others have their own work (a menu, a scroll).
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A first finger down is the only finger down: one lifted outside the frame was never seen to lift.
    if (e.isPrimary) fingers.clear();
    fingers.set(e.pointerId, [e.clientX, e.clientY]);
    clearTimeout(forget);
    dragged = false;
    glide = undefined;
  });
  on(scene, "pointermove", (e) => {
    // A mouse with no button down is not dragging, whatever was last seen of it: its release was missed.
    if (e.pointerType === "mouse" && e.buttons === 0) fingers.delete(e.pointerId);
    const was = fingers.get(e.pointerId);
    if (!was) return;
    const [dx, dy] = [e.clientX - was[0], e.clientY - was[1]];
    if (fingers.size === 2) {
      const other = [...fingers].find(([id]) => id !== e.pointerId)![1];
      const [then, now] = [Math.hypot(was[0] - other[0], was[1] - other[1]), Math.hypot(e.clientX - other[0], e.clientY - other[1])];
      if (then > 0) move(now / then);
      dragged = true;
    } else if (dragged || Math.hypot(dx, dy) > 4) {
      // The drag goes on outside the frame; a pointer that is already gone cannot be held, and need not be.
      if (!dragged) try { scene.setPointerCapture(e.pointerId); } catch {}
      dragged = true;
      turn(state.yaw + dx * 0.006, state.pitch + dy * 0.005);
    } else return;
    fingers.set(e.pointerId, [e.clientX, e.clientY]);
  });
  for (const name of ["pointerup", "pointercancel"] as const) {
    on(scene, name, (e) => {
      fingers.delete(e.pointerId);
      // The click a mouse's drag ends with comes at once; a finger's drag ends with none. Either way the drag is
      // then over, and the next click, from a keyboard or a reader's own tool, is a click.
      clearTimeout(forget);
      forget = window.setTimeout(() => (dragged = false), 60);
    });
  }
  off.push(() => clearTimeout(forget));
  // The click that ends a drag is not a tap. It is caught on its way down from the page, since a browser may send
  // it to whatever holds both the place the drag began and the place it ended, which need not be the scene.
  on(
    document,
    "click",
    (e) => {
      if (!dragged) return;
      e.stopPropagation();
      e.preventDefault();
      dragged = false;
    },
    { capture: true },
  );
  on(
    scene,
    "wheel",
    (e) => {
      // A wheel over the scene scrolls the page, as anywhere, until the scene has been picked; a pinch on a trackpad is the scene's.
      if (!(e as WheelEvent).ctrlKey && !scene.contains(document.activeElement)) return;
      e.preventDefault();
      move(Math.exp(-(e as WheelEvent).deltaY * ((e as WheelEvent).ctrlKey ? 0.01 : 0.0016)));
    },
    { passive: false },
  );
  on(scene, "keydown", (e) => {
    if (e.target !== scene) return; // a card or an arc has the keyboard: Enter and Space are the screen's
    if (e.metaKey || e.ctrlKey || e.altKey) return; // the browser's own: its zoom, its way back
    // The arrows turn it the way a drag does: right as a drag to the right, down as a drag down.
    const step = { ArrowLeft: [-0.09, 0], ArrowRight: [0.09, 0], ArrowUp: [0, -0.07], ArrowDown: [0, 0.07] }[e.key];
    if (step) turn(state.yaw + step[0]!, state.pitch + step[1]!);
    else if (e.key === "+" || e.key === "=") move(1.15);
    else if (e.key === "-" || e.key === "_") move(1 / 1.15);
    else if (e.key === "0" || e.key === "Home") reset();
    else return;
    e.preventDefault();
  });

  // The slider: which handoff is lit. Those before it are dimmed, those after it more so.
  let timer = 0;
  const stopPlaying = (): void => {
    clearInterval(timer);
    timer = 0;
    play.textContent = "Play";
    play.setAttribute("aria-label", "Play");
  };
  const light = (step: number): void => {
    state.step = Math.max(0, Math.min(made.stops.length - 1, step));
    const { stop, arcs: marks, ends } = lights(made, state.step);
    marks.forEach((mark, k) => {
      for (const el of [arcs[k]!, numbers[k]!]) for (const name of ["lit", "past", "ahead"]) el.classList.toggle(`is-${name}`, mark === name);
    });
    for (const el of root.querySelectorAll(".is-end")) el.classList.remove("is-end");
    for (const id of ends) root.querySelector(["session", "person", "node"].map((part) => `[data-${part}="${CSS.escape(id)}"]`).join())?.classList.add("is-end");
    if (stop.sheet) root.querySelector(`.space-sheet[${stop.sheet}]`)?.classList.add("is-end");
    root.classList.toggle("is-now", stop.now === true);
    range.value = String(state.step);
    // The slider says where it is; the sentence under it, which is read out as it changes, says the rest.
    range.setAttribute("aria-valuetext", stop.short);
    says.textContent = stop.says;
  };
  on(range, "input", () => {
    stopPlaying();
    light(Number(range.value));
  });
  on($(".space-time"), "click", (e) => {
    const what = (e.target as Element).closest<HTMLElement>("[data-do]")?.dataset["do"];
    e.stopPropagation(); // a press on the slider's own controls picks nothing on the map
    if (what === "back" || what === "next") {
      stopPlaying();
      light(state.step + (what === "next" ? 1 : -1));
    } else if (what === "play") {
      if (timer) return stopPlaying();
      if (state.step >= made.stops.length - 1) light(0);
      play.textContent = "Pause";
      play.setAttribute("aria-label", "Pause");
      timer = window.setInterval(() => {
        light(state.step + 1);
        if (state.step >= made.stops.length - 1) stopPlaying();
      }, 2400);
    }
  });
  off.push(stopPlaying);
  on($(".space-bar"), "click", (e) => {
    const what = (e.target as Element).closest<HTMLElement>("[data-do]")?.dataset["do"];
    e.stopPropagation();
    if (what === "reset") reset();
    else if (what) move(what === "in" ? 1.25 : 0.8);
  });

  // A handoff picked on the screen, here or in the list beside it, is the one the slider lights: when it is
  // picked, and not when its mark is merely put back on markup drawn again, unless the slider has not been moved.
  let settled = false;
  const settle = window.setTimeout(() => (settled = true), 0);
  off.push(() => clearTimeout(settle));
  const watch = new MutationObserver((changes) => {
    for (const change of changes) {
      const el = change.target as Element;
      const id = el.getAttribute("data-handoff");
      if (!id || !el.classList.contains("is-on") || /\bis-on\b/.test(change.oldValue ?? "")) continue;
      const at = made.stops.findIndex((s) => s.handoff === id);
      if (at > 0 && at !== state.step && (settled || state.step === 0)) {
        stopPlaying();
        light(at);
      }
    }
  });
  watch.observe(world, { attributes: true, attributeFilter: ["class"], attributeOldValue: true, subtree: true });
  off.push(() => watch.disconnect());

  // The scene never scrolls: a part brought into view by the screen moves the page, not the world inside its frame.
  on(scene, "scroll", () => scene.scrollTo(0, 0));
  if (typeof ResizeObserver === "function") {
    const sized = new ResizeObserver(measure);
    sized.observe(scene);
    if (stage) sized.observe(stage);
    off.push(() => sized.disconnect());
  }
  measure();
  light(state.step);
  return () => off.forEach((f) => f());
}
