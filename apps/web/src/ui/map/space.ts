/**
 * An operation map in three dimensions, with a slider through its handoffs (handoff 0087): each lane a sheet, the
 * sheets stacked with the people on top, each session a card standing on its lane's sheet, each handoff an arc from
 * one card's top to another's. It is drawn with CSS 3D transforms on plain elements: no canvas and no library, so
 * the words are the page's own text, and every card and arc is an element a keyboard and a screen reader can reach.
 *
 * It is a piece of the app fetched only when someone chooses it (decision 0021): `views.tsx` asks for it, the page
 * names it, and no other address carries it. Like the flat views it imports nothing but types, and is handed
 * core's parts (`packages/core/src/picture/map-kit.ts` says why). Its styles ride in the script.
 *
 * Two halves. `plan` is arithmetic: where every sheet, card and arc is, the stops of the slider and what each
 * says, and the markup. `attach` gives the markup its behavior: drag to turn, pinch or wheel to move in and out,
 * the slider, and a watch on how fast it is being drawn.
 */
import type { Handoff, Id, MapKit, MapPictureOptions, OperationMap } from "@grooph/core";

import css from "./space.css?inline";

export type V = [number, number, number];
type Live = NonNullable<MapPictureOptions["live"]>;

const CARD = 128; // a card's width
const GAP = 14; // between two cards of a row
const ROW = 104; // between two rows on a sheet, front to back
const EDGE = 24; // from a sheet's edge to its cards
const CLEAR = 56; // between a card's top and the sheet above, for two lanes on one machine
const FORWARD = 34; // how far each sheet stands in front of the one above
const LABEL = 36; // a sheet's label, under its front edge

/** Where the view starts, and how far it turns: the cards face the front, so it never shows their backs. */
export const START = { yaw: -0.46, pitch: 0.46 };
const YAW = 0.96;
const PITCH: [number, number] = [0.1, 1.05];
/** A view that cannot be drawn this many times a second is not worth turning: the flat views are offered instead. */
export const FRAMES = 30;
/** With room to spare the view is shown larger, up to this many pixels to the unit. */
const LARGEST = 1.4;

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const HARNESS: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex" };

/**
 * How far apart two lanes are drawn: nearest when they are on one machine, further when they are on two, furthest
 * when the map says one is local and the other in the cloud. It reads only what the document says: a lane that
 * does not say where it is is placed by its machine alone.
 */
export function apart(a: OperationMap["lanes"][number], b: OperationMap["lanes"][number]): number {
  if (a.place && b.place && a.place !== b.place) return 1.8;
  return a.machine === b.machine ? 1 : 1.35;
}

export type Stop = { handoff?: Id; now?: boolean; says: string; short: string };
export type Arc = { id: Id; n: number; from: Id; to: Id; a: V; b: V; lift: number };
export type Plan = { html: string; box: { min: V; max: V }; arcs: Arc[]; stops: Stop[]; cards: Map<Id, { at: V; h: number }>; floors: number[] };

/** What the hooks saw of a session, in a word or two: the last stop of the slider shows it. */
function seen(now: Live[string]): { state: "working" | "waiting" | "quiet" | "ended"; says: string } {
  const state = now.working > 0 ? "working" : now.waiting > 0 ? "waiting" : (now.quiet ?? 0) > 0 ? "quiet" : "ended";
  const agents = now.agentsRunning > 0 ? ` · ${now.agentsRunning} agent${now.agentsRunning === 1 ? "" : "s"}` : "";
  return { state, says: `${state === "quiet" ? "gone quiet" : state}${state === "working" ? agents : ""}` };
}

/**
 * Where everything is, and the markup for it. `per` is how many cards stand in a row: three at a phone's width,
 * more where there is room. With `live` the cards carry what the hooks saw, and the slider has a last stop, now.
 */
