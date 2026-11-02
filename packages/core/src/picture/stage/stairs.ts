/**
 * The stairs: a document in three dimensions as sheets stacked one above
 * another, each card standing on its sheet, each link an arc from one card's top to another's. An operation map's
 * lanes are its sheets, with the people on top; a graph's loops and subgroophs are its (`graph-scene.ts`).
 *
 * This is the arithmetic: where every sheet, card and arc is, where the view starts, and how it is fitted. The web
 * app makes markup of it and turns it with CSS 3D transforms (`apps/web/src/ui/map/space.ts`, a piece fetched when
 * the stairs are chosen, through a door of core's own); `still.ts` draws it once, as an SVG. It imports only types
 * and is handed core's parts (`map-kit.ts` says why), so fetching it moves nothing else.
 */
import type { Color, MapPictureOptions } from "../svg.js";
import type { MapKit } from "../map-kit.js";
import type { Handoff, Id, OperationMap } from "../../types.js";
import type { V } from "./prim.js";

export type { V };
type Live = NonNullable<MapPictureOptions["live"]>;

export const CARD = 128; // a card's width
const GAP = 14; // between two cards of a row
const ROW = 104; // between two rows on a sheet, front to back
const EDGE = 24; // from a sheet's edge to its cards
const CLEAR = 56; // between a card's top and the sheet above, for two lanes on one machine
const FORWARD = 34; // how far each sheet stands in front of the one above
const LABEL = 36; // a sheet's label, under its front edge


/** Where the view starts, and how far it turns: the cards face the front, so it never shows their backs. */
export const START = { yaw: -0.46, pitch: 0.46 };

/** `esc` in `xml.ts`, written out here because this file imports only types. */
export const esc = (s: string): string =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/**
 * A stop of the slider: what it says, and what it lights. `handoff` is the link that is lit, with its two ends.
 * A stop about no link may light cards (`ends`) or a sheet (`sheet`, the sheet's own mark); and `alone` leaves the
 * other links as they are, for a slider whose order is not the order the links are drawn in.
 */
export type Stop = { handoff?: Id; now?: boolean; says: string; short: string; ends?: Id[]; sheet?: string; alone?: boolean };
export type Arc = { id: Id; n: number; from: Id; to: Id; a: V; b: V; lift: number };
/** A sheet of the scene, with what stands on it; a card; and a link from one card to another. */
export type Card = { id: Id; h: number; svg: () => string };
export type Sheet = { cls: string; mark: string; name: string; sub: string; place: string; gap: number; items: Card[] };
export type Link = { id: Id; n: number; from: Id; to: Id; style: { color: Color; dash?: string; width: number } };
/**
 * What a scene is of, whatever that is: an operation map's lanes, sessions and handoffs (`mapScene`, below), or a loop
 * graph's loops, nodes and edges (`graphScene` in `graph-scene.ts`). The words are the caller's, because a map
 * steps through handoffs and a graph through edges.
 */
export type Scene = { title: string; sheets: Sheet[]; links: Link[]; stops: Stop[]; per: number; link: string; links_: string; none: string; range: string; note: string; flat: string; step?: string };


/** What the hooks saw of a session, in a word or two: the last stop of the slider shows it. */
function seen(now: Live[string]): { state: "working" | "waiting" | "quiet" | "ended"; says: string } {
  const state = now.working > 0 ? "working" : now.waiting > 0 ? "waiting" : (now.quiet ?? 0) > 0 ? "quiet" : "ended";
  const agents = now.agentsRunning > 0 ? ` · ${now.agentsRunning} agent${now.agentsRunning === 1 ? "" : "s"}` : "";
  return { state, says: `${state === "quiet" ? "gone quiet" : state}${state === "working" ? agents : ""}` };
}

/**
 * An operation map as a scene: its sheets with their cards, its handoffs as links, and the stops of the slider.
 * `per` is how many cards stand in a row: three at a phone's width, more where there is room. With `live` the
 * cards carry what the hooks saw, and the slider has a last stop, now.
 */
