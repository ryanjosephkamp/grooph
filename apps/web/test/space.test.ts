import { readFileSync } from "node:fs";
import { join } from "node:path";

import { mapKit, parseMapText, type OperationMap } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { FRAMES, START, apart, bow, fit, lights, plan, toEye, tooSlow, turned, type V } from "../src/ui/map/space.js";

/** A map in three dimensions (handoff 0087): the arithmetic of `space.ts`, which needs no browser. */
const root = join(import.meta.dirname, "../../..");
const mapOf = (path: string): OperationMap => parseMapText(readFileSync(join(root, path), "utf8")).map!;
const LONG = mapOf("handoffs/briefs/plan-2026-10-04/build.grooph-map.json");
const EIGHT = mapOf("fixtures/maps/valid/owner-operation-2026-10-01-with-ryan.grooph-map.json");
const SMALL = mapOf("fixtures/maps/valid/a-person-and-two-sessions.grooph-map.json");
const count = (html: string, part: string): number => html.split(part).length - 1;
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe("where everything is", () => {
  it("draws every person, session and handoff of the map once, each as a part the screen can name and pick", () => {
    for (const map of [LONG, EIGHT, SMALL]) {
      const made = plan(mapKit, map);
      for (const s of map.sessions) expect(count(made.html, `data-session="${s.id}"`)).toBe(1);
      for (const p of map.people ?? []) expect(count(made.html, `data-person="${p.id}"`)).toBe(1);
      for (const h of map.handoffs) {
        expect(count(made.html, `data-handoff="${h.id}"`)).toBe(1);
        expect(count(made.html, `data-number="${h.id}"`)).toBe(1);
      }
      expect(count(made.html, 'class="space-sheet')).toBe(map.lanes.length + ((map.people ?? []).length ? 1 : 0));
      // An arc's number is its place in the document, as in the flat views.
      expect(made.arcs.map((a) => a.n)).toEqual(map.handoffs.map((_, k) => k + 1));
    }
  });

  it("stacks the sheets with the people on top, each sheet clear of the cards under it, and no two cards in one place", () => {
    for (const per of [3, 4, 6]) {
      const made = plan(mapKit, LONG, { per });
      expect([...made.floors]).toEqual([...made.floors].sort((a, b) => a - b));
      const lanes = ["", ...LONG.lanes.map((l) => l.id)];
      const floorOf = (id: string): number => made.floors[lanes.indexOf(LONG.sessions.find((s) => s.id === id)?.lane ?? "")]!;
      const cards = [...made.cards];
      for (const [id, c] of cards) {
        // A card stands on its own lane's sheet, and its top is under the sheet above.
        expect(c.at[1] + c.h).toBeCloseTo(floorOf(id), 5);
        const above = made.floors[made.floors.indexOf(floorOf(id)) - 1];
        if (above !== undefined) expect(c.at[1]).toBeGreaterThan(above + 40);
      }
      for (const [a, ca] of cards) for (const [b, cb] of cards) if (a < b && ca.at[1] + ca.h === cb.at[1] + cb.h && ca.at[2] === cb.at[2]) expect(Math.abs(ca.at[0] - cb.at[0])).toBeGreaterThanOrEqual(128);
      // An arc ends on its two cards' top edges.
      for (const arc of made.arcs) {
        for (const [end, id] of [[arc.a, arc.from], [arc.b, arc.to]] as const) {
          const c = made.cards.get(id)!;
          expect(end[1]).toBe(c.at[1]);
          expect(end[2]).toBe(c.at[2]);
          expect(end[0]).toBeGreaterThanOrEqual(c.at[0]);
          expect(end[0]).toBeLessThanOrEqual(c.at[0] + 128);
        }
      }
    }
  });

  it("draws lanes further apart the further apart they are: one machine, two machines, local and cloud", () => {
    const lane = (machine: string, place?: "local" | "cloud") => ({ id: machine, name: machine, machine, account: "a", ...(place ? { place } : {}) });
    const [same, other, cloud] = [apart(lane("mac"), lane("mac")), apart(lane("mac"), lane("mini")), apart(lane("mac", "local"), lane("vm", "cloud"))];
    expect(same).toBeLessThan(other);
    expect(other).toBeLessThan(cloud);
    // On the long map the cloud's lane is further below Codex's than Codex's is below the Mac's own.
    const { floors } = plan(mapKit, LONG, { per: 6 });
    expect(floors[3]! - floors[2]!).toBeGreaterThan(floors[2]! - floors[1]!);
  });

  it("fits the starting view inside its frame, whole, at a phone's size and a desk's", () => {
    for (const [map, per, w, h] of [[LONG, 3, 366, 500], [LONG, 6, 936, 600], [EIGHT, 3, 366, 500], [SMALL, 3, 366, 500]] as const) {
      const { box } = plan(mapKit, map, { per });
      const lens = Math.max(900, w * 1.7);
      const size = fit(box, w, h, lens);
      const center: V = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
      const edge = (scale: number): number =>
        Math.max(
          ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
            const c = turned([(k & 1 ? box.max[0] : box.min[0]) - center[0], (k & 2 ? box.max[1] : box.min[1]) - center[1], (k & 4 ? box.max[2] : box.min[2]) - center[2]], START.yaw, START.pitch);
            const near = lens / (lens - c[2] * scale);
            return Math.max(Math.abs(c[0] * scale * near) / (w / 2), Math.abs(c[1] * scale * near) / (h / 2));
          }),
        );
      expect(edge(size)).toBeLessThanOrEqual(1);
      expect(edge(size * 1.1)).toBeGreaterThan(0.98); // and not much smaller than it could be
      expect(size).toBeGreaterThan(0.3);
    }
  });
});

