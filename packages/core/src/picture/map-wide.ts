/**
 * An operation map with its lanes side by side (docs/operation-map.md §4c), for a screen with room: the people in a
 * band across the top, each lane a column, each session a card in its lane's column, and the handoffs listed below
 * in as many columns as fit. The cards, the numbers and the list are the phone's picture's own (`map-parts.ts`).
 * It is reached through `map-views.ts`, never from `base.ts`: a page that draws no map does not carry it. It
 * imports nothing but types, and is handed the parts it draws with (`map-kit.ts` says why).
 *
 * Arcs never run over a card. Between two lanes, and outside the first and the last, is a gutter of upright tracks;
 * above the lanes is a deck of level ones. An arc leaves its card by the edge that faces where it is going:
 *
 *   - within a lane: out of one edge, along a track in the gutter beside it, back into the same edge;
 *   - between neighboring lanes: across the gutter between them;
 *   - between lanes further apart: up its gutter, along the deck over the lanes between, down the other gutter;
 *   - to or from a person: straight down from the person's card into a gutter, by the deck when the card is not above it.
 *
 * What keeps the crossings few: a lane's arcs from above (a person's, the deck's) go down the side fewer other
 * lanes are reached from, and the arcs within the lane take the other side; tracks nest, short arcs inside long;
 * and the ends on a card's edge are in the order of their tracks, those that go up first, so no two arcs that end
 * on one card cross there. It is not the least number possible: lanes stay in the document's order.
 */

import type { Handoff, Id, OperationMap } from "../types.js";
import { open } from "./map-kit-open.js";
import type { MapKit } from "./map-kit.js";
import type { Level, Placed } from "./map-parts.js";
import type { MapPictureOptions } from "./svg.js";

const CARD = 168; // a card's width when there is room
const CARD_LOW = 150; // and its least: wider than the phone's, so that a repository's or a model's name is still whole on it
const LEAD = 9; // from a lane's edge to the first track beside it
const REACH = 18; // and from the page's margin to the outermost track, so a person's card is above every track
const GAP = 10; // between two lanes with nothing running between them
const DECK = 11; // between two level runs above the lanes
const HEAD = 5.5; // where an arc's line stops short of its end, for the arrowhead
const MORE = 3; // the lines words may take beyond the phone's: the cards and the list are narrower, and nothing is cut short for it
const LEAN = 2.5; // how far the ends on a card's two edges are set apart: up on its right, down on its left
const PERSON = 150; // the least width of a person's card
const LIST = 290; // the least width of a column of the list
const LEAST = 340; // and of the whole picture

type P = [number, number];
/** An upright run in gutter `g`: beside the lane on its left (0), across (1), or beside the lane on its right (2). */
type Run = { g: number; group: 0 | 1 | 2; lo: number; hi: number; t: number };
/** One end of an arc on a session's card: which edge, and whether it leaves upward (-1), across (0) or downward (1). */
type End = { id: Id; other: Id; side: 0 | 1; lean: number; run: Run; arc: number; from: boolean; y: number };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A path of level and upright runs without its repeats: a point said twice, or one in the middle of a straight run. */
function tidy(pts: P[]): P[] {
  const out: P[] = [];
  for (const p of pts) {
    const a = out[out.length - 1];
    const b = out[out.length - 2];
    if (a && a[0] === p[0] && a[1] === p[1]) continue;
    if (a && b && ((b[0] === a[0] && a[0] === p[0]) || (b[1] === a[1] && a[1] === p[1]))) out.pop();
    out.push(p);
  }
  return out;
}

/**
 * `width`, when given, is the room there is: the picture is as wide as its lanes need, which may be less, and is
 * more only when its cards are already at their least. The other options are the phone's picture's.
 */
