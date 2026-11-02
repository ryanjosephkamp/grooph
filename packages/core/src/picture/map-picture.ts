/**
 * The picture of an operation map (docs/operation-map.md §4): the people it
 * names in a band at the top, then lanes stacked top to bottom, each session a
 * card in its lane, each handoff a numbered arc in the right-hand margin, and
 * the handoffs listed below with their carriers.
 *
 * Arcs run in a margin and not between the cards because a map's handoffs
 * criss-cross: drawn through the lanes they would cover the words. In the
 * margin each has its own track, its number says which line of the list it
 * is, and its line style says what carries it.
 *
 * The words come first. The cards keep most of a lane's width however many
 * handoffs there are (the tracks move closer together instead), and a name,
 * a model or a role that does not fit on its line goes onto the next one:
 * nothing is cut short while there is room to say it.
 */

import type { Handoff, Id, OperationMap } from "../types.js";
import {
  CARD_LEAST,
  CARD_PAD,
  M,
  PAD,
  SLOT,
  TRACK,
  TRACK_MIN,
  badgeHalf,
  drawn,
  handoffRow,
  heading,
  laneHead,
  numberRing,
  numberText,
  personCard,
  placeNumber,
  sessionCard,
  stroke,
  styleOf,
  BADGE_R,
  type Level,
  type Placed,
} from "./map-parts.js";
import { PICTURE_WIDTH, assignTracks, fmt, frame, inkFor, rect, text, type Ink, type MapPictureOptions } from "./svg.js";

export { CARRIER_STYLE } from "./map-parts.js";

const TRACK_LEAD = 16; // from a card's edge to the first track
const TRACK_TAIL = 14; // from the last track to the lane's edge
const CARD_SHARE = 0.56; // the share of a lane's inner width its cards keep while the tracks can still close up

type Card = { height: number; y: number; slots: { handoff: Id; end: "from" | "to" }[] };

/**
 * An operation map as one SVG with its words on it, laid out for a phone. Sessions and handoffs carry
 * `data-session` and `data-handoff`, so a page that holds the picture inline can make them tappable. A session
 * whose lane is unknown, and a handoff whose end is, are left out: the validator names them. A map's other two
 * views, its lanes side by side and its sequence, are behind a door of their own (`map-views.ts`).
 */