describe("an arc is held flat to the eye", () => {
  const { arcs } = plan(mapKit, LONG);
  it("bows square to the line between its ends, never edge on, and keeps its side as the view turns", () => {
    for (const arc of arcs) {
      const length = Math.hypot(arc.b[0] - arc.a[0], arc.b[1] - arc.a[1], arc.b[2] - arc.a[2]);
      const along: V = [(arc.b[0] - arc.a[0]) / length, (arc.b[1] - arc.a[1]) / length, (arc.b[2] - arc.a[2]) / length];
      let before: V | undefined;
      for (let yaw = -0.96; yaw <= 0.96; yaw += 0.04) {
        for (const pitch of [0.1, 0.46, 1.05]) {
          const side = bow(arc, yaw, pitch, before);
          expect(Math.hypot(...side)).toBeCloseTo(1, 6);
          expect(Math.abs(dot(side, along))).toBeLessThan(1e-6);
          // The plane of the arc holds its chord and its side: the eye is never in that plane's own direction by much.
          const eye = toEye(yaw, pitch);
          const inPlane = Math.hypot(dot(eye, along), dot(eye, side));
          const across = Math.sqrt(Math.max(0, 1 - dot(eye, along) ** 2));
          if (across > 0.05) expect(inPlane).toBeLessThan(Math.abs(dot(eye, along)) + 1e-6);
          if (before) expect(dot(side, before)).toBeGreaterThan(0);
          before = side;
        }
      }
    }
  });

  it("starts on the side that is up on the screen", () => {
    for (const arc of arcs) {
      const side = turned(bow(arc, START.yaw, START.pitch), START.yaw, START.pitch);
      expect(Math.abs(side[1]) > 0.2 ? side[1] : side[0]).toBeLessThanOrEqual(0);
    }
  });

  it("has the eye where the view says it is", () => {
    const eye = turned(toEye(0.3, 0.7), 0.3, 0.7);
    expect(eye[0]).toBeCloseTo(0, 9);
    expect(eye[1]).toBeCloseTo(0, 9);
    expect(eye[2]).toBeCloseTo(1, 9);
  });
});