export function plan(kit: MapKit, map: OperationMap, opts: { per?: number; live?: Live; at?: string } = {}): Plan {
  // The kit's parts by name; the order is packages/core/src/picture/map-kit.ts's.
  const [, , , , , , , , , carriedBy, drawn, fmt, frame, , , inkFor, , numberBadge, , , , , rect, , stroke, styleOf, text, textWidth, wrap] = kit;
  const ink = inkFor("auto");
  const per = Math.max(1, opts.per ?? 3);
  const { sessions, people, handoffs, numberOf } = drawn(map);
  const nameOf = (id: Id): string => map.sessions.find((s) => s.id === id)?.name || (map.people ?? []).find((p) => p.id === id)?.name || id;

  // The sheets: the people's first, then each lane's, in the document's order.
  type Item = { id: Id; person: boolean; h: number; svg: (w: number, h: number) => string };
  const card = (id: Id, name: string, person: boolean, under: string, count: number, model = "", now?: Live[string]): Item => {
    const pill = count > 1 ? `×${count}` : "";
    const pillW = pill ? textWidth(pill, 9.5, "bold") + 10 : 0;
    const lines = wrap(name, (k) => CARD - 16 - (pill && k === 0 ? pillW + 4 : 0), 12.5, 3, "bold");
    const mark = now ? seen(now) : undefined;
    const h = 7 + lines.length * 15 + 13 + (model ? 11.5 : 0) + (mark ? 15 : 0) + 6;
    return {
      id,
      person,
      h,
      svg: () => {
        const g: string[] = [rect(0.7, 0.7, CARD - 1.4, h - 1.4, person ? { fill: ink("gate-soft"), stroke: ink("gate"), rx: 12, width: 1.4, mark: "card" } : { fill: ink("surface"), stroke: ink("line-strong"), rx: 8, mark: "card" })];
        let y = 5;
        lines.forEach((line, k) => {
          y += 15;
          g.push(text(8, y, line, { size: 12.5, fill: ink("ink"), weight: "bold" }));
          if (k === 0 && pill) g.push(rect(CARD - 8 - pillW, y - 10.5, pillW, 14, { fill: ink("accent-soft"), rx: 7 }) + text(CARD - 8 - pillW / 2, y, pill, { size: 9.5, fill: ink("accent"), weight: "bold", anchor: "middle" }));
        });
        y += 13;
        g.push(text(8, y, wrap(under, CARD - 16, 9.5, 1, "bold")[0]!, { size: 9.5, fill: ink(person ? "gate" : under === "Codex" ? "check" : "accent"), weight: "bold" }));
        if (model) g.push(text(8, (y += 11.5), wrap(model, CARD - 16, 9, 1)[0]!, { size: 9, fill: ink("ink-3") }));
        if (mark) {
          y += 15;
          const tone = ink(mark.state === "working" ? "accent" : mark.state === "waiting" ? "warning" : "ink-3");
          const dot = mark.state === "working" || mark.state === "ended" ? `<circle cx="11" cy="${fmt(y - 3.2)}" r="3.4" style="fill:${tone}"/>` : `<circle cx="11" cy="${fmt(y - 3.2)}" r="2.8" fill="none" stroke-width="1.6" style="stroke:${tone}"/>`;
          g.push(dot + text(18, y, wrap(mark.says, CARD - 24, 9, 1, "bold")[0]!, { size: 9, fill: tone, weight: "bold" }));
        }
        return `<g data-${person ? "person" : "session"}="${esc(id)}"${mark ? ` data-live="${mark.state}"` : ""}>${g.join("")}</g>`;
      },
    };
  };
  const sheets = [
    ...(people.length ? [{ id: "", name: people.length === 1 ? "Person" : "People", sub: "on no machine, under no account", place: "", person: true, items: people.map((p) => card(p.id, p.name || p.id, true, "person", 1)) }] : []),
    ...map.lanes.map((lane) => ({
      id: lane.id,
      name: lane.name || lane.id,
      sub: `${lane.machine} · ${lane.account}`,
      place: lane.place ?? "",
      person: false,
      items: sessions.filter((s) => s.lane === lane.id).map((s) => card(s.id, s.name || s.id, false, HARNESS[s.harness] ?? s.harness, s.count ?? 1, s.model, opts.live?.[s.id])),
    })),
  ];
  const across = Math.max(1, Math.min(per, Math.max(...sheets.map((s) => s.items.length), 1)));
  const width = 2 * EDGE + across * CARD + (across - 1) * GAP;
  // A sheet is as deep as its rows; the front edges step forward down the stack, so no sheet stands over the
  // front row of the one below it.
  const depthOf = (count: number): number => 2 * EDGE + (Math.max(1, Math.ceil(count / across)) - 1) * ROW;
  const deepest = Math.max(0, ...sheets.map((s) => depthOf(s.items.length))) + Math.max(0, sheets.length - 1) * FORWARD;
  // Every sheet keeps the room the map's tallest card needs, so that the step from one sheet to the next is that
  // room and the gap, and the gap alone says how far apart two lanes are.
  const band = Math.max(40, ...sheets.flatMap((s) => s.items.map((c) => c.h)));

  // Down the stack: each sheet clear of the cards on the one below, by more where the two lanes are further apart.
  const cards: Plan["cards"] = new Map();
  const floors: number[] = [];
  const parts: string[] = [];
  let floor = 0;
  sheets.forEach((sheet, i) => {
    const lanes = map.lanes;
    const gap = i === 0 ? 0 : sheets[i - 1]!.person ? 1 : apart(lanes[i - (people.length ? 2 : 1)]!, lanes[i - (people.length ? 1 : 0)]!);
    floor += band + (i === 0 ? 0 : CLEAR * gap);
    floors.push(floor);
    const depth = depthOf(sheet.items.length);
    const front = deepest - (sheets.length - 1 - i) * FORWARD;
    const back = front - depth;
    parts.push(
      `<div class="space-sheet${sheet.person ? " is-people" : ""}" ${sheet.person ? 'data-people=""' : `data-lane="${esc(sheet.id)}"`} style="width:${fmt(width)}px;height:${fmt(depth)}px;transform:translate3d(0,${fmt(floor)}px,${fmt(back)}px) rotateX(90deg)"></div>` +
        `<div class="space-label" style="width:${fmt(width)}px;transform:translate3d(0,${fmt(floor + 3)}px,${fmt(front)}px)"><b>${esc(sheet.name)}</b>${sheet.place ? `<i>${esc(sheet.place)}</i>` : ""}<span>${esc(sheet.sub)}${sheet.items.length ? "" : " · no sessions"}</span></div>`,
    );
    sheet.items.forEach((c, j) => {
      const row = Math.floor(j / across);
      const inRow = Math.min(across, sheet.items.length - row * across);
      const x = (width - inRow * CARD - (inRow - 1) * GAP) / 2 + (j % across) * (CARD + GAP);
      const z = front - EDGE - row * ROW; // the first row is the front one
      cards.set(c.id, { at: [x, floor - c.h, z], h: c.h });
      parts.push(`<div class="space-card" style="width:${CARD}px;height:${fmt(c.h)}px;transform:translate3d(${fmt(x)}px,${fmt(floor - c.h)}px,${fmt(z)}px)"><svg viewBox="0 0 ${CARD} ${fmt(c.h)}" width="${CARD}" height="${fmt(c.h)}">${c.svg(CARD, c.h)}</svg></div>`);
    });
  });

  // The arcs: from a place on the sender's top edge to one on the receiver's. The ends along an edge are in the
  // order of where they lead, left to right, so arcs leave a card without crossing there.
  const ends = new Map<Id, { arc: number; from: boolean; toward: number }[]>();
  handoffs.forEach((h, arc) => {
    const [a, b] = [cards.get(h.from)!, cards.get(h.to)!];
    (ends.get(h.from) ?? ends.set(h.from, []).get(h.from)!).push({ arc, from: true, toward: b.at[0] - a.at[0] });
    (ends.get(h.to) ?? ends.set(h.to, []).get(h.to)!).push({ arc, from: false, toward: a.at[0] - b.at[0] });
  });
  const place = new Map<string, V>();
  for (const [id, list] of ends) {
    const c = cards.get(id)!;
    list.sort((p, q) => p.toward - q.toward || p.arc - q.arc || (p.from ? -1 : 1));
    const step = Math.min(11, (CARD - 20) / Math.max(1, list.length - 1));
    list.forEach((e, k) => place.set(`${e.arc}${e.from ? "a" : "b"}`, [c.at[0] + CARD / 2 + (k - (list.length - 1) / 2) * step, c.at[1], c.at[2]]));
  }
  const pairs = new Map<string, number>();
  const arcs: Arc[] = handoffs.map((h, arc) => {
    const [a, b] = [place.get(`${arc}a`)!, place.get(`${arc}b`)!];
    const pair = [h.from, h.to].sort().join(" ");
    const nth = pairs.get(pair) ?? 0;
    pairs.set(pair, nth + 1);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    return { id: h.id, n: numberOf.get(h.id)!, from: h.from, to: h.to, a, b, lift: 16 + length * 0.16 + nth * 9 };
  });
  const HEAD = 9;
  arcs.forEach((arc, k) => {
    const h = handoffs[k]!;
    const style = styleOf(h);
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
        `<g data-handoff="${esc(h.id)}" tabindex="0"><path d="${d}" ${stroke(style, color)}/><path class="space-hit" d="${d}"/><circle cx="0" cy="${fmt(tall)}" r="2.4" style="fill:${color}"/>` +
        `<path d="M0,0 L-8,-3.8 L-8,3.8 z" transform="translate(${fmt(length)},${fmt(tall)}) rotate(${fmt((slope * 180) / Math.PI)})" style="fill:${color}"/></g></svg></div>` +
        `<div class="space-n" data-arc="${k}" aria-hidden="true"><svg data-number="${esc(h.id)}" viewBox="-11 -9 22 18" width="22" height="18">${numberBadge(0, 0, String(arc.n), color, ink)}</svg></div>`,
    );
  });

  // The slider's stops: all of them, then one at a time in the map's order, then now, where the hooks saw anything.
  const total = handoffs.length;
  const stops: Stop[] = [{ short: "all handoffs", says: total === 0 ? "This map has no handoffs to step through." : total === 1 ? "The map's one handoff is lit." : `All ${total} handoffs are lit. Move the slider or press Play to light them one at a time.` }];
  handoffs.forEach((h: Handoff, k) => {
    const who = h.from === h.to ? `${nameOf(h.from)} to itself` : `${nameOf(h.from)} to ${nameOf(h.to)}`;
    stops.push({ handoff: h.id, short: `handoff ${arcs[k]!.n} of ${map.handoffs.length}`, says: `Handoff ${arcs[k]!.n} of ${map.handoffs.length}: ${who} · ${carriedBy(map, h)}${h.what ? ` · ${h.what}` : ""}` });
  });
  if (opts.live) {
    const states = Object.values(opts.live).map((now) => seen(now).state);
    const count = (state: string, word: string): string[] => (states.includes(state as never) ? [`${states.filter((s) => s === state).length} ${word}`] : []);
    const said = [...count("working", "working"), ...count("waiting", "waiting"), ...count("quiet", "gone quiet"), ...count("ended", "ended")];
    stops.push({ now: true, short: "now", says: `Now${opts.at ? `, as the hooks saw it at ${opts.at.slice(0, 16).replace("T", " ")} UTC` : ""}: ${said.length ? said.join(", ") : "no session has been seen"}.` });
  }

  const palette = /<style>[\s\S]*?<\/style>/.exec(frame(1, 1, "", "auto", ink, "", "space"))?.[0] ?? "";
  // The box the starting view must show whole: the sheets with their labels, and each arc's highest point there.
  const box: Plan["box"] = { min: [0, 0, 0], max: [width, (floors[floors.length - 1] ?? 0) + LABEL, deepest] };
  for (const arc of arcs) {
    const side = bow(arc, START.yaw, START.pitch);
    for (const k of [0, 1, 2] as const) {
      const top = (arc.a[k] + arc.b[k]) / 2 + side[k] * (arc.lift + 9);
      box.min[k] = Math.min(box.min[k], top);
      box.max[k] = Math.max(box.max[k], top);
    }
  }
  const last = stops.length - 1;
  const html =
    `<div class="space grooph-picture" data-picture="space">${palette}` +
    `<div class="space-bar"><span>Drag to turn. Pinch to move in and out, or pick the scene and scroll.</span><button type="button" data-do="out" aria-label="Move out">−</button><button type="button" data-do="in" aria-label="Move in">+</button><button type="button" data-do="reset">Starting view</button></div>` +
    `<div class="space-scene" tabindex="0" role="group" aria-label="${esc(map.name || map.id)} in three dimensions: ${sheets.length} sheets, ${cards.size} cards, ${total} handoffs. Drag, or use the arrow keys, to turn it; pinch, scroll, or use plus and minus, to move in and out."><div class="space-lens"><div class="space-world">${parts.join("")}</div></div></div>` +
    `<div class="space-time"><div class="space-steps"><button type="button" data-do="play" aria-label="Play"${last === 0 ? " disabled" : ""}>Play</button><button type="button" data-do="back" aria-label="Previous handoff"${last === 0 ? " disabled" : ""}>‹</button><button type="button" data-do="next" aria-label="Next handoff"${last === 0 ? " disabled" : ""}>›</button>` +
    `<input type="range" min="0" max="${last}" step="1" value="0" aria-label="Handoff, in the order the map lists them"${last === 0 ? " disabled" : ""}></div>` +
    `<output>${esc(stops[0]!.says)}</output><p class="space-note">The order the map lists its handoffs in. An order, not a clock: a map records no times${opts.live ? "; the slider's last stop is now" : ""}.</p></div>` +
    `<p class="space-flat" role="status" hidden><span></span> The picture and the sequence show the same map, flat. <button type="button" data-flat="picture">Picture</button> <button type="button" data-flat="sequence">Sequence</button></p></div>`;
  return { html, box, arcs, stops, cards, floors };
}

