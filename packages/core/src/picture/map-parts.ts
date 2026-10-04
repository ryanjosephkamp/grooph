/**
 * What every view of an operation map draws the same way: a session's card, a
 * person's, a lane's heading, a handoff's number in its ring, its line in the
 * list, and where a number may sit on its arc. The phone's picture
 * (`map-picture.ts`), the lanes side by side (`map-wide.ts`) and the sequence
 * (`map-sequence.ts`) are three placements of these parts.
 */

import { mapLiveLine } from "../events.js";
import { CARRIER_LABEL, endName, handoffCarrierText, mapShape, mapShapeLine, wakesItself } from "../map.js";
import type { CarrierKind, Handoff, Id, Lane, OperationMap, Person, Session } from "../types.js";
import { fmt, pill, rect, text, textWidth, truncate, wrap, type Color, type Ink, type MapPictureOptions } from "./svg.js";

export const M = 12; // page margin
export const PAD = 8; // inside a lane
export const CARD_PAD = 10;
export const TRACK = 13; // between arcs that run side by side, when there is room
export const TRACK_MIN = 6.5; // and when there is not: a map with one hub has a track per handoff
export const CARD_LEAST = 120; // the width a card never goes below, however many tracks there are
export const SLOT = 13; // between two arc ends on one card
const ROLE_LINES = 12; // a role is meant to be one line; twelve wrapped lines is where a card stops growing for it

/** How each carrier kind is drawn: the color and dash of its arc and of its line in the list. */
export const CARRIER_STYLE: Record<CarrierKind | "none", { color: Color; dash?: string; width: number }> = {
  branch: { color: "accent", width: 1.6 },
  "pull-request": { color: "check", width: 1.6 },
  "session-message": { color: "ink-2", dash: "5 3", width: 1.4 },
  "scheduled-message": { color: "merge", dash: "1.5 3", width: 1.8 },
  "review-page": { color: "loop-3", dash: "7 3 1.5 3", width: 1.4 },
  person: { color: "gate", width: 2.4 },
  // Round dots: nobody carries it, it just arrives.
  notification: { color: "loop-1", dash: "0.1 4.5", width: 2.6 },
  other: { color: "ink-3", dash: "3 3", width: 1.4 },
  none: { color: "error", dash: "2 2", width: 1.4 },
};

export const styleOf = (h: Handoff) => CARRIER_STYLE[h.carrier?.kind ?? "none"];

/** The stroke of a handoff's line, as the attributes of a `<path>`. */
export const stroke = (style: { dash?: string; width: number }, color: string): string =>
  `fill="none" stroke-width="${fmt(style.width)}" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} style="stroke:${color}"`;

const HARNESS_LABEL: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex" };
const LIFETIME_LABEL: Record<string, string> = { "long-lived": "long-lived", "per-task": "per task", scheduled: "scheduled" };

/**
 * What a view draws of a map: the sessions whose lane is known, the people, and the handoffs whose two ends are.
 * The rest is left out: the validator names it. A handoff's number is its place in the document, drawn or not.
 */
export function drawn(map: OperationMap) {
  const laneIds = new Set(map.lanes.map((l) => l.id));
  const sessions = map.sessions.filter((s) => laneIds.has(s.lane));
  const people = map.people ?? [];
  const ends = new Set<Id>([...people, ...sessions].map((e) => e.id));
  return { sessions, people, handoffs: map.handoffs.filter((h) => ends.has(h.from) && ends.has(h.to)), numberOf: new Map<Id, number>(map.handoffs.map((h, i) => [h.id, i + 1])) };
}

/** The title and the caption under it; returns where the next thing starts. */
export function heading(map: OperationMap, W: number, options: MapPictureOptions, ink: Ink, body: string[]): number {
  let y = M + 6;
  for (const line of wrap(map.name || map.id, W - 2 * M, 17, 2, "bold")) {
    y += 17;
    body.push(text(M, y, line, { size: 17, fill: ink("ink"), weight: "bold" }));
    y += 4;
  }
  const liveAt = options.live && options.at ? `live at ${options.at.slice(0, 16).replace("T", " ")} UTC` : undefined;
  const caption = [liveAt ?? (map.asOf ? `as of ${map.asOf}` : undefined), mapShapeLine(mapShape(map))].filter(Boolean).join(" · ");
  for (const line of wrap(caption, W - 2 * M, 11, 2)) {
    y += 13;
    body.push(text(M, y, line, { size: 11, fill: ink("ink-3") }));
  }
  return y + 12;
}