export function mapWideWith(kit: MapKit, map: OperationMap, options: MapPictureOptions = {}): string {
  const { BADGE_R, M, PAD, SLOT, TRACK, TRACK_MIN, assignTracks, badgeHalf, drawn, fmt, frame, handoffRow, heading, inkFor, laneHead, numberRing, numberText, personCard, placeNumber, rect, sessionCard, stroke, styleOf, text } = open(kit);
  const theme = options.theme ?? "auto";
  const ink = inkFor(theme);
  const lanes = map.lanes;
  const n = lanes.length;
  const { sessions, people, handoffs, numberOf } = drawn(map);
  const members = lanes.map((lane) => sessions.filter((s) => s.lane === lane.id));
  const where = new Map<Id, { lane: number; k: number }>(); // a person is in lane -1
  people.forEach((p, k) => where.set(p.id, { lane: -1, k }));
  members.forEach((list, lane) => list.forEach((s, k) => where.set(s.id, { lane, k })));
  const pairs = handoffs.map((h) => [where.get(h.from)!, where.get(h.to)!] as const);

  // Which edge: an arc to another lane has no choice. A person's arcs take the side with fewer of those, and the
  // lane's own arcs the other side; with no person, the lane's own take the side with fewer.
  const reached = lanes.map(() => [0, 0]);
  const met = lanes.map(() => false);
  for (const [a, b] of pairs) {
    if (a.lane >= 0 && b.lane >= 0 && a.lane !== b.lane) {
      reached[a.lane]![a.lane < b.lane ? 1 : 0]!++;
      reached[b.lane]![b.lane < a.lane ? 1 : 0]!++;
    } else if (a.lane < 0 !== b.lane < 0) met[Math.max(a.lane, b.lane)] = true; // one end is a person
  }
  const personSide = reached.map(([l, r]) => (l! <= r! ? 0 : 1));
  const ownSide = reached.map(([l, r], i) => (met[i] ? 1 - personSide[i]! : r! <= l! ? 1 : 0));

  const runs: Run[] = [];
  const ends: End[] = [];
  const arcs = handoffs.map((h, arc) => {
    const [a, b] = pairs[arc]!;
    const run = (g: number, group: 0 | 1 | 2, lo: number, hi: number): Run => runs[runs.push({ g, group, lo: Math.min(lo, hi), hi: Math.max(lo, hi), t: 0 }) - 1]!;
    const end = (from: boolean, side: number, lean: number, r: Run): End => ends[ends.push({ id: from ? h.from : h.to, other: from ? h.to : h.from, side: side as 0 | 1, lean, run: r, arc, from, y: 0 }) - 1]!;
    if (a.lane < 0 && b.lane < 0) return {}; // person to person: along the deck
    if (a.lane < 0 || b.lane < 0) {
      const s = a.lane < 0 ? b : a;
      const side = personSide[s.lane]!;
      const e = end(a.lane >= 0, side, -1, run(s.lane + side, side ? 0 : 2, -1, s.k));
      return a.lane < 0 ? { to: e } : { from: e };
    }
    if (a.lane === b.lane) {
      const side = ownSide[a.lane]!;
      const r = run(a.lane + side, side ? 0 : 2, a.k, b.k);
      return { from: end(true, side, Math.sign(b.k - a.k), r), to: end(false, side, Math.sign(a.k - b.k), r) };
    }
    const right = a.lane < b.lane ? 1 : 0;
    if (Math.abs(a.lane - b.lane) === 1) {
      const r = run(Math.max(a.lane, b.lane), 1, 0, 0);
      return { from: end(true, right, 0, r), to: end(false, 1 - right, 0, r) };
    }
    return { from: end(true, right, -1, run(a.lane + right, right ? 0 : 2, -1, a.k)), to: end(false, 1 - right, -1, run(b.lane + 1 - right, right ? 2 : 0, -1, b.k)) };
  }) as { from?: End; to?: End }[];

  // Tracks. Beside a lane they nest, by the order of the cards alone, so a gutter's width is known before a card is
  // measured. An arc across a gutter has a track to itself; which one is settled once the cards have their places.
  const count = Array.from({ length: n + 1 }, () => [0, 0, 0]);
  for (let g = 0; g <= n; g++) {
    for (const group of [0, 2]) {
      const here = runs.filter((r) => r.g === g && r.group === group);
      const { tracks, count: c } = assignTracks(here.map((r) => ({ from: r.lo, to: r.hi })));
      here.forEach((r, k) => (r.t = tracks[k]!));
      count[g]![group] = c;
    }
  }
  for (const r of runs) if (r.group === 1) r.t = count[r.g]![1]!++;
  const T = count.map((c) => c[0]! + c[1]! + c[2]!);

  // The room: cards at their full width while it lasts, then narrower, down to their least; then the tracks close
  // up. Past that the picture is wider than the room, and whole.
  const steps = T.reduce((sum, t) => sum + Math.max(0, t - 1), 0);
  const lead = (g: number): number => (g === 0 && people.length ? REACH : LEAD); // before a gutter's first track
  const still = (g: number): number => (T[g] ? lead(g) + (g === n && people.length ? REACH : LEAD) : g > 0 && g < n ? GAP : 0); // a gutter's width but for its tracks
  const fixed = 2 * M + n * 2 * PAD + T.reduce((sum, _, g) => sum + still(g), 0);
  let track: number = TRACK;
  let card: number = CARD;
  const room = options.width;
  if (room !== undefined && Number.isFinite(room) && n > 0) {
    const cardAt = (t: number): number => (room - fixed - steps * t) / n;
    if (cardAt(TRACK) < CARD_LOW && steps) track = clamp((room - fixed - n * CARD_LOW) / steps, TRACK_MIN, TRACK);
    card = clamp(cardAt(track), CARD_LOW, CARD);
  }
  const gx: number[] = [];
  const lx: number[] = [];
  let x = M;
  for (let g = 0; g <= n; g++) {
    gx.push(x);
    x += still(g) + Math.max(0, T[g]! - 1) * track;
    if (g < n) {
      lx.push(x);
      x += card + 2 * PAD;
    }
  }
  // The picture is as wide as its lanes, or as its people need for their names; the lanes are in its middle.
  const W = Math.max(x + M, LEAST, people.length ? 2 * (M + PAD) + people.length * PERSON + (people.length - 1) * 8 : 0);
  const aside = (W - x - M) / 2;
  lx.forEach((v, i) => (lx[i] = v + aside));
  const trackX = (r: Run): number => aside + gx[r.g]! + lead(r.g) + (r.group === 0 ? r.t : r.group === 1 ? count[r.g]![0]! + r.t : T[r.g]! - 1 - r.t) * track;

  const body: string[] = [];
  const cardSvg: string[] = [];
  let y = heading(map, W, options, ink, body);

  // People: a band across the top. A person is on no machine and under no account.
  const span = new Map<Id, P>();
  let deckTop = y;
  if (people.length > 0) {
    const top = y;
    const pw = (W - 2 * M - 2 * PAD - (people.length - 1) * 8) / people.length;
    const measured = people.map((p) => personCard(p, pw, 0, ink, MORE));
    const ph = Math.max(...measured.map((c) => c.height));
    people.forEach((p, k) => {
      const px = M + PAD + k * (pw + 8);
      span.set(p.id, [px, px + pw]);
      cardSvg.push(measured[k]!.draw(px, top + PAD + 21.5, ph));
    });
    deckTop = top + PAD + 21.5 + ph;
    y = deckTop + PAD;
    body.push(
      `<g data-people="">${rect(M, top, W - 2 * M, y - top, { fill: ink("surface-2"), stroke: ink("line"), rx: 12, dash: "5 4" })}${text(M + PAD + 2, top + PAD + 12, people.length === 1 ? "Person" : "People", { size: 12.5, fill: ink("ink"), weight: "bold" })}</g>`,
    );
  }

  // Where each arc meets a person's card. One whose track is under the card drops straight from it. The others
  // leave from the end of the card nearer their track, each at a place of its own: clear of the straight ones, and
  // closer together when there are many, so none leaves the card. A person's handoff to themself leaves and
  // comes back about the middle of the card, each one outside the last.
  const asks = people.map(() => [] as { arc: number; end: 0 | 1; toward: number }[]);
  const middleOf = (k: number): number => (span.get(people[k]!.id)![0] + span.get(people[k]!.id)![1]) / 2;
  handoffs.forEach((_, arc) => {
    const [a, b] = pairs[arc]!;
    const { from, to } = arcs[arc]!;
    if (a.lane < 0) asks[a.k]!.push({ arc, end: 0, toward: to ? trackX(to.run) : a.k === b.k ? Number.NaN : middleOf(b.k) });
    if (b.lane < 0) asks[b.k]!.push({ arc, end: 1, toward: from ? trackX(from.run) : a.k === b.k ? Number.NaN : middleOf(a.k) });
  });
  const port = handoffs.map((): P => [0, 0]);
  const tracks = runs.map(trackX);
  people.forEach((p, k) => {
    const [x0, x1] = span.get(p.id)!;
    const under = (at: number): boolean => at >= x0 + 9.5 && at <= x1 - 9.5;
    const apart = clamp((x1 - x0 - 16) / (asks[k]!.filter((a) => !under(a.toward)).length + 1), 3, SLOT);
    const seats: number[] = [];
    // The nearest free place from `from`, going `step` at a time: on the card, clear of every track under it (an
    // arc on that track passes there) and of the places already taken. With none free, the card's end.
    const seat = (from: number, step: number): number => {
      const start = clamp(from, x0 + 8, x1 - 8);
      // On a crowded card the places close up, by halves, before two arcs are given one place.
      for (let gap = apart; gap >= 1.5; gap /= 2) {
        for (let x = start; x >= x0 + 8 && x <= x1 - 8; x += step) {
          if (tracks.every((t) => Math.abs(t - x) >= Math.min(5, gap)) && seats.every((t) => Math.abs(t - x) >= gap - 0.01)) {
            seats.push(x);
            return x;
          }
        }
      }
      seats.push(start);
      return start;
    };
    for (const ask of asks[k]!) {
      const to = ask.toward;
      port[ask.arc]![ask.end] = under(to) ? to : Number.isNaN(to) ? seat(middleOf(k) + (ask.end ? 7 : -7), ask.end ? 1 : -1) : to < x0 + 9.5 ? seat(x0 + 12, 1) : seat(x1 - 12, -1);
    }
  });
  // The two uprights an arc runs between on the deck, when it uses the deck.
  const over = handoffs.map((_, arc): P | undefined => {
    const { from, to } = arcs[arc]!;
    if (from && to && from.run === to.run) return undefined;
    return [from ? trackX(from.run) : port[arc]![0], to ? trackX(to.run) : port[arc]![1]];
  });
  const level = over.flatMap((o, arc) => (o && o[0] !== o[1] ? [{ arc, from: o[0], to: o[1] }] : []));
  const deck = assignTracks(level, 6);
  const lanesTop = y + (deck.count ? 20 + (deck.count - 1) * DECK : people.length ? 10 : 0);
  const deckY = new Map(level.map((l, k) => [l.arc, lanesTop - 10 - deck.tracks[k]! * DECK]));

  // Lanes: their headings on one line, their first cards on another, their boxes to one depth.
  const heads = lanes.map((lane, i) => laneHead(lane, lx[i]! + PAD, card, lanesTop + PAD + 12, ink, MORE));
  const cardsTop = Math.max(lanesTop + PAD, ...heads.map((h) => h.cardsTop));
  const edges = new Map<Id, [End[], End[]]>();
  for (const e of ends) (edges.get(e.id) ?? edges.set(e.id, [[], []]).get(e.id)!)[e.side].push(e);
  const box = new Map<Id, { x: number; y: number; h: number }>();
  let floor = cardsTop;
  members.forEach((list, i) => {
    let cy = cardsTop;
    for (const s of list) {
      const on = edges.get(s.id) ?? [[], []];
      const c = sessionCard(map, s, card, Math.max(on[0].length, on[1].length), ink, options, MORE);
      box.set(s.id, { x: lx[i]! + PAD, y: cy, h: c.height });
      cardSvg.push(c.draw(lx[i]! + PAD, cy));
      cy += c.height + (c.family ? 14 : 8);
    }
    if (list.length === 0) {
      heads[i]!.svg.push(text(lx[i]! + PAD + 2, cardsTop + 12, "no sessions", { size: 10.5, fill: ink("ink-3") }));
      cy += 20;
    }
    floor = Math.max(floor, cy + PAD - 8);
  });
  lanes.forEach((lane, i) => body.push(`<g data-lane="${lane.id}">${rect(lx[i]!, lanesTop, card + 2 * PAD, floor - lanesTop, { fill: ink("surface-2"), stroke: ink("line"), rx: 12 })}${heads[i]!.svg.join("")}</g>`));
  body.push(...cardSvg);
  y = n > 0 ? floor + 10 : lanesTop; // with no lanes the list still starts below the deck

  // The ends down each edge: those that go up, inner track first; then a session's handoff to itself and the arcs
  // across, in the order of the cards they reach; then those that go down, outer track first. The two edges are
  // set a little apart, up on the right and down on the left: two cards that are level across a gutter would
  // otherwise put an arc leaving one and an arc reaching the other on one line, and they would read as one arc.
  const middle = (id: Id): number => box.get(id)!.y + box.get(id)!.h / 2;
  const key = (e: End): number => (e.lean ? -e.lean * e.run.t : e.run.group === 1 ? middle(e.other) : -Infinity);
  for (const [id, both] of edges) {
    for (const list of both) {
      list.sort((a, b) => a.lean - b.lean || key(a) - key(b) || a.arc - b.arc || (a.from ? -1 : 1));
      list.forEach((e, k) => (e.y = middle(id) + (k - (list.length - 1) / 2) * SLOT + (e.side ? -LEAN : LEAN)));
    }
  }
  // Arcs across one gutter: those that rise from left to right take the left tracks, the highest first; those that
  // fall take the right ones, the lowest first. Two that rise, or two that fall, then never cross.
  for (let g = 1; g < n; g++) {
    const across = arcs.flatMap(({ from, to }) => (from && to && from.run === to.run && from.run.g === g && from.run.group === 1 ? [from.side ? { run: from.run, left: from.y, right: to.y } : { run: from.run, left: to.y, right: from.y }] : []));
    const rises = (c: { left: number; right: number }): boolean => c.right < c.left;
    across.sort((a, b) => Number(rises(b)) - Number(rises(a)) || (rises(a) ? a.left - b.left : b.left - a.left));
    // Where the run that reaches the right card from one track and the run that leaves the left card for a track
    // further right are level, they would share the line between the two tracks: those two arcs change places.
    const inLine = (p: { left: number }, q: { right: number }): boolean => Math.abs(p.left - q.right) < 2;
    for (let i = 0; i < across.length; i++) {
      for (let j = i + 1; j < across.length; j++) if (inLine(across[j]!, across[i]!) && !inLine(across[i]!, across[j]!)) [across[i], across[j]] = [across[j]!, across[i]!];
    }
    across.forEach((c, k) => (c.run.t = k));
  }

  // Every arc as its corners, from its tail to its head.
  const edge = (e: End): P => [box.get(e.id)!.x + (e.side ? card : 0), e.y];
  const paths = handoffs.map((h, arc): P[] => {
    const { from, to } = arcs[arc]!;
    if (from && to && from.run === to.run) return tidy([edge(from), [trackX(from.run), from.y], [trackX(to.run), to.y], edge(to)]);
    const [x1, x2] = over[arc]!;
    const at = deckY.get(arc) ?? lanesTop;
    const leg = (e: End | undefined, down: number): P[] => (e ? [edge(e), [down, e.y]] : [[down, deckTop]]);
    return tidy([...leg(from, x1), [x1, at], [x2, at], ...leg(to, x2).reverse()]);
  });
  const levels: Level[] = paths.flatMap((pts, of) => pts.slice(1).flatMap((p, k) => (p[1] === pts[k]![1] ? [{ y: p[1], from: Math.min(p[0], pts[k]![0]), to: Math.max(p[0], pts[k]![0]), of }] : [])));

  // Three layers, as on the phone's picture: the rings, then every line (an arc's own line stops at its ring; the
  // others pass over it), then the numbers.
  const uprights: Level[] = paths.flatMap((pts, of) => pts.slice(1).flatMap((p, k) => (p[0] === pts[k]![0] ? [{ y: p[0], from: Math.min(p[1], pts[k]![1]), to: Math.max(p[1], pts[k]![1]), of }] : [])));
  const placed: Placed[] = [];
  const turned: Placed[] = []; // the same numbers with their two directions changed over, for one placed along a level run
  const plates: string[] = [];
  const lines: string[] = [];
  const numbers: string[] = [];
  handoffs.forEach((h, arc) => {
    const pts = paths[arc]!;
    const style = styleOf(h);
    const color = ink(style.color);
    const label = String(numberOf.get(h.id)!);
    const last = pts.length - 2;
    if (last < 0) return;
    const length = (k: number): number => Math.abs(pts[k + 1]![0] - pts[k]![0]) + Math.abs(pts[k + 1]![1] - pts[k]![1]);
    const upright = (k: number): boolean => pts[k]![0] === pts[k + 1]![0];
    const r = pts.map((_, k) => (k === 0 || k > last ? 0 : Math.min(6, length(k - 1) / 2, length(k) / 2)));
    // The number sits on the arc's longest upright, clear of the other numbers and of the level runs that cross it.
    // An arc with no upright to speak of and a long level run (one that only crosses the deck, or runs straight
    // from card to card) has it on that run, placed the same way with the two directions changed over.
    const longest = (want: boolean): number => {
      let at = -1;
      for (let k = 0; k <= last; k++) if (upright(k) === want && (at < 0 || length(k) > length(at))) at = k;
      return at;
    };
    const flat = longest(false);
    let on = longest(true);
    if (flat >= 0 && (on < 0 || (length(on) < 24 && length(flat) >= 40))) on = -1;
    const half = badgeHalf(label);
    let [nx, ny, cut] = [0, 0, false];
    if (on >= 0) {
      const [y1, y2] = [pts[on]![1], pts[on + 1]![1]];
      const dir = Math.sign(y2 - y1);
      nx = pts[on]![0];
      ny = placeNumber(nx, y1, y2, half, arc, placed, levels);
      turned.push({ x: ny, y: nx, half: BADGE_R });
      cut = (ny - dir * BADGE_R - (y1 + dir * r[on]!)) * dir >= 0 && (y2 - dir * (on === last ? HEAD : r[on + 1]!) - (ny + dir * BADGE_R)) * dir >= 0;
    } else if (flat >= 0) {
      ny = pts[flat]![1];
      nx = placeNumber(ny, pts[flat]![0], pts[flat + 1]![0], BADGE_R, arc, turned, uprights);
      placed.push({ x: nx, y: ny, half });
    }

    let d = `M${fmt(pts[0]![0])},${fmt(pts[0]![1])}`;
    let ux = 0;
    let uy = 0;
    for (let k = 0; k <= last; k++) {
      const [x1, y1] = pts[k + 1]!;
      ux = Math.sign(x1 - pts[k]![0]);
      uy = Math.sign(y1 - pts[k]![1]);
      const stop = k === last ? HEAD : r[k + 1]!;
      if (cut && k === on) d += ` L${fmt(nx)},${fmt(ny - uy * BADGE_R)} M${fmt(nx)},${fmt(ny + uy * BADGE_R)}`;
      d += ` L${fmt(x1 - ux * stop)},${fmt(y1 - uy * stop)}`;
      if (k < last) d += ` Q${fmt(x1)},${fmt(y1)} ${fmt(x1 + Math.sign(pts[k + 2]![0] - x1) * stop)},${fmt(y1 + Math.sign(pts[k + 2]![1] - y1) * stop)}`;
    }
    const [hx, hy] = [pts[last + 1]![0] - 0.5 * ux, pts[last + 1]![1] - 0.5 * uy];
    const head = `<path d="M${fmt(hx)},${fmt(hy)} L${fmt(hx - 6.5 * ux - 3.6 * uy)},${fmt(hy - 6.5 * uy - 3.6 * ux)} L${fmt(hx - 6.5 * ux + 3.6 * uy)},${fmt(hy - 6.5 * uy + 3.6 * ux)} z" style="fill:${color}"/>`;
    const tail = `<circle cx="${fmt(pts[0]![0])}" cy="${fmt(pts[0]![1])}" r="2.2" style="fill:${color}"/>`;
    const plate = `<g data-plate="${h.id}">${numberRing(nx, ny, label, color, ink)}</g>`;
    if (cut) plates.push(plate);
    lines.push(`<g data-handoff="${h.id}"><path d="${d}" ${stroke(style, color)}/>${tail}${head}</g>${cut ? "" : plate}`);
    numbers.push(`<g data-number="${h.id}">${numberText(nx, ny, label, ink)}</g>`);
  });
  body.push(...plates, ...lines, ...numbers);

  // The list: every handoff, numbered as its arc is, in as many columns as fit, each about as long as the others.
  if (map.handoffs.length > 0) {
    y += 6;
    body.push(text(M, y + 11, "Handoffs", { size: 12.5, fill: ink("ink"), weight: "bold" }));
    y += 20;
    const columns = clamp(Math.floor((W - 2 * M + 16) / (LIST + 16)), 1, map.handoffs.length);
    const width = (W - 2 * M - (columns - 1) * 16) / columns;
    const row = (h: Handoff, left: number, top: number) => handoffRow(map, h, numberOf.get(h.id)!, left, top, width, ink, MORE);
    const heights = map.handoffs.map((h) => row(h, 0, 0).bottom);
    const total = heights.reduce((sum, v) => sum + v, 0);
    let column = 0;
    let top = y;
    let before = 0;
    let bottom = y;
    map.handoffs.forEach((h, k) => {
      const next = Math.min(columns - 1, Math.floor(((before + heights[k]! / 2) * columns) / total));
      if (next !== column) top = y;
      column = next;
      const drawnRow = row(h, M + column * (width + 16), top);
      body.push(drawnRow.svg);
      top = drawnRow.bottom;
      before += heights[k]!;
      bottom = Math.max(bottom, top);
    });
    y = bottom;
  }

  return frame(W, y + M - 6, map.name || map.id, theme, ink, body.join(""), "map");
}
