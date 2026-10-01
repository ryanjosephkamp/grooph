/**
 * The picture of an operation map (docs/operation-map.md §4): lanes stacked
 * top to bottom, each session a card in its lane, each handoff a numbered arc
 * in the right-hand margin, and the handoffs listed below with their carriers.
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

import { mapLiveLine } from "../events.js";
import { CARRIER_LABEL, carrierText, mapShape, mapShapeLine } from "../map.js";
import type { CarrierKind, Handoff, Id, OperationMap, Session } from "../types.js";
import { PICTURE_WIDTH, assignTracks, fmt, frame, inkFor, pill, rect, text, textWidth, truncate, wrap, type Colour, type Ink, type MapPictureOptions } from "./svg.js";

const M = 12; // page margin
const PAD = 8; // inside a lane
const CARD_PAD = 10;
const TRACK = 13; // between arcs in the margin, when there is room
const TRACK_MIN = 6.5; // and when there is not: a map with one hub has a track per handoff
const TRACK_LEAD = 16; // from a card's edge to the first track
const TRACK_TAIL = 14; // from the last track to the lane's edge
const CARD_SHARE = 0.56; // the least of a lane's inner width its cards keep
const SLOT = 13; // between two arc ends on one card

/** How each carrier kind is drawn: the colour and dash of its arc and of its line in the list. */
export const CARRIER_STYLE: Record<CarrierKind | "none", { colour: Colour; dash?: string; width: number }> = {
  branch: { colour: "accent", width: 1.6 },
  "pull-request": { colour: "check", width: 1.6 },
  "session-message": { colour: "ink-2", dash: "5 3", width: 1.4 },
  "scheduled-message": { colour: "merge", dash: "1.5 3", width: 1.8 },
  "review-page": { colour: "loop-3", dash: "7 3 1.5 3", width: 1.4 },
  person: { colour: "gate", width: 2.4 },
  other: { colour: "ink-3", dash: "3 3", width: 1.4 },
  none: { colour: "error", dash: "2 2", width: 1.4 },
};

const HARNESS_LABEL: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex" };
const LIFETIME_LABEL: Record<string, string> = { "long-lived": "long-lived", "per-task": "per task", scheduled: "scheduled" };

type Card = { session: Session; height: number; y: number; slots: { handoff: Id; end: "from" | "to" }[] };

/**
 * An operation map as one SVG with its words on it, laid out for a phone.
 * Sessions and handoffs carry `data-session` and `data-handoff`, so a page
 * that holds the picture inline can make them tappable. A session whose lane
 * is unknown, and a handoff whose end is, are left out: the validator names them.
 */