// ─── numbers ──────────────────────────────────────────────────────────────

export const BADGE_R = 7.2;
const NUMBER_GAP = 6; // between the rings of two numbers whose tracks are close enough to touch
/**
 * Half the width of a handoff's number badge: a circle for one digit, a pill for more, so the digits never touch the
 * ring. The pill is as narrow as that allows: on a crowded map the tracks are closer together than a pill is wide,
 * and the less of a neighbor's track it covers the better.
 */
export const badgeHalf = (n: string): number => (n.length > 1 ? (textWidth(n, 8.5, "bold") + 4.5) / 2 : BADGE_R);

/** The ring a handoff's number sits in, centered on (x, y), filled with the page's ground. */
export function numberRing(x: number, y: number, n: string, color: string, ink: Ink): string {
  const half = badgeHalf(n);
  return n.length > 1
    ? rect(x - half, y - BADGE_R, half * 2, BADGE_R * 2, { fill: ink("bg"), stroke: color, rx: BADGE_R, width: 1.3 })
    : `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${BADGE_R}" stroke-width="1.3" style="fill:${ink("bg")};stroke:${color}"/>`;
}

/** The number itself. */
export const numberText = (x: number, y: number, n: string, ink: Ink): string => text(x, y + 3.3, n, { size: n.length > 1 ? 8.5 : 9.5, fill: ink("ink"), weight: "bold", anchor: "middle" });

/** A handoff's number in its ring, where no line has to pass behind it. */
export const numberBadge = (x: number, y: number, n: string, color: string, ink: Ink): string => numberRing(x, y, n, color, ink) + numberText(x, y, n, ink);

/** A level run of an arc: at `y`, from `from` to `to`, belonging to arc `of`. */
export type Level = { y: number; from: number; to: number; of: number };
export type Placed = { x: number; y: number; half: number };

/**
 * Where a handoff's number sits on its arc's upright at `x`, between `y1` and `y2`. Two things it must not sit on:
 * another arc's number, and the level run of another arc where it crosses this upright on its way to a card (a number
 * there reads as that arc's, at its arrowhead). The nearest clear point to the middle is taken; when there is no clear
 * one, the point with the most room. The place is added to `placed`.
 */
export function placeNumber(x: number, y1: number, y2: number, half: number, of: number, placed: Placed[], levels: Level[]): number {
  const lo = Math.min(y1, y2) + 9;
  const hi = Math.max(y1, y2) - 9;
  const room = (at: number): number => {
    let least = Infinity;
    // Two numbers on neighboring tracks keep a clear gap between their rings, so they do not read as one cluster.
    for (const b of placed) if (Math.abs(b.x - x) <= b.half + half + 1) least = Math.min(least, Math.abs(b.y - at) - (2 * BADGE_R + NUMBER_GAP));
    for (const l of levels) if (l.of !== of && l.to >= x - half - 1 && l.from <= x + half + 1) least = Math.min(least, Math.abs(l.y - at) - (BADGE_R + 2.5));
    return least;
  };
  const mid = (y1 + y2) / 2;
  let at = mid;
  if (room(mid) < 0 && hi > lo) {
    let best = { at: mid, room: room(mid) };
    for (let step = 1; step * 4 <= hi - lo; step++) {
      for (const here of [mid + step * 4, mid - step * 4]) {
        if (here < lo || here > hi) continue;
        const clear = room(here);
        if (clear >= 0 && best.room < 0) best = { at: here, room: clear };
        else if (best.room < 0 && clear > best.room) best = { at: here, room: clear };
      }
      if (best.room >= 0) break;
    }
    at = best.at;
  }
  placed.push({ x, y: at, half });
  return at;
}

// ─── cards ────────────────────────────────────────────────────────────────

