/**
 * Other views of an operation map (handoff 0080; docs/operation-map.md §4c and
 * §4d): its lanes side by side, and a sequence. Both are drawn by core from the
 * same document as the phone's picture, the same way twice, and neither is the
 * phone's picture, which is as it was.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { parseMapText } from "../src/map.js";
import { CARRIER_STYLE, mapPicture } from "../src/picture/map-picture.js";
import { mapSequence } from "../src/picture/map-sequence.js";
import { textWidth } from "../src/picture/svg.js";
import type { Handoff, OperationMap } from "../src/types.js";
import { fixturesDir, read, repoRoot } from "./helpers.js";

const mapsDir = join(fixturesDir, "maps");
const LONG = "handoffs/briefs/plan-2026-10-04/build.grooph-map.json";
const mapAt = (path: string): OperationMap => parseMapText(read(path)).map!;
const sample = (name: string): OperationMap => mapAt(join(mapsDir, "valid", `${name}.grooph-map.json`));
const long = (): OperationMap => mapAt(join(repoRoot, LONG));
/** Every valid map in the repository: the five samples, and the long map of the first push. */
const every = (): [string, OperationMap][] => [
  ...readdirSync(join(mapsDir, "valid"))
    .filter((f) => f.endsWith(".grooph-map.json"))
    .sort()
    .map((f): [string, OperationMap] => [f, mapAt(join(mapsDir, "valid", f))]),
  ["the long map", long()],
];
const wide = (map: OperationMap, more: { width?: number; theme?: "light" | "dark" } = {}): string => mapPicture(map, { theme: "light", layout: "wide", ...more });

// ─── reading a picture back ───────────────────────────────────────────────

type Segment = [number, number, number, number];
type Box = { x: number; y: number; w: number; h: number };

/** Each handoff's line as its straight runs. A rounded corner is read as the corner it rounds. */
function arcsOf(svg: string): { id: string; runs: Segment[] }[] {
  return [...svg.matchAll(/<g data-handoff="([^"]+)">(?:<rect [^>]*\/>)?<path d="([^"]+)" fill="none"/g)].map((m) => {
    const runs: Segment[] = [];
    let [x, y] = [0, 0];
    const to = (nx: number, ny: number): void => {
      if (nx !== x || ny !== y) runs.push([x, y, nx, ny]);
      [x, y] = [nx, ny];
    };
    for (const t of m[2]!.matchAll(/([MLHVQhv])\s*([-\d.,\s]*)/g)) {
      const n = t[2]!.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (t[1] === "M") [x, y] = [n[0]!, n[1]!];
      else if (t[1] === "L") to(n[0]!, n[1]!);
      else if (t[1] === "H") to(n[0]!, y);
      else if (t[1] === "V") to(x, n[0]!);
      else if (t[1] === "h") to(x + n[0]!, y);
      else if (t[1] === "v") to(x, y + n[0]!);
      else {
        to(n[0]!, n[1]!);
        to(n[2]!, n[3]!);
      }
    }
    return { id: m[1]!, runs };
  });
}

const level = (s: Segment): boolean => s[1] === s[3];
const upright = (s: Segment): boolean => s[0] === s[2];
const shared = (a1: number, a2: number, b1: number, b2: number): number => Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));

/** How often two different arcs cross, and how often one runs along another. */
function meetings(arcs: { runs: Segment[] }[]): { crossings: number; shared: number } {
  let crossings = 0;
  let along = 0;
  arcs.forEach((one, i) => {
    for (const other of arcs.slice(i + 1)) {
      for (const a of one.runs) {
        for (const b of other.runs) {
          if ((level(a) && upright(b)) || (upright(a) && level(b))) {
            const [h, v] = level(a) ? [a, b] : [b, a];
            if (h[1] > Math.min(v[1], v[3]) + 0.01 && h[1] < Math.max(v[1], v[3]) - 0.01 && v[0] > Math.min(h[0], h[2]) + 0.01 && v[0] < Math.max(h[0], h[2]) - 0.01) crossings++;
          } else if (level(a) && level(b) && Math.abs(a[1] - b[1]) < 0.5 && shared(a[0], a[2], b[0], b[2]) > 1) along++;
          else if (upright(a) && upright(b) && Math.abs(a[0] - b[0]) < 0.5 && shared(a[1], a[3], b[1], b[3]) > 1) along++;
        }
      }
    }
  });
  return { crossings, shared: along };
}

