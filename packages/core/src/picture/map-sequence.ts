/**
 * An operation map as a sequence (docs/operation-map.md §4d): a column for each person and each session, a line
 * down from each, and every handoff a numbered arrow from its sender's line to its receiver's, on a row of its
 * own, with what carries it and what is handed beside it.
 *
 * The rows are in the order the map lists its handoffs. That is an order and not a clock: a map records no times,
 * and the picture says so under its title. Columns keep the picture's grouping: the people first, then each lane's
 * sessions inside that lane's box, so an arrow that leaves a box is a handoff that leaves a lane.
 */

import type { Id, OperationMap } from "../types.js";
import { open } from "./map-kit-open.js";
import type { MapKit } from "./map-kit.js";
import type { PictureOptions } from "./svg.js";

const COLUMN = 104; // the most a column is wide, and the least
const COLUMN_LEAST = 62;
const WORDS = 270; // the words beside the arrows; given a width, they take what the columns leave, within limits
const WORDS_LEAST = 190;
const WORDS_MOST = 360;
const ROW = 30; // a row's least height
const NOTE = "Read down: the order the map lists its handoffs in. An order, not a clock: a map records no times.";

/** Like the lanes side by side, it imports nothing but types and is handed the parts it draws with (`map-kit.ts`). */
export function mapSequenceWith(kit: MapKit, map: OperationMap, options: PictureOptions = {}): string {
  const { M, PICTURE_WIDTH, carriedBy, drawn, fmt, frame, heading, inkFor, numberBadge, rect, stroke, styleOf, text, textWidth, wrap } = open(kit);
  const theme = options.theme ?? "auto";
  const ink = inkFor(theme, options.look);
  const { sessions, people, handoffs, numberOf } = drawn(map);
  // The columns, in groups: the people, then each lane that has a session.
  const groups = [
    ...(people.length ? [{ id: "", name: people.length === 1 ? "Person" : "People", person: true, of: people.map((p) => ({ id: p.id, name: p.name || p.id })) }] : []),
    ...map.lanes.map((lane) => ({ id: lane.id, name: lane.name || lane.id, person: false, of: sessions.filter((s) => s.lane === lane.id).map((s) => ({ id: s.id, name: `${s.name || s.id}${(s.count ?? 1) > 1 ? ` ×${s.count}` : ""}` })) })),
  ].filter((g) => g.of.length > 0);
  const columns = groups.flatMap((g) => g.of);
  const n = Math.max(1, columns.length);

  // A column is as wide as the longest word of any name needs, so no name is cut short. The picture is as wide as
  // its columns make it: a width that is given changes only how much room the words have.
  const longest = Math.max(0, ...columns.flatMap((c) => c.name.split(/\s+/).map((word) => textWidth(word, 10, "bold"))));
  const column = Math.min(COLUMN, Math.max(COLUMN_LEAST, longest + 14));
  const wordsX = M + n * column + 14;
  const wordsW = Number.isFinite(options.width) ? Math.min(WORDS_MOST, Math.max(WORDS_LEAST, options.width! - M - wordsX)) : WORDS;
  const W = wordsX + wordsW + M;
  const center = new Map<Id, number>(columns.map((c, k) => [c.id, M + (k + 0.5) * column]));

  // The title and what is under it keep to a phone's width, so they are read without scrolling sideways.
  const body: string[] = [];
  const headingW = Math.min(W, PICTURE_WIDTH);
  let y = heading(map, headingW, options, ink, body) - 12;
  for (const line of wrap(NOTE, headingW - 2 * M, 11, 3)) {
    y += 14;
    body.push(text(M, y, line, { size: 11, fill: ink("ink-2") }));
  }
  y += 12;

  // Each group's name over its columns, then each column's head.
  const top = y;
  const names = groups.map((g) => wrap(g.name, g.of.length * column - 14, 9.5, 3, "bold"));
  const heads = columns.map((c) => wrap(c.name, column - 12, 10, 6, "bold"));
  const headTop = top + 8 + Math.max(0, ...names.map((l) => l.length)) * 12 + 3;
  const headH = 9 + Math.max(1, ...heads.map((l) => l.length)) * 12.5;
  const boxes: ((bottom: number) => string)[] = []; // closed below once the rows are measured
  const headSvg: string[] = [];
  let k = 0;
  groups.forEach((g, i) => {
    const left = M + k * column;
    const width = g.of.length * column;
    const name = names[i]!.map((line, j) => text(left + width / 2, top + 16 + j * 12, line, { size: 9.5, fill: ink("ink-2"), weight: "bold", anchor: "middle" })).join("");
    // The people's box is dashed, as in the picture.
    boxes.push((bottom) => `<g data-${g.person ? 'people=""' : `lane="${g.id}"`}>${rect(left + 1.5, top, width - 3, bottom - top, { fill: ink("surface-2"), stroke: ink("line"), rx: 12, ...(g.person ? { dash: "5 4" } : {}) })}${name}</g>`);
    for (const c of g.of) {
      const cx = center.get(c.id)!;
      const lines = heads[k++]!;
      headSvg.push(
        `<g data-${g.person ? "person" : "session"}="${c.id}">${rect(cx - column / 2 + 4, headTop, column - 8, headH, g.person ? { fill: ink("gate-soft"), stroke: ink("gate"), rx: 12, width: 1.4, mark: "card" } : { fill: ink("surface"), stroke: ink("line-strong"), rx: 8, mark: "card" })}${lines
          .map((line, j) => text(cx, headTop + (headH - lines.length * 12.5) / 2 + 9.5 + j * 12.5, line, { size: 10, fill: ink("ink"), weight: "bold", anchor: "middle" }))
          .join("")}</g>`,
      );
    }
  });
  body.push(text(wordsX, headTop + headH / 2 + 3.5, "Carried by, and what is handed", { size: 10, fill: ink("ink-3") }));

  // The rows.
  y = headTop + headH + 8;
  const rows: string[] = [];
  const rules: string[] = [];
  handoffs.forEach((h, i) => {
    const style = styleOf(h);
    const color = ink(style.color);
    const carried = wrap(carriedBy(map, h), wordsW, 10.5, 3, "bold");
    const what = h.what ? wrap(h.what, wordsW, 10.5, 8) : [];
    const height = Math.max(ROW, (carried.length + what.length) * 13 + 12);
    const cy = y + height / 2;
    if (i > 0) rules.push(`<path d="M${fmt(M)},${fmt(y)} H${fmt(W - M)}" stroke-width="1" style="stroke:${ink("line")}"/>`);
    const x1 = center.get(h.from)!;
    const x2 = center.get(h.to)!;
    const dir = Math.sign(x2 - x1);
    // A session's handoff to itself leaves its line and comes back to it.
    const d = dir === 0 ? `M${fmt(x1)},${fmt(cy - 6)} h20 v12 H${fmt(x1 + 5.5)}` : `M${fmt(x1)},${fmt(cy)} H${fmt(x2 - dir * 5.5)}`;
    const [hx, hy, point] = dir === 0 ? [x1 + 0.5, cy + 6, -1] : [x2 - dir * 0.5, cy, dir];
    let ty = cy - ((carried.length + what.length) * 13) / 2 - 3;
    rows.push(
      `<g data-handoff="${h.id}">${rect(M - 4, y + 1.5, W - 2 * M + 8, height - 3, { fill: "transparent", rx: 8, mark: "row" })}<path d="${d}" ${stroke(style, color)}/>` +
        `<circle cx="${fmt(x1)}" cy="${fmt(dir === 0 ? cy - 6 : cy)}" r="2.2" style="fill:${color}"/><path d="M${fmt(hx)},${fmt(hy)} l${fmt(-6.5 * point)},-3.6 v7.2 z" style="fill:${color}"/>` +
        numberBadge(dir === 0 ? x1 + 20 : x1 + dir * Math.min(19, Math.abs(x2 - x1) * 0.42), cy, String(numberOf.get(h.id)!), color, ink) +
        carried.map((line) => text(wordsX, (ty += 13), line, { size: 10.5, fill: color, weight: "bold" })).join("") +
        what.map((line) => text(wordsX, (ty += 13), line, { size: 10.5, fill: ink("ink-2") })).join("") +
        `</g>`,
    );
    y += height;
  });
  if (handoffs.length === 0) y += ROW;
  const bottom = y + 6;

  // Behind everything: each group's box; then the rules, then the lines down.
  const lifelines = columns.map((c) => `<path d="M${fmt(center.get(c.id)!)},${fmt(headTop + headH)} V${fmt(bottom - 6)}" stroke-width="1" style="stroke:${ink("line-strong")}"/>`);
  body.push(...boxes.map((box) => box(bottom)), ...rules, ...lifelines, ...headSvg, ...rows);

  return frame(W, bottom + M, map.name || map.id, theme, ink, body.join(""), "sequence");
}