/** A card measured before it is placed: its height, and its markup once it has a place. */
export type Measured = { height: number; family: boolean; draw: (x: number, y: number, height?: number) => string };

/** The height a card needs so that `ends` arc ends fit down one of its edges. */
const forSlots = (ends: number): number => (ends + 1) * SLOT + 4;

/**
 * A person's card, `width` wide, with room for `ends` arc ends on an edge. It grows with what it has to say, as a
 * session's does. `more` is how many lines a name may take beyond the phone's picture's two: a view whose cards
 * are narrower gives its words more lines rather than cut them short.
 */
export function personCard(person: Person, width: number, ends: number, ink: Ink, more = 0): Measured {
  const textW = width - 2 * CARD_PAD;
  const name = wrap(person.name || person.id, textW, 13.5, 2 + more, "bold");
  const fixed = CARD_PAD + name.length * 16 + CARD_PAD - 3;
  const role = person.role ? wrap(person.role, textW, 11, Math.max(ROLE_LINES, Math.floor((forSlots(ends) - fixed - 2) / 13.5))) : [];
  const own = Math.max(fixed + (role.length ? 2 + role.length * 13.5 : 0), forSlots(ends));
  return {
    height: own,
    family: false,
    draw(x, y, height = own) {
      const g: string[] = [rect(x, y, width, height, { fill: ink("gate-soft"), stroke: ink("gate"), rx: 14, width: 1.4, mark: "card" })];
      let ty = y + CARD_PAD - 5;
      for (const line of name) {
        ty += 16;
        g.push(text(x + CARD_PAD, ty, line, { size: 13.5, fill: ink("ink"), weight: "bold" }));
      }
      ty += 2;
      for (const line of role) {
        ty += 13.5;
        g.push(text(x + CARD_PAD, ty, line, { size: 11, fill: ink("ink-2") }));
      }
      return `<g data-person="${person.id}">${g.join("")}</g>`;
    },
  };
}

/**
 * A session's card, `width` wide, with room for `ends` arc ends on an edge; marked with what the hooks saw of it,
 * when given. `more` is how many lines its name, its model and its last line may each take beyond the phone's.
 */