export function mapPicture(map: OperationMap, options: MapPictureOptions = {}): string {
  const live = options.live ?? {};
  const theme = options.theme ?? "auto";
  const W = options.width ?? PICTURE_WIDTH;
  const ink = inkFor(theme);
  const lanes = map.lanes;
  const laneIds = new Set(lanes.map((l) => l.id));
  const sessions = map.sessions.filter((s) => laneIds.has(s.lane));
  const order = new Map<Id, number>(); // the order the cards are drawn in
  for (const lane of lanes) for (const s of sessions) if (s.lane === lane.id) order.set(s.id, order.size);
  const handoffs = map.handoffs.filter((h) => order.has(h.from) && order.has(h.to));
  const numberOf = new Map<Id, number>(map.handoffs.map((h, i) => [h.id, i + 1]));

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
  // The margin grows with the tracks until the cards would lose their share; then the tracks close up.
  const widest = (laneW - 2 * PAD) * (1 - CARD_SHARE);
  const track = count <= 1 ? TRACK : Math.max(TRACK_MIN, Math.min(TRACK, (widest - TRACK_LEAD - TRACK_TAIL) / (count - 1)));
  const margin = handoffs.length === 0 ? 0 : TRACK_LEAD + (count - 1) * track + TRACK_TAIL;
  const cardX = laneX + PAD;
  const cardW = laneW - 2 * PAD - margin;
  const textW = cardW - 2 * CARD_PAD;

  const body: string[] = [];
  let y = M + 6;

  // Title.
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
  y += 12;

  // Lanes and their cards.
  const cards = new Map<Id, Card>();
  const cardSvg: string[] = [];
  for (const lane of lanes) {
    const top = y;
    const inner: string[] = [];
    let cy = top + PAD + 12;
    // The lane's words keep to the cards' column: the margin beside them belongs to the arcs.
    const headW = cardW - 2;
    const placeLabel = lane.place ?? "";
    const place = placeLabel ? pill(0, 0, placeLabel, { size: 9.5, fill: ink("surface"), ink: ink("ink-2"), stroke: ink("line-strong") }) : undefined;
    const nameLines = wrap(lane.name || lane.id, headW - (place ? place.width + 8 : 0), 12.5, 2, "bold");
    nameLines.forEach((line, k) => {
      if (k > 0) cy += 15;
      inner.push(text(laneX + PAD + 2, cy, line, { size: 12.5, fill: ink("ink"), weight: "bold" }));
      // The place sits at the column's right edge, on the name's first line, wherever the name ends.
      if (k === 0 && place) inner.push(pill(cardX + cardW - place.width, cy - 0.5, placeLabel, { size: 9.5, fill: ink("surface"), ink: ink("ink-2"), stroke: ink("line-strong") }).svg);
    });
    for (const line of wrap(`${lane.machine} · ${lane.account}`, headW, 10.5, 3)) {
      cy += 13.5;
      inner.push(text(laneX + PAD + 2, cy, line, { size: 10.5, fill: ink("ink-3") }));
    }
    cy += 9.5;

    const members = sessions.filter((s) => s.lane === lane.id);
    for (const session of members) {
      const ends = slots.get(session.id) ?? [];
      const family = (session.count ?? 1) > 1;
      const countLabel = family ? `×${session.count}` : "";
      const countW = family ? textWidth(countLabel, 10.5, "bold") + 12 : 0;
      const harness = HARNESS_LABEL[session.harness] ?? session.harness;
      const now = live[session.id];
      // Every line of words is wrapped before the card is sized. The name's first line shares its row with the count.
      const name = wrap(session.name || session.id, textW - (family ? countW + 6 : 0), 13.5, 2, "bold");
      // The harness and the model share a line when they fit; otherwise each has its own.
      const together = session.model ? `${harness} · ${session.model}` : harness;
      const runsOn = !session.model || textWidth(together, 10.5, "bold") <= textW ? [truncate(together, textW, 10.5, "bold")] : [truncate(harness, textW, 10.5, "bold"), ...wrap(session.model, textW, 10.5, 2, "bold")];
      const meta = [session.lifetime ? LIFETIME_LABEL[session.lifetime] : undefined, session.repo].filter(Boolean).join(" · ");
      const metaLines = meta ? wrap(meta, textW, 10, 3) : [];
      const fixed = CARD_PAD + name.length * 16 + 1 + runsOn.length * 13 + 2 + metaLines.length * 13 + (metaLines.length ? 1 : 0) + (session.graph ? 15 : 0) + (now ? 19 : 0) + CARD_PAD - 3;
      const forSlots = (ends.length + 1) * SLOT + 4;
      // The role has five lines, and more when the card is tall anyway because many arcs end on it.
      const role = wrap(session.role, textW, 11, Math.max(5, Math.floor((forSlots - fixed) / 13.5)));
      const height = Math.max(fixed + role.length * 13.5, forSlots);
      cards.set(session.id, { session, height, y: cy, slots: ends });

      const g: string[] = [];
      if (family) {
        // A family is a stack: two more card edges behind the first.
        g.push(rect(cardX + 6, cy + 6, cardW - 6, height - 2, { fill: ink("surface"), stroke: ink("line"), rx: 9 }));
        g.push(rect(cardX + 3, cy + 3, cardW - 3, height - 1, { fill: ink("surface"), stroke: ink("line"), rx: 9 }));
      }
      g.push(rect(cardX, cy, cardW, height, { fill: ink("surface"), stroke: ink("line-strong"), rx: 9, mark: "card" }));
      let ty = cy + CARD_PAD - 5;
      name.forEach((line, k) => {
        ty += 16;
        g.push(text(cardX + CARD_PAD, ty, line, { size: 13.5, fill: ink("ink"), weight: "bold" }));
        if (k === 0 && family) g.push(pill(cardX + cardW - CARD_PAD - countW, ty - 0.5, countLabel, { size: 10.5, fill: ink("accent-soft"), ink: ink("accent") }).svg);
      });
      ty += 1;
      for (const line of runsOn) {
        ty += 13;
        g.push(text(cardX + CARD_PAD, ty, line, { size: 10.5, fill: ink(session.harness === "codex" ? "check" : "accent"), weight: "bold" }));
      }
      ty += 2;
      for (const line of role) {
        ty += 13.5;
        g.push(text(cardX + CARD_PAD, ty, line, { size: 11, fill: ink("ink-2") }));
      }
      if (metaLines.length) ty += 1;
      for (const line of metaLines) {
        ty += 13;
        g.push(text(cardX + CARD_PAD, ty, line, { size: 10, fill: ink("ink-3") }));
      }
      if (session.graph) {
        ty += 15;
        g.push(text(cardX + CARD_PAD, ty, truncate(`graph: ${session.graph}`, textW, 10, "mono"), { size: 10, fill: ink("loop-0"), weight: "mono" }));
      }
      if (now) {
        // What the hooks saw: a filled dot while anything is working, a ring while it waits, a grey dot when it has ended.
        ty += 19;
        const tone: Colour = now.working > 0 ? "accent" : now.waiting > 0 ? "warning" : "ink-3";
        const dotX = cardX + CARD_PAD + 4.5;
        g.push(
          now.working > 0
            ? `<circle cx="${fmt(dotX)}" cy="${fmt(ty - 3.6)}" r="4.5" style="fill:${ink(tone)}"/>`
            : `<circle cx="${fmt(dotX)}" cy="${fmt(ty - 3.6)}" r="3.6" stroke-width="1.8" style="fill:${now.waiting > 0 ? "none" : ink(tone)};stroke:${ink(tone)}"/>`,
        );
        g.push(text(cardX + CARD_PAD + 14, ty, truncate(mapLiveLine(now), textW - 14, 10.5, "bold"), { size: 10.5, fill: ink(tone), weight: "bold" }));
      }
      cardSvg.push(`<g data-session="${session.id}"${now ? ` data-live="${now.working > 0 ? "working" : now.waiting > 0 ? "waiting" : "ended"}"` : ""}>${g.join("")}</g>`);
      cy += height + (family ? 14 : 8);
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
  const badges: { x: number; y: number }[] = [];
  handoffs.forEach((h, i) => {
    const style = CARRIER_STYLE[h.carrier?.kind ?? "none"];
    const colour = ink(style.colour);
    const y1 = slotY(h.from, h.id, "from");
    const y2 = slotY(h.to, h.id, "to");
    const x = edgeX + TRACK_LEAD + tracks[i]! * track;
    const r = Math.min(6, Math.abs(y2 - y1) / 2);
    const dir = y2 >= y1 ? 1 : -1;
    const d = `M${fmt(edgeX)},${fmt(y1)} H${fmt(x - r)} Q${fmt(x)},${fmt(y1)} ${fmt(x)},${fmt(y1 + dir * r)} V${fmt(y2 - dir * r)} Q${fmt(x)},${fmt(y2)} ${fmt(x - r)},${fmt(y2)} H${fmt(edgeX + 5.5)}`;
    const head = `<path d="M${fmt(edgeX + 0.5)},${fmt(y2)} l6.5,-3.6 v7.2 z" style="fill:${colour}"/>`;
    const tail = `<circle cx="${fmt(edgeX)}" cy="${fmt(y1)}" r="2.2" style="fill:${colour}"/>`;
    // The number sits on the arc's upright, at its middle unless a neighbour's number is there: then further along.
    const lo = Math.min(y1, y2) + 9;
    const hi = Math.max(y1, y2) - 9;
    const clear = (at: number): boolean => badges.every((b) => Math.abs(b.x - x) > 15.5 || Math.abs(b.y - at) > 15.5);
    let badgeY = (y1 + y2) / 2;
    for (let step = 1; !clear(badgeY) && step < 160; step++) {
      const at = (y1 + y2) / 2 + (step % 2 === 1 ? 1 : -1) * Math.ceil(step / 2) * 8;
      if (at >= lo && at <= hi && clear(at)) badgeY = at;
    }
    badges.push({ x, y: badgeY });
    const n = String(numberOf.get(h.id)!);
    const badge =
      `<circle cx="${fmt(x)}" cy="${fmt(badgeY)}" r="7.2" stroke-width="1.3" style="fill:${ink("bg")};stroke:${colour}"/>` +
      text(x, badgeY + 3.3, n, { size: n.length > 1 ? 8.5 : 9.5, fill: ink("ink"), weight: "bold", anchor: "middle" });
    body.push(
      `<g data-handoff="${h.id}"><path d="${d}" fill="none" stroke-width="${fmt(style.width)}" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} style="stroke:${colour}"/>${tail}${head}${badge}</g>`,
    );
  });

  // The list: every handoff, numbered as its arc is.
  if (map.handoffs.length > 0) {
    y += 6;
    body.push(text(M, y + 11, "Handoffs", { size: 12.5, fill: ink("ink"), weight: "bold" }));
    y += 20;
    const nameOf = (id: Id): string => map.sessions.find((s) => s.id === id)?.name || id;
    const listX = M + 24;
    const listW = W - M - listX;
    for (const h of map.handoffs) {
      const style = CARRIER_STYLE[h.carrier?.kind ?? "none"];
      const colour = ink(style.colour);
      const n = String(numberOf.get(h.id)!);
      const row: string[] = [];
      const top = y;
      y += 12;
      row.push(`<circle cx="${fmt(M + 8)}" cy="${fmt(y - 4)}" r="7.2" stroke-width="1.3" style="fill:${ink("bg")};stroke:${colour}"/>`);
      row.push(text(M + 8, y - 0.7, n, { size: n.length > 1 ? 8.5 : 9.5, fill: ink("ink"), weight: "bold", anchor: "middle" }));
      const who = h.from === h.to ? `${nameOf(h.from)} → itself` : `${nameOf(h.from)} → ${nameOf(h.to)}`;
      wrap(who, listW, 12, 2, "bold").forEach((line, k) => {
        if (k > 0) y += 14;
        row.push(text(listX, y, line, { size: 12, fill: ink("ink"), weight: "bold" }));
      });
      y += 14;
      const carried = h.carrier ? carrierText(h.carrier) || `${CARRIER_LABEL[h.carrier.kind]} (not named)` : "no carrier named";
      row.push(
        `<path d="M${fmt(listX)},${fmt(y - 3.5)} h18" fill="none" stroke-width="${fmt(style.width)}" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} style="stroke:${colour}"/>`,
      );
      wrap(carried, listW - 24, 11, 2, "bold").forEach((line, k) => {
        if (k > 0) y += 13.5;
        row.push(text(listX + 24, y, line, { size: 11, fill: colour, weight: "bold" }));
      });
      if (h.what) {
        for (const line of wrap(h.what, listW, 11, 4)) {
          y += 13.5;
          row.push(text(listX, y, line, { size: 11, fill: ink("ink-2") }));
        }
      }
      y += 11;
      body.push(`<g data-handoff-row="${h.id}">${rect(M - 4, top - 2, W - 2 * M + 8, y - top - 3, { fill: "transparent", rx: 8, mark: "row" })}${row.join("")}</g>`);
    }
  }

  return frame(W, y + M - 6, map.name || map.id, theme, ink, body.join(""), "map");
}

/** The handoffs in the order their numbers are drawn, for a list beside the picture. */
export const handoffNumbers = (map: OperationMap): { handoff: Handoff; n: number }[] => map.handoffs.map((handoff, i) => ({ handoff, n: i + 1 }));

export type { Ink };