// ─── the view's arithmetic ────────────────────────────────────────────────

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scaled = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: V): V => scaled(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** A point of the world as the eye has it, turned by `yaw` about the upright and tipped by `pitch` to look down. */
export function turned(p: V, yaw: number, pitch: number): V {
  const [x, z] = [p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)];
  return [x, p[1] * Math.cos(pitch) + z * Math.sin(pitch), -p[1] * Math.sin(pitch) + z * Math.cos(pitch)];
}

/** The way to the eye, in the world's own directions. */
export const toEye = (yaw: number, pitch: number): V => [-Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];

/**
 * How an arc is held: flat to the eye, turned about the line between its ends, so it is never seen edge on.
 * Returns the side it bows to, kept from one frame to the next so it does not flip as the view turns.
 */
export function bow(arc: Arc, yaw: number, pitch: number, before?: V): V {
  const along = unit(sub(arc.b, arc.a));
  const eye = toEye(yaw, pitch);
  const facing = sub(eye, scaled(along, dot(eye, along)));
  if (Math.hypot(...facing) < 1e-3) return before ?? [0, -1, 0];
  let side = unit(cross(unit(facing), along));
  // At first, the side that is up on the screen, or the left when neither is; after that, the side it was on.
  const flat = turned(side, yaw, pitch);
  const up = before ? dot(side, before) : Math.abs(flat[1]) > 0.2 ? -flat[1] : -flat[0];
  if (up < 0) side = scaled(side, -1);
  return side;
}