export function sessionCard(map: OperationMap, session: Session, width: number, ends: number, ink: Ink, options: MapPictureOptions, more = 0): Measured {
  const textW = width - 2 * CARD_PAD;
  const family = (session.count ?? 1) > 1;
  const countLabel = family ? `×${session.count}` : "";
  const countW = family ? textWidth(countLabel, 10.5, "bold") + 12 : 0;
  const harness = HARNESS_LABEL[session.harness] ?? session.harness;
  const now = options.live?.[session.id];
  // Every line of words is wrapped before the card is sized. The name's first line shares its row with the count.
  const name = wrap(session.name || session.id, (line) => textW - (family && line === 0 ? countW + 6 : 0), 13.5, 2 + more, "bold");
  // The harness and the model share a line when they fit; otherwise each has its own.
  const together = session.model ? `${harness} · ${session.model}` : harness;
  const runsOn = !session.model || textWidth(together, 10.5, "bold") <= textW ? [truncate(together, textW, 10.5, "bold")] : [truncate(harness, textW, 10.5, "bold"), ...wrap(session.model, textW, 10.5, 2 + more, "bold")];
  const meta = [session.lifetime ? LIFETIME_LABEL[session.lifetime] : undefined, session.repo].filter(Boolean).join(" · ");
  const metaLines = meta ? wrap(meta, textW, 10, 3 + more) : [];
  // A session that sends itself a scheduled message wakes itself: said on its card, with the schedule when the handoff names one.
  const wakes = wakesItself(map, session.id);
  const wakesLines = wakes === undefined ? [] : wrap(wakes === "" ? "wakes itself" : `wakes itself · ${wakes}`, textW - 13, 10, 2, "bold");
  const fixed =
    CARD_PAD + name.length * 16 + 1 + runsOn.length * 13 + 2 + metaLines.length * 13 + (metaLines.length ? 1 : 0) + (wakesLines.length ? 2 + wakesLines.length * 13 : 0) + (session.graph ? 15 : 0) + (now ? 19 : 0) + CARD_PAD - 3;
  // The card grows with its role, and the role has more room still when the card is tall anyway because many arcs end on it.
  const role = wrap(session.role, textW, 11, Math.max(ROLE_LINES, Math.floor((forSlots(ends) - fixed) / 13.5)));
  const own = Math.max(fixed + role.length * 13.5, forSlots(ends));
  return {
    height: own,
    family,
    draw(x, y, height = own) {
      const g: string[] = [];
      if (family) {
        // A family is a stack: two more card edges behind the first.
        g.push(rect(x + 6, y + 6, width - 6, height - 2, { fill: ink("surface"), stroke: ink("line"), rx: 9 }));
        g.push(rect(x + 3, y + 3, width - 3, height - 1, { fill: ink("surface"), stroke: ink("line"), rx: 9 }));
      }
      g.push(rect(x, y, width, height, { fill: ink("surface"), stroke: ink("line-strong"), rx: 9, mark: "card" }));
      let ty = y + CARD_PAD - 5;
      name.forEach((line, k) => {
        ty += 16;
        g.push(text(x + CARD_PAD, ty, line, { size: 13.5, fill: ink("ink"), weight: "bold" }));
        if (k === 0 && family) g.push(pill(x + width - CARD_PAD - countW, ty - 0.5, countLabel, { size: 10.5, fill: ink("accent-soft"), ink: ink("accent") }).svg);
      });
      ty += 1;
      for (const line of runsOn) {
        ty += 13;
        g.push(text(x + CARD_PAD, ty, line, { size: 10.5, fill: ink(session.harness === "codex" ? "check" : "accent"), weight: "bold" }));
      }
      ty += 2;
      for (const line of role) {
        ty += 13.5;
        g.push(text(x + CARD_PAD, ty, line, { size: 11, fill: ink("ink-2") }));
      }
      if (metaLines.length) ty += 1;
      for (const line of metaLines) {
        ty += 13;
        g.push(text(x + CARD_PAD, ty, line, { size: 10, fill: ink("ink-3") }));
      }
      wakesLines.forEach((line, k) => {
        // A dotted ring, as a scheduled message's line is dotted.
        ty += k === 0 ? 15 : 13;
        if (k === 0) g.push(`<circle data-wakes="" cx="${fmt(x + CARD_PAD + 4.2)}" cy="${fmt(ty - 3.4)}" r="3.6" fill="none" stroke-width="1.8" stroke-dasharray="1.5 2.2" style="stroke:${ink("merge")}"/>`);
        g.push(text(x + CARD_PAD + 13, ty, line, { size: 10, fill: ink("merge"), weight: "bold" }));
      });
      if (session.graph) {
        ty += 15;
        g.push(text(x + CARD_PAD, ty, truncate(`graph: ${session.graph}`, textW, 10, "mono"), { size: 10, fill: ink("loop-0"), weight: "mono" }));
      }
      if (now) {
        // What the hooks saw: a filled dot while anything is working, a ring while it waits, a gray ring when it has gone
        // quiet (not ended, and not heard from for half an hour), a gray dot when it has ended.
        ty += 19;
        const quietOnly = now.working === 0 && now.waiting === 0 && (now.quiet ?? 0) > 0;
        const tone: Color = now.working > 0 ? "accent" : now.waiting > 0 ? "warning" : "ink-3";
        const dotX = x + CARD_PAD + 4.5;
        g.push(
          now.working > 0
            ? `<circle cx="${fmt(dotX)}" cy="${fmt(ty - 3.6)}" r="4.5" style="fill:${ink(tone)}"/>`
            : `<circle cx="${fmt(dotX)}" cy="${fmt(ty - 3.6)}" r="3.6" stroke-width="1.8" style="fill:${now.waiting > 0 || quietOnly ? "none" : ink(tone)};stroke:${ink(tone)}"/>`,
        );
        g.push(text(x + CARD_PAD + 14, ty, truncate(mapLiveLine(now, options.at), textW - 14, 10.5, "bold"), { size: 10.5, fill: ink(tone), weight: "bold" }));
      }
      return `<g data-session="${session.id}"${now ? ` data-live="${now.working > 0 ? "working" : now.waiting > 0 ? "waiting" : (now.quiet ?? 0) > 0 ? "quiet" : "ended"}"` : ""}>${g.join("")}</g>`;
    },
  };
}