const boxes = (svg: string, pattern: RegExp): (Box & { id: string })[] => [...svg.matchAll(pattern)].map((m) => ({ id: m[1]!, x: Number(m[2]), y: Number(m[3]), w: Number(m[4]), h: Number(m[5]) }));
const cardsOf = (svg: string) => boxes(svg, /<g data-(?:session|person)="([^"]+)"[^>]*>(?:<rect x=[^>]*\/>)*<rect data-card="" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g);
const lanesOf = (svg: string) => boxes(svg, /<g data-lane="([^"]+)"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g);
const wordsOf = (svg: string): string[] => [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
const sizeOf = (svg: string): [number, number] => /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number) as [number, number];
const once = (svg: string, mark: string): boolean => svg.split(mark).length - 1 === 1;

/** The runs of any arc that pass through a card: none may. */
function overCards(svg: string): string[] {
  const cards = cardsOf(svg);
  return arcsOf(svg).flatMap((arc) =>
    arc.runs.flatMap((s) => cards.filter((c) => Math.max(s[0], s[2]) > c.x + 1 && Math.min(s[0], s[2]) < c.x + c.w - 1 && Math.max(s[1], s[3]) > c.y + 1 && Math.min(s[1], s[3]) < c.y + c.h - 1).map((c) => `${arc.id} over ${c.id}`)),
  );
}