/**
 * The size at which the whole box is inside a frame `w` by `h`, seen from the starting view through `lens`. The
 * world is made that size in all three directions, depth included, so it looks the same at any size.
 */
export function fit(box: Plan["box"], w: number, h: number, lens: number, yaw = START.yaw, pitch = START.pitch): number {
  const center = scaled([box.min[0] + box.max[0], box.min[1] + box.max[1], box.min[2] + box.max[2]], 0.5);
  const corners: V[] = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => turned(sub([k & 1 ? box.max[0] : box.min[0], k & 2 ? box.max[1] : box.min[1], k & 4 ? box.max[2] : box.min[2]], center), yaw, pitch));
  const inside = (size: number): boolean =>
    corners.every((c) => {
      const near = lens / Math.max(1, lens - c[2] * size);
      return Math.abs(c[0] * size * near) <= w / 2 - 14 && Math.abs(c[1] * size * near) <= h / 2 - 14;
    });
  let [lo, hi] = [0.02, 4];
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (inside(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
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
  return { stop, arcs: made.arcs.map((_, k) => (stop.now ? "past" : at < 0 ? "" : k === at ? "lit" : k < at ? "past" : "ahead")), ends: at < 0 ? [] : [made.arcs[at]!.from, made.arcs[at]!.to] };
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
    sheet.textContent = css;
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
    const want = Math.max(340, Math.min(820, innerHeight - 300));
    scene.style.height = `${Math.max(180, Math.min(want, stage ? stage.clientHeight - 12 : want))}px`;
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
    for (const id of ends) root.querySelector(`[data-session="${CSS.escape(id)}"],[data-person="${CSS.escape(id)}"]`)?.classList.add("is-end");
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