export function mapPicture(map: OperationMap, options: MapPictureOptions = {}): string {
  const theme = options.theme ?? "auto";
  const W = options.width ?? PICTURE_WIDTH;
  const ink = inkFor(theme);
  const lanes = map.lanes;
  const { sessions, people, handoffs, numberOf } = drawn(map);
  const order = new Map<Id, number>(); // the order the cards are drawn in: people first, then each lane's sessions
  for (const p of people) order.set(p.id, order.size);
  for (const lane of lanes) for (const s of sessions) if (s.lane === lane.id) order.set(s.id, order.size);

  // Each end of a handoff gets a slot on its card's right edge: ends that go up first, then those that go down, so arcs leave without crossing.
  const slots = new Map<Id, { handoff: Id; end: "from" | "to"; other: number }[]>();
  for (const h of handoffs) {
    (slots.get(h.from) ?? slots.set(h.from, []).get(h.from)!).push({ handoff: h.id, end: "from", other: order.get(h.to)! });
    (slots.get(h.to) ?? slots.set(h.to, []).get(h.to)!).push({ handoff: h.id, end: "to", other: order.get(h.from)! });
  }
  for (const [id, list] of slots) {
    const here = order.get(id)!;
    const rank = (s: { other: number; end: "from" | "to" }): number => (s.other < here ? 0 : s.other === here ? 1 : 2);
    list.sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? b.other - a.other : a.other - b.other) || numberOf.get(a.handoff)! - numberOf.get(b.handoff)! || (a.end === "from" ? -1 : 1));
  }

  // Tracks depend only on the order of the ends down the page, so the margin's width is known before any card is measured.
  const position = (id: Id, handoff: Id, end: "from" | "to"): number => order.get(id)! * 1000 + slots.get(id)!.findIndex((s) => s.handoff === handoff && s.end === end);
  const { tracks, count } = assignTracks(handoffs.map((h) => ({ from: position(h.from, h.id, "from"), to: position(h.to, h.id, "to") })));
  const laneX = M;
  const laneW = W - 2 * M;
  // The margin grows with the tracks until the cards would lose their share; then the tracks close up, as far as
  // TRACK_MIN. Past that the margin grows again, until the cards are at their least width; then the tracks close
  // further, without limit. A map with fifty handoffs through one hub is a tangle, and still a picture.
  const inner = laneW - 2 * PAD;
  const fit = (room: number): number => (room - TRACK_LEAD - TRACK_TAIL) / (count - 1);
  const track = count <= 1 ? TRACK : Math.min(TRACK, Math.max(TRACK_MIN, fit(inner * (1 - CARD_SHARE))), Math.max(fit(inner - CARD_LEAST), fit(inner * (1 - CARD_SHARE))));
  const margin = handoffs.length === 0 ? 0 : TRACK_LEAD + (count - 1) * track + TRACK_TAIL;
  const cardX = laneX + PAD;
  const cardW = laneW - 2 * PAD - margin;

  const body: string[] = [];
  let y = heading(map, W, options, ink, body);

  const cards = new Map<Id, Card>();
  const cardSvg: string[] = [];

  // People: a band of their own above the lanes. A person is on no machine and under no account.
  if (people.length > 0) {
    const top = y;
    const inner: string[] = [];
    let cy = top + PAD + 12;
    inner.push(text(laneX + PAD + 2, cy, people.length === 1 ? "Person" : "People", { size: 12.5, fill: ink("ink"), weight: "bold" }));
    cy += 9.5;
    for (const person of people) {
      const ends = slots.get(person.id) ?? [];
      const card = personCard(person, cardW, ends.length, ink);
      cards.set(person.id, { height: card.height, y: cy, slots: ends });
      cardSvg.push(card.draw(cardX, cy));
      cy += card.height + 8;
    }
    const bottom = cy + PAD - 8;
    body.push(`<g data-people="">${rect(laneX, top, laneW, bottom - top, { fill: ink("surface-2"), stroke: ink("line"), rx: 12, dash: "5 4" })}${inner.join("")}</g>`);
    y = bottom + 10;
  }

  // Lanes and their cards.
  for (const lane of lanes) {
    const top = y;
    // The lane's words keep to the cards' column: the margin beside them belongs to the arcs.
    const head = laneHead(lane, cardX, cardW, top + PAD + 12, ink);
    const inner = head.svg;
    let cy = head.cardsTop;

    const members = sessions.filter((s) => s.lane === lane.id);
    for (const session of members) {
      const ends = slots.get(session.id) ?? [];
      const card = sessionCard(map, session, cardW, ends.length, ink, options);
      cards.set(session.id, { height: card.height, y: cy, slots: ends });
      cardSvg.push(card.draw(cardX, cy));
      cy += card.height + (card.family ? 14 : 8);
    }
    if (members.length === 0) {
      cy += 12;
      inner.push(text(laneX + PAD + 2, cy, "no sessions", { size: 10.5, fill: ink("ink-3") }));
      cy += 8;
    }
    const bottom = cy + PAD - 8;
    body.push(`<g data-lane="${lane.id}">${rect(laneX, top, laneW, bottom - top, { fill: ink("surface-2"), stroke: ink("line"), rx: 12 })}${inner.join("")}</g>`);
    y = bottom + 10;
  }
  body.push(...cardSvg);

  // Arcs: out of the source card's edge, along a track in the margin, into the target's edge.
  const edgeX = cardX + cardW;
  const slotY = (id: Id, handoff: Id, end: "from" | "to"): number => {
    const card = cards.get(id)!;
    const k = card.slots.findIndex((s) => s.handoff === handoff && s.end === end);
    return card.y + card.height / 2 + (k - (card.slots.length - 1) / 2) * SLOT;
  };
  // Where each arc runs: its two ends on the cards' edge and its upright's track.
  const runs = handoffs.map((h, i) => ({ y1: slotY(h.from, h.id, "from"), y2: slotY(h.to, h.id, "to"), x: edgeX + TRACK_LEAD + tracks[i]! * track }));
  // A level run counts from wherever it starts: in a picture too narrow for its cards the tracks are left of the edge.
  const levels: Level[] = runs.flatMap((o, of) => [o.y1, o.y2].map((level) => ({ y: level, from: -Infinity, to: o.x, of })));
  const badges: Placed[] = [];
  // Three layers, so that a number is seen to belong to one line. The rings go down first. Then every line: an arc's
  // own line stops at its ring and starts again beyond it, and every other line that passes behind the ring is drawn
  // over it, unbroken. Then the numbers, on top. A ring wider than the gap between two tracks (any two-digit number,
  // on a crowded map) used to hide its neighbor's line, and a line that stops at a ring reads as that ring's.
  const plates: string[] = [];
  const lines: string[] = [];
  const numbers: string[] = [];
  handoffs.forEach((h, i) => {
    const style = styleOf(h);
    const color = ink(style.color);
    const { y1, y2, x } = runs[i]!;
    const r = Math.min(6, Math.abs(y2 - y1) / 2);
    const dir = y2 >= y1 ? 1 : -1;
    const head = `<path d="M${fmt(edgeX + 0.5)},${fmt(y2)} l6.5,-3.6 v7.2 z" style="fill:${color}"/>`;
    const tail = `<circle cx="${fmt(edgeX)}" cy="${fmt(y1)}" r="2.2" style="fill:${color}"/>`;
    const n = String(numberOf.get(h.id)!);
    // The number sits on the arc's upright, clear of the other numbers and of the level runs that cross it.
    const badgeY = placeNumber(x, y1, y2, badgeHalf(n), i, badges, levels);
    // The arc's own line leaves a gap for its ring, where the ring sits on the straight part of the upright.
    const top = y1 + dir * r;
    const bottom = y2 - dir * r;
    const before = badgeY - dir * BADGE_R;
    const after = badgeY + dir * BADGE_R;
    const fits = (before - top) * dir >= 0 && (bottom - after) * dir >= 0;
    const upright = fits ? `V${fmt(before)} M${fmt(x)},${fmt(after)} V${fmt(bottom)}` : `V${fmt(bottom)}`;
    const d = `M${fmt(edgeX)},${fmt(y1)} H${fmt(x - r)} Q${fmt(x)},${fmt(y1)} ${fmt(x)},${fmt(top)} ${upright} Q${fmt(x)},${fmt(y2)} ${fmt(x - r)},${fmt(y2)} H${fmt(edgeX + 5.5)}`;
    const line = `<path d="${d}" ${stroke(style, color)}/>${tail}${head}`;
    const plate = `<g data-plate="${h.id}">${numberRing(x, badgeY, n, color, ink)}</g>`;
    // An arc too short to leave a gap (a session's handoff to itself) keeps its ring over its own line, as before.
    if (fits) plates.push(plate);
    lines.push(`<g data-handoff="${h.id}">${line}</g>${fits ? "" : plate}`);
    numbers.push(`<g data-number="${h.id}">${numberText(x, badgeY, n, ink)}</g>`);
  });
  body.push(...plates, ...lines, ...numbers);

  // The list: every handoff, numbered as its arc is.
  if (map.handoffs.length > 0) {
    y += 6;
    body.push(text(M, y + 11, "Handoffs", { size: 12.5, fill: ink("ink"), weight: "bold" }));
    y += 20;
    for (const h of map.handoffs) {
      const row = handoffRow(map, h, numberOf.get(h.id)!, M, y, W - 2 * M, ink);
      body.push(row.svg);
      y = row.bottom;
    }
  }

  return frame(W, y + M - 6, map.name || map.id, theme, ink, body.join(""), "map");
}

/** The handoffs in the order their numbers are drawn, for a list beside the picture. */
export const handoffNumbers = (map: OperationMap): { handoff: Handoff; n: number }[] => map.handoffs.map((handoff, i) => ({ handoff, n: i + 1 }));

export type { Ink };