/** What every drawing of a map must hold, whichever view it is. */
function whole(name: string, svg: string, map: OperationMap, known: Handoff[] = map.handoffs): void {
  assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name}: a number or a word is missing`);
  assert.ok(!svg.includes("var(--"), `${name}: a light picture carries its colors`);
  for (const h of known) assert.ok(once(svg, `data-handoff="${h.id}"`), `${name}: handoff ${h.id} is not drawn once`);
  for (const p of map.people ?? []) assert.ok(once(svg, `data-person="${p.id}"`), `${name}: person ${p.id}`);
}

// ─── lanes side by side ───────────────────────────────────────────────────

test("lanes side by side: every person, session and handoff once, the same bytes twice, each lane a column, no line over a card", () => {
  for (const [name, map] of every()) {
    const svg = wide(map);
    assert.equal(svg, wide(map), `${name}: not deterministic`);
    assert.match(svg, /^<svg [^>]*data-picture="map" viewBox="0 0 [\d.]+ [\d.]+"/, name);
    whole(name, svg, map);
    for (const s of map.sessions) assert.ok(once(svg, `data-session="${s.id}"`), `${name}: session ${s.id}`);
    for (const h of map.handoffs) for (const part of ["plate", "number", "handoff-row"]) assert.ok(once(svg, `data-${part}="${h.id}"`), `${name}: handoff ${h.id} has no ${part}`);

    // The lanes are columns of one height, left to right in the document's order, and each card is in its lane's.
    const lanes = lanesOf(svg);
    const cards = cardsOf(svg);
    assert.deepEqual(lanes.map((l) => l.id), map.lanes.map((l) => l.id), name);
    lanes.forEach((lane, i) => {
      assert.equal(lane.y, lanes[0]!.y, `${name}: lane ${lane.id} starts where the others do`);
      assert.equal(lane.h, lanes[0]!.h, `${name}: lane ${lane.id} is as deep as the others`);
      if (i > 0) assert.ok(lane.x >= lanes[i - 1]!.x + lanes[i - 1]!.w, `${name}: lane ${lane.id} is beside the one before it`);
    });
    for (const s of map.sessions) {
      const card = cards.find((c) => c.id === s.id)!;
      const lane = lanes.find((l) => l.id === s.lane)!;
      assert.ok(card.x > lane.x && card.x + card.w < lane.x + lane.w && card.y > lane.y && card.y + card.h < lane.y + lane.h, `${name}: ${s.id} is inside its lane`);
    }
    // The people are a band across the top, above every lane.
    const band = /<g data-people=""><rect x="[\d.]+" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg);
    assert.equal(band !== null, (map.people ?? []).length > 0, name);
    if (band) assert.ok(Number(band[1]) + Number(band[3]) <= lanes[0]!.y && Number(band[2]) > sizeOf(svg)[0] - 30, `${name}: the people are not a band across the top`);

    // No arc runs over a card, and no two arcs run along the same line.
    const arcs = arcsOf(svg);
    assert.equal(arcs.length, map.handoffs.length, name);
    assert.deepEqual(overCards(svg), [], name);
    assert.equal(meetings(arcs).shared, 0, `${name}: two arcs share a line`);

    // Words are measured as on the phone's picture: every line on a card ends inside it.
    for (const card of cards) {
      const group = svg.slice(svg.indexOf(`="${card.id}"`), svg.indexOf("</g>", svg.indexOf(`="${card.id}"`)));
      for (const t of group.matchAll(/<text x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)"( font-family="[^"]*")?( font-weight="700")?( text-anchor="middle")? [^>]*>([^<]*)</g)) {
        const width = textWidth(t[6]!.replace(/&amp;/g, "&"), Number(t[2]), t[3] ? "mono" : t[4] ? "bold" : "regular");
        const right = t[5] ? Number(t[1]) + width / 2 : Number(t[1]) + width;
        assert.ok(right <= card.x + card.w - 4, `${name}: "${t[6]}" runs past the card of ${card.id}`);
      }
    }
  }
});

test("side by side a map's arcs cross a handful of times, where the phone's one margin makes them cross a hundred", () => {
  // The phone's picture has one margin for every arc, so each level run crosses the uprights between it and its own.
  const counted: [string, OperationMap, number, number][] = [
    ["the long map", long(), 100, 3],
    ["the sample, with its owner", sample("owner-operation-2026-10-01-with-ryan"), 100, 3],
    ["the sample", sample("owner-operation-2026-10-01"), 100, 2],
    ["the first draft", sample("owner-operation-2026-09-30"), 30, 0],
    ["a person and two sessions", sample("a-person-and-two-sessions"), 2, 0],
  ];
  // docs/operation-map.md §4 and §4c give the long map's two figures.
  assert.deepEqual([meetings(arcsOf(mapPicture(long(), { theme: "light" }))).crossings, meetings(arcsOf(wide(long()))).crossings], [118, 3]);
  for (const [name, map, phoneAtLeast, wideAtMost] of counted) {
    const phone = meetings(arcsOf(mapPicture(map, { theme: "light" }))).crossings;
    const side = meetings(arcsOf(wide(map))).crossings;
    assert.ok(phone >= phoneAtLeast, `${name}: the phone's picture has ${phone} crossings`);
    assert.ok(side <= wideAtMost, `${name}: side by side there are ${side} crossings, more than ${wideAtMost}`);
  }
});