export function mapScene(kit: MapKit, map: OperationMap, opts: { per?: number; live?: Live; at?: string } = {}): Scene {
  // The kit's parts by name; the order is packages/core/src/picture/map-kit.ts's.
  const [, , , , , , , , , carriedBy, drawn, fmt, , , , inkFor, , , , , , , rect, , , styleOf, text, textWidth, wrap] = kit;
  const ink = inkFor("auto");
  const per = Math.max(1, opts.per ?? 3);
  const { sessions, people, handoffs, numberOf } = drawn(map);
  const nameOf = (id: Id): string => map.sessions.find((s) => s.id === id)?.name || (map.people ?? []).find((p) => p.id === id)?.name || id;

  // The sheets: the people's first, then each lane's, in the document's order.
  const card = (id: Id, name: string, person: boolean, under: string, count: number, model = "", now?: Live[string]): Card => {
    const pill = count > 1 ? `×${count}` : "";
    const pillW = pill ? textWidth(pill, 9.5, "bold") + 10 : 0;
    const lines = wrap(name, (k) => CARD - 16 - (pill && k === 0 ? pillW + 4 : 0), 12.5, 3, "bold");
    const mark = now ? seen(now) : undefined;
    const h = 7 + lines.length * 15 + 13 + (model ? 11.5 : 0) + (mark ? 15 : 0) + 6;
    return {
      id,
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
  // Each sheet is clear of the cards on the one above by more where the two lanes are further apart.
  const lanes = map.lanes;
  const sheets: Sheet[] = [
    ...(people.length ? [{ cls: " is-people", mark: 'data-people=""', name: people.length === 1 ? "Person" : "People", sub: "on no machine, under no account", place: "", gap: 0, items: people.map((p) => card(p.id, p.name || p.id, true, "person", 1)) }] : []),
    ...lanes.map((lane, k) => ({
      cls: "",
      mark: `data-lane="${esc(lane.id)}"`,
      name: lane.name || lane.id,
      sub: `${lane.machine} · ${lane.account}`,
      place: lane.place ?? "",
      gap: k === 0 ? 1 : apart(lanes[k - 1]!, lane),
      items: sessions.filter((s) => s.lane === lane.id).map((s) => card(s.id, s.name || s.id, false, (Object.hasOwn(HARNESS, s.harness) ? HARNESS[s.harness]! : s.harness), s.count ?? 1, s.model, opts.live?.[s.id])),
    })),
  ];
  const links: Link[] = handoffs.map((h) => ({ id: h.id, n: numberOf.get(h.id)!, from: h.from, to: h.to, style: styleOf(h) }));

  // The slider's stops: all of them, then one at a time in the map's order, then now, where the hooks saw anything.
  const total = handoffs.length;
  const stops: Stop[] = [{ short: "all handoffs", says: total === 0 ? "This map has no handoffs to step through." : total === 1 ? "The map's one handoff is lit." : `All ${total} handoffs are lit. Move the slider or press Play to light them one at a time.` }];
  handoffs.forEach((h: Handoff, k) => {
    const who = h.from === h.to ? `${nameOf(h.from)} to itself` : `${nameOf(h.from)} to ${nameOf(h.to)}`;
    stops.push({ handoff: h.id, short: `handoff ${links[k]!.n} of ${map.handoffs.length}`, says: `Handoff ${links[k]!.n} of ${map.handoffs.length}: ${who} · ${carriedBy(map, h)}${h.what ? ` · ${h.what}` : ""}` });
  });
  if (opts.live) {
    const states = Object.values(opts.live).map((now) => seen(now).state);
    const count = (state: string, word: string): string[] => (states.includes(state as never) ? [`${states.filter((s) => s === state).length} ${word}`] : []);
    const said = [...count("working", "working"), ...count("waiting", "waiting"), ...count("quiet", "gone quiet"), ...count("ended", "ended")];
    stops.push({ now: true, short: "now", says: `Now${opts.at ? `, as the hooks saw it at ${opts.at.slice(0, 16).replace("T", " ")} UTC` : ""}: ${said.length ? said.join(", ") : "no session has been seen"}.` });
  }

  return {
    title: map.name || map.id,
    sheets,
    links,
    stops,
    per,
    link: "handoff",
    links_: "handoffs",
    none: " · no sessions",
    range: "Handoff, in the order the map lists them",
    note: `The order the map lists its handoffs in. An order, not a clock: a map records no times${opts.live ? "; the slider's last stop is now" : ""}.`,
    flat: ' The picture and the sequence show the same map, flat. <button type="button" data-flat="picture">Picture</button> <button type="button" data-flat="sequence">Sequence</button>',
  };
}

/** Where every sheet, card and arc of a scene stands: the arithmetic of the scene, which the page makes markup of and a still draws. */
export type Layout = {
  /** how wide every sheet is */
  width: number;
  /** each sheet, top to bottom: how far down it lies, where its front and back edges are, how deep it is, and where
   *  each of its cards stands (two cards of one id, which a document in error may have, stand each in its place) */
  placed: { sheet: Sheet; floor: number; front: number; back: number; depth: number; at: V[] }[];
  cards: Map<Id, { at: V; h: number }>;
  arcs: Arc[];
  floors: number[];
  /** what the starting view must show whole: the sheets with their labels, and each arc's highest point there */
  box: { min: V; max: V };
};

export function layout({ sheets, links, per }: Scene): Layout {
  const across = Math.max(1, Math.min(per, Math.max(...sheets.map((s) => s.items.length), 1)));
  const width = 2 * EDGE + across * CARD + (across - 1) * GAP;
  // A sheet is as deep as its rows; the front edges step forward down the stack, so no sheet stands over the
  // front row of the one below it.
  const depthOf = (count: number): number => 2 * EDGE + (Math.max(1, Math.ceil(count / across)) - 1) * ROW;
  const deepest = Math.max(0, ...sheets.map((s) => depthOf(s.items.length))) + Math.max(0, sheets.length - 1) * FORWARD;
  // Every sheet keeps the room the tallest card needs, so that the step from one sheet to the next is that room and
  // the gap, and the gap alone says how far apart two sheets are.
  const band = Math.max(40, ...sheets.flatMap((s) => s.items.map((c) => c.h)));

  // Down the stack: each sheet clear of the cards on the one above, by its gap.
  const cards: Layout["cards"] = new Map();
  const floors: number[] = [];
  const placed: Layout["placed"] = [];
  let floor = 0;
  sheets.forEach((sheet, i) => {
    floor += band + (i === 0 ? 0 : CLEAR * sheet.gap);
    floors.push(floor);
    const depth = depthOf(sheet.items.length);
    const front = deepest - (sheets.length - 1 - i) * FORWARD;
    const back = front - depth;
    const at: V[] = [];
    placed.push({ sheet, floor, front, back, depth, at });
    sheet.items.forEach((c, j) => {
      const row = Math.floor(j / across);
      const inRow = Math.min(across, sheet.items.length - row * across);
      const x = (width - inRow * CARD - (inRow - 1) * GAP) / 2 + (j % across) * (CARD + GAP);
      const z = front - EDGE - row * ROW; // the first row is the front one
      at.push([x, floor - c.h, z]);
      cards.set(c.id, { at: at[j]!, h: c.h });
    });
  });

  // The arcs: from a place on the sender's top edge to one on the receiver's. The ends along an edge are in the
  // order of where they lead, left to right, so arcs leave a card without crossing there.
  const ends = new Map<Id, { arc: number; from: boolean; toward: number }[]>();
  links.forEach((h, arc) => {
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
  const arcs: Arc[] = links.map((h, arc) => {
    const [a, b] = [place.get(`${arc}a`)!, place.get(`${arc}b`)!];
    const pair = [h.from, h.to].sort().join(" ");
    const nth = pairs.get(pair) ?? 0;
    pairs.set(pair, nth + 1);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    return { id: h.id, n: h.n, from: h.from, to: h.to, a, b, lift: 16 + length * 0.16 + nth * 9 };
  });
  // The box the starting view must show whole: the sheets with their labels, and each arc's highest point there.
  const box: Layout["box"] = { min: [0, 0, 0], max: [width, (floors[floors.length - 1] ?? 0) + LABEL, deepest] };
  for (const arc of arcs) {
    const side = bow(arc, START.yaw, START.pitch);
    for (const k of [0, 1, 2] as const) {
      const top = (arc.a[k] + arc.b[k]) / 2 + side[k] * (arc.lift + 9);
      box.min[k] = Math.min(box.min[k], top);
      box.max[k] = Math.max(box.max[k], top);
    }
  }
  return { width, placed, cards, arcs, floors, box };
}

export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scaled = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
export const unit = (a: V): V => scaled(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

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
export function fit(box: Layout["box"], w: number, h: number, lens: number, yaw = START.yaw, pitch = START.pitch): number {
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