/**
 * A lane's heading over its cards' column, which starts at `x` and is `width` wide: its name with its place at the
 * column's right edge, then its machine and account. `y` is the baseline of the name's first line. Returns the
 * markup and the top of the first card. `more` is how many lines each may take beyond the phone's two and three.
 */
export function laneHead(lane: Lane, x: number, width: number, y: number, ink: Ink, more = 0): { svg: string[]; cardsTop: number } {
  const svg: string[] = [];
  const headW = width - 2;
  const placeLabel = lane.place ?? "";
  const place = placeLabel ? pill(0, 0, placeLabel, { size: 9.5, fill: ink("surface"), ink: ink("ink-2"), stroke: ink("line-strong") }) : undefined;
  // On the phone's picture every line of the name stops short of the place; given more lines, only the first does.
  wrap(lane.name || lane.id, (line) => headW - (place && (line === 0 || !more) ? place.width + 8 : 0), 12.5, 2 + more, "bold").forEach((line, k) => {
    if (k > 0) y += 15;
    svg.push(text(x + 2, y, line, { size: 12.5, fill: ink("ink"), weight: "bold" }));
    // The place sits at the column's right edge, on the name's first line, wherever the name ends.
    if (k === 0 && place) svg.push(pill(x + width - place.width, y - 0.5, placeLabel, { size: 9.5, fill: ink("surface"), ink: ink("ink-2"), stroke: ink("line-strong") }).svg);
  });
  for (const line of wrap(`${lane.machine} · ${lane.account}`, headW, 10.5, 3 + more)) {
    y += 13.5;
    svg.push(text(x + 2, y, line, { size: 10.5, fill: ink("ink-3") }));
  }
  return { svg, cardsTop: y + 9.5 };
}

// ─── the list ─────────────────────────────────────────────────────────────

/** What carries a handoff, in words. */
export const carriedBy = (map: OperationMap, h: Handoff): string => (h.carrier ? handoffCarrierText(map, h) || `${CARRIER_LABEL[h.carrier.kind]} (not named)` : "no carrier named");

/**
 * One handoff as a line of the list, numbered as its arc is: who to whom, what carries it, what is handed.
 * The line starts at (`x`, `top`) and is `width` wide; returns the markup and where the next line starts. `more` is
 * how many lines each of the three may take beyond the phone's picture's, where the list is in narrower columns.
 */
export function handoffRow(map: OperationMap, h: Handoff, n: number, x: number, top: number, width: number, ink: Ink, more = 0): { svg: string; bottom: number } {
  const style = styleOf(h);
  const color = ink(style.color);
  const listX = x + 24;
  const listW = width - 24;
  const row: string[] = [];
  let y = top + 12;
  row.push(numberBadge(x + 8, y - 4, String(n), color, ink));
  const who = h.from === h.to ? `${endName(map, h.from)} → itself` : `${endName(map, h.from)} → ${endName(map, h.to)}`;
  wrap(who, listW, 12, 2 + more, "bold").forEach((line, k) => {
    if (k > 0) y += 14;
    row.push(text(listX, y, line, { size: 12, fill: ink("ink"), weight: "bold" }));
  });
  y += 14;
  row.push(`<path d="M${fmt(listX)},${fmt(y - 3.5)} h18" ${stroke(style, color)}/>`);
  wrap(carriedBy(map, h), listW - 24, 11, 2 + more, "bold").forEach((line, k) => {
    if (k > 0) y += 13.5;
    row.push(text(listX + 24, y, line, { size: 11, fill: color, weight: "bold" }));
  });
  if (h.what) {
    for (const line of wrap(h.what, listW, 11, 4 + more)) {
      y += 13.5;
      row.push(text(listX, y, line, { size: 11, fill: ink("ink-2") }));
    }
  }
  y += 11;
  return { svg: `<g data-handoff-row="${h.id}">${rect(x - 4, top - 2, width + 8, y - top - 3, { fill: "transparent", rx: 8, mark: "row" })}${row.join("")}</g>`, bottom: y };
}