/** Three lanes of two sessions and two people, with an arc of every kind: no one session is the hub. */
function tangle(): OperationMap {
  const carrier = { kind: "session-message" } as const;
  const pairs: [string, string][] = [
    ["a1", "a2"], ["a2", "a1"], ["a1", "a1"], ["b1", "b2"], ["c2", "c1"], // within a lane, and a session to itself
    ["a1", "b2"], ["b1", "a2"], ["b2", "c1"], ["c2", "b1"], ["b1", "c1"], // between neighbors, both ways
    ["a2", "c2"], ["c1", "a1"], ["a1", "c2"], // over the lane between
    ["p", "a1"], ["a2", "p"], ["p", "b1"], ["q", "c2"], ["b2", "q"], ["c1", "p"], ["q", "a2"], // people, near and far
    ["p", "q"], ["q", "p"], // person to person
  ];
  return {
    groophMap: 0,
    id: "tangle",
    name: "No hub",
    version: 1,
    lanes: ["a", "b", "c"].map((id) => ({ id, name: `Lane ${id}`, machine: "a machine", account: "an account" })),
    people: ["p", "q"].map((id) => ({ id, name: `Person ${id}`, role: "Carries what the sessions cannot" })),
    sessions: ["a1", "a2", "b1", "b2", "c1", "c2"].map((id) => ({ id, name: `Session ${id}`, lane: id[0]!, harness: "claude-code", role: "Does one piece of the work and hands it on" })),
    handoffs: pairs.map(([from, to], i) => ({ id: `h${i + 1}`, from, to, carrier, what: "a piece" })),
  };
}

test("no session is assumed to be the hub: arcs of every kind between three lanes and two people, none over a card or along another", () => {
  const map = tangle();
  const svg = wide(map);
  assert.equal(svg, wide(map));
  whole("no hub", svg, map);
  const arcs = arcsOf(svg);
  assert.equal(arcs.length, map.handoffs.length);
  assert.deepEqual(overCards(svg), []);
  assert.equal(meetings(arcs).shared, 0);
  // Each arc starts on its sender's card and ends at its receiver's, on an edge.
  const cards = cardsOf(svg);
  const near = (x: number, y: number, c: Box): boolean => x >= c.x - 7 && x <= c.x + c.w + 7 && y >= c.y - 7 && y <= c.y + c.h + 7;
  for (const h of map.handoffs) {
    const runs = arcs.find((a) => a.id === h.id)!.runs;
    const [first, last] = [runs[0]!, runs[runs.length - 1]!];
    assert.ok(near(first[0], first[1], cards.find((c) => c.id === h.from)!), `${h.id} does not start at ${h.from}`);
    assert.ok(near(last[2], last[3], cards.find((c) => c.id === h.to)!), `${h.id} does not end at ${h.to}`);
  }
  // The same map with its lanes in another order is another picture, and as whole.
  const turned = wide({ ...map, lanes: [...map.lanes].reverse() });
  assert.notEqual(turned, svg);
  assert.deepEqual(overCards(turned), []);
  assert.equal(meetings(arcsOf(turned)).shared, 0);
});

test("given a room, the cards give way first, then the tracks, and a card is never narrower than its least", () => {
  const cut = (svg: string): string[] => wordsOf(svg).filter((w) => w.endsWith("…"));
  const map = sample("owner-operation-2026-10-01-with-ryan");
  const cardWidth = (svg: string): number => cardsOf(svg).find((c) => c.id === "operator")!.w;
  const natural = wide(map);
  assert.equal(cardWidth(natural), 168);
  // More room than it needs changes nothing: the picture is as wide as its lanes make it.
  assert.equal(wide(map, { width: 4000 }), natural);
  // Less: the picture fits the room while its cards can still be read.
  for (const room of [900, 820, 760]) {
    const fitted = wide(map, { width: room });
    assert.ok(sizeOf(fitted)[0] <= room + 0.1, `in ${room} it is ${sizeOf(fitted)[0]} wide`);
    assert.ok(cardWidth(fitted) >= 150 && cardWidth(fitted) < 168);
    assert.deepEqual(overCards(fitted), []);
    assert.equal(meetings(arcsOf(fitted)).shared, 0);
  }
  // Far less: the cards are at their least, and the picture is wider than the room and whole.
  const least = wide(map, { width: 300 });
  assert.equal(cardWidth(least), 150);
  assert.ok(sizeOf(least)[0] > 300);
  // Even then no word is cut short, on this map or the others: a card's least is wide enough for a repository's name.
  for (const [name, each] of every()) for (const room of [undefined, 900, 300]) assert.deepEqual(cut(wide(each, room === undefined ? {} : { width: room })), [], `${name}, in ${room ?? "its own width"}`);
  whole("in no room", least, map);
  // The phone's picture does not know the option's other values, and is what it was: the golden files say so.
  assert.equal(mapPicture(map, { theme: "light", width: 400 }), mapPicture(map, { theme: "light" }));
});