describe("the slider", () => {
  it("has a stop for all the handoffs and one for each, in the map's order, and says it is an order and not a clock", () => {
    const made = plan(mapKit, LONG);
    expect(made.stops).toHaveLength(LONG.handoffs.length + 1);
    expect(made.stops[0]!.says).toBe("All 19 handoffs are lit. Move the slider or press Play to light them one at a time.");
    expect(made.stops.slice(1).map((s) => s.handoff)).toEqual(LONG.handoffs.map((h) => h.id));
    expect(made.stops[7]!.says).toMatch(/^Handoff 7 of 19: Ryan to Lane 5: Codex target · carried by Ryan/);
    expect(made.html).toContain("An order, not a clock: a map records no times.");
    expect(made.html).toContain(`max="${LONG.handoffs.length}"`);
    expect(made.stops.some((s) => s.now)).toBe(false);
    // A handoff from a session to itself says so.
    const self: OperationMap = { ...SMALL, handoffs: [{ ...SMALL.handoffs[0]!, from: SMALL.sessions[0]!.id, to: SMALL.sessions[0]!.id }] };
    expect(plan(mapKit, self).stops[1]!.says).toContain("to itself");
  });

  it("lights one handoff with its two ends, with those before it behind and those after it further", () => {
    const made = plan(mapKit, LONG);
    expect(lights(made, 0)).toMatchObject({ arcs: LONG.handoffs.map(() => ""), ends: [] });
    const at = lights(made, 7);
    expect(at.arcs.slice(0, 6).every((a) => a === "past")).toBe(true);
    expect(at.arcs[6]).toBe("lit");
    expect(at.arcs.slice(7).every((a) => a === "ahead")).toBe(true);
    expect(at.ends).toEqual([LONG.handoffs[6]!.from, LONG.handoffs[6]!.to]);
    // Past the ends it is the nearest stop.
    expect(lights(made, 99).stop).toBe(made.stops[19]);
    expect(lights(made, -3).stop).toBe(made.stops[0]);
  });

  it("with what the hooks saw, ends at now: every handoff behind, and each session saying what it was last seen doing", () => {
    const seen = (working: number, waiting: number, ended: number, more: object = {}) => ({ sessions: 1, working, waiting, ended, agentsRunning: 0, agentsDone: 0, lastAt: "2026-10-04T17:58:00Z", ...more });
    const live = { driver: seen(1, 0, 0, { agentsRunning: 2 }), "front-door": seen(0, 1, 0), embed: seen(0, 0, 1), toolkit: seen(0, 0, 0, { quiet: 1 }) };
    const made = plan(mapKit, LONG, { live, at: "2026-10-04T18:00:30Z" });
    expect(made.stops).toHaveLength(LONG.handoffs.length + 2);
    const last = made.stops[made.stops.length - 1]!;
    expect(last).toEqual({ now: true, says: "Now, as the hooks saw it at 2026-10-04 18:00 UTC: 1 working, 1 waiting, 1 gone quiet, 1 ended." });
    expect(made.html).toContain(`max="${LONG.handoffs.length + 1}"`);
    expect(made.html).toContain("the slider's last stop is now");
    const now = lights(made, made.stops.length - 1);
    expect(now.stop.now).toBe(true);
    expect(now.arcs.every((a) => a === "past")).toBe(true);
    expect(now.ends).toEqual([]);
    // The stop before it is still the last handoff.
    expect(lights(made, made.stops.length - 2).arcs[LONG.handoffs.length - 1]).toBe("lit");
    // The cards say it: the state as the flat picture marks it, and the words.
    expect(made.html).toMatch(/data-session="driver" data-live="working"/);
    expect(made.html).toContain("working · 2 agents");
    expect(made.html).toMatch(/data-session="front-door" data-live="waiting"/);
    expect(made.html).toMatch(/data-session="embed" data-live="ended"/);
    expect(made.html).toMatch(/data-session="toolkit" data-live="quiet"/);
    expect(made.html).toContain("gone quiet");
    // A session the hooks did not see carries no mark, and a card with a mark is taller for it.
    expect(made.html).toMatch(/data-session="evidence">/);
    expect(made.cards.get("driver")!.h).toBeGreaterThan(plan(mapKit, LONG).cards.get("driver")!.h);
    // Events with no session of this map in them: now is still a stop, and says nothing was seen.
    expect(plan(mapKit, LONG, { live: {} }).stops.at(-1)).toEqual({ now: true, says: "Now: no session has been seen." });
  });
});

describe("how fast it is drawn", () => {
  it("says nothing before two dozen frames, nothing at sixty a second, and the rate when it is under thirty", () => {
    expect(FRAMES).toBe(30);
    expect(tooSlow(Array(23).fill(100))).toBeUndefined();
    expect(tooSlow(Array(60).fill(16.7))).toBeUndefined();
    expect(tooSlow(Array(24).fill(33))).toBeUndefined(); // thirty and a little
    expect(tooSlow(Array(24).fill(50))).toBe(20);
    // It is the last two dozen that count: a slow start that became smooth is smooth.
    expect(tooSlow([...Array(24).fill(80), ...Array(24).fill(16)])).toBeUndefined();
    expect(tooSlow([...Array(24).fill(16), ...Array(24).fill(80)])).toBe(13);
  });
});