// ─── the sequence ─────────────────────────────────────────────────────────

test("the sequence: a column for each person and session, a row for each handoff in the map's order, from sender to receiver", () => {
  for (const [name, map] of every()) {
    const svg = mapSequence(map, { theme: "light" });
    assert.equal(svg, mapSequence(map, { theme: "light" }), `${name}: not deterministic`);
    assert.match(svg, /^<svg [^>]*data-picture="sequence" viewBox="0 0 [\d.]+ [\d.]+"/, name);
    whole(name, svg, map);
    for (const s of map.sessions) assert.ok(once(svg, `data-session="${s.id}"`), `${name}: session ${s.id}`);

    // It says what it is: an order, and not a clock.
    assert.ok(wordsOf(svg).join(" ").includes("An order, not a clock: a map records no times."), `${name}: the picture does not say it is an order`);
    // Nothing is cut short: every name, carrier and thing handed is whole.
    assert.deepEqual(wordsOf(svg).filter((w) => w.endsWith("…")), [], name);

    // Each column's line is under its head; each lane's box holds its sessions' columns and no other's.
    const heads = new Map(cardsOf(svg).map((c) => [c.id, c.x + c.w / 2]));
    assert.equal(heads.size, map.sessions.length + (map.people ?? []).length, name);
    const lanes = lanesOf(svg);
    for (const s of map.sessions) {
      const at = heads.get(s.id)!;
      for (const lane of lanes) assert.equal(at > lane.x && at < lane.x + lane.w, lane.id === s.lane, `${name}: ${s.id} and the box of lane ${lane.id}`);
    }

    // The rows run down the page in the map's order, each an arrow from its sender's line to its receiver's, drawn as its carrier is.
    const arcs = arcsOf(svg);
    assert.deepEqual(arcs.map((a) => a.id), map.handoffs.map((h) => h.id), `${name}: the rows are not in the map's order`);
    let above = 0;
    map.handoffs.forEach((h, i) => {
      const runs = arcs[i]!.runs;
      const [first, last] = [runs[0]!, runs[runs.length - 1]!];
      assert.ok(first[1] > above, `${name}: ${h.id} is not below the row before it`);
      above = Math.max(first[1], last[3]);
      assert.ok(Math.abs(first[0] - heads.get(h.from)!) <= 0.2, `${name}: ${h.id} does not leave ${h.from}'s line`);
      assert.ok(Math.abs(last[2] - heads.get(h.to)!) <= 5.7, `${name}: ${h.id} does not reach ${h.to}'s line`);
      const style = CARRIER_STYLE[h.carrier?.kind ?? "none"];
      const line = new RegExp(`data-handoff="${h.id}">(?:<rect [^>]*/>)?<path [^>]*stroke-width="${style.width}"[^>]*${style.dash ? `stroke-dasharray="${style.dash}"` : ""}`).exec(svg);
      assert.ok(line && (style.dash !== undefined || !line[0].includes("stroke-dasharray")), `${name}: ${h.id} is not drawn as a ${h.carrier?.kind}`);
      if (h.what) assert.ok(wordsOf(svg.slice(svg.indexOf(`data-handoff="${h.id}"`)).split("</g>")[0]!).join(" ").endsWith(h.what.split(" ").pop()!), `${name}: ${h.id} does not say what is handed, to its last word`);
    });
  }
});

test("a width gives the sequence's words more room or less; its columns stay as wide as their names need", () => {
  const map = long();
  const natural = mapSequence(map, { theme: "light" });
  const [roomy, tight] = [mapSequence(map, { theme: "light", width: 3000 }), mapSequence(map, { theme: "light", width: 300 })];
  assert.equal(sizeOf(roomy)[0] - sizeOf(natural)[0], 90);
  assert.equal(sizeOf(natural)[0] - sizeOf(tight)[0], 80);
  const columns = (svg: string): number[] => cardsOf(svg).map((c) => c.x);
  assert.deepEqual(columns(roomy), columns(natural));
  assert.deepEqual(columns(tight), columns(natural));
  // A family says how many it stands for, in its column's head.
  assert.ok(wordsOf(natural).some((w) => w.endsWith("×2")));
});

// ─── what both must survive, and what is kept ─────────────────────────────

test("a map with errors, with nothing to hand, or with an empty lane still draws both ways", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : f.endsWith(".grooph-map.json") ? [join(dir, f)] : []));
  let drawn = 0;
  for (const file of walk(join(mapsDir, "invalid"))) {
    const map = parseMapText(read(file)).map;
    if (!map) continue; // not a map's shape (E_SCHEMA): it never reaches a picture
    const laneIds = new Set(map.lanes.map((l) => l.id));
    const ends = new Set([...(map.people ?? []).map((p) => p.id), ...map.sessions.filter((s) => laneIds.has(s.lane)).map((s) => s.id)]);
    const known = map.handoffs.filter((h) => ends.has(h.from) && ends.has(h.to));
    for (const [view, svg] of [["side by side", wide(map)], ["sequence", mapSequence(map, { theme: "light" })]] as const) {
      whole(`${file}, ${view}`, svg, { ...map, people: map.people ?? [] }, known);
      // A handoff whose end is unknown is left out, as on the phone's picture: the validator names it.
      assert.equal(arcsOf(svg).length, known.length, `${file}, ${view}`);
    }
    drawn++;
  }
  assert.ok(drawn >= 8, `only ${drawn} of the failing fixtures were drawn`);

  const base = sample("two-sessions");
  const quiet: OperationMap = { ...base, lanes: [...base.lanes, { id: "spare", name: "A spare machine", machine: "a desk", account: "nobody yet" }], handoffs: [] };
  const side = wide(quiet);
  whole("nothing to hand, side by side", side, quiet);
  assert.ok(wordsOf(side).includes("no sessions") && !wordsOf(side).includes("Handoffs"));
  const rows = mapSequence(quiet, { theme: "light" });
  whole("nothing to hand, as a sequence", rows, quiet);
  assert.equal(lanesOf(rows).length, 1, "a lane with no session has no column");
  const nobody: OperationMap = { ...base, sessions: [], handoffs: [] };
  for (const svg of [wide(nobody), mapSequence(nobody, { theme: "light" })]) assert.ok(!/NaN|undefined|Infinity/.test(svg));
});

test("the committed pictures of both views are what the code draws, light and dark", () => {
  for (const [id, source] of [
    ["a-person-and-two-sessions", "fixtures/maps/valid/a-person-and-two-sessions.grooph-map.json"],
    ["grooph-builds-grooph-2026-10-04", LONG],
  ] as const) {
    const map = mapAt(join(repoRoot, source));
    assert.equal(map.id, id);
    for (const theme of ["light", "dark"] as const) {
      for (const [view, flags, svg] of [
        ["wide", "--layout wide", wide(map, { theme })],
        ["sequence", "--view sequence", mapSequence(map, { theme })],
      ] as const) {
        const file = join(mapsDir, "pictures", `${id}.${view}.${theme}.svg`);
        const again = `node packages/cli/bin/grooph.js image ${source} ${flags} --theme ${theme} --out fixtures/maps/pictures/${id}.${view}.${theme}.svg`;
        assert.ok(existsSync(file), `${file} is missing: ${again}`);
        assert.equal(read(file), svg, `${file} is stale: run \`${again}\` and look at it`);
      }
    }
  }
});
