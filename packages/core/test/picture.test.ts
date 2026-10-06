/**
 * The picture, the outline and the offline page (slice 0025): every graph in
 * the repository draws, says everything it holds, and does so the same way
 * twice; the offline page is one file that asks the network for nothing.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalize } from "../src/canonicalize.js";
import { canonicalizeMap, parseMapText } from "../src/map.js";
import { offlinePage } from "../src/index.js";
import { mapOutline, outline, outlineMarkdown } from "../src/outline.js";
import { parseGraphText } from "../src/parse.js";
import { picture } from "../src/picture/graph-picture.js";
import { mapPicture } from "../src/picture/map-picture.js";
import { assignTracks, textWidth, truncate, wrap } from "../src/picture/svg.js";
import type { Graph } from "../src/types.js";
import { fixturesDir, read, repoRoot, validFixtures } from "./helpers.js";

const graph = (path: string): Graph => parseGraphText(read(path)).doc!;
const patternsDir = join(repoRoot, "patterns");
const everyGraph = (): { name: string; doc: Graph }[] => [
  ...validFixtures().map((f) => ({ name: `fixtures/valid/${f.name}`, doc: graph(f.path) })),
  ...readdirSync(patternsDir)
    .filter((name) => name.endsWith(".grooph.json"))
    .sort()
    .map((name) => ({ name: `patterns/${name}`, doc: graph(join(patternsDir, name)) })),
];
const reviewLoop = (): Graph => graph(join(fixturesDir, "valid", "review-loop.grooph.json"));

test("every graph in the repository draws: each node, edge and loop once, the same bytes twice, 400 units wide", () => {
  const all = everyGraph();
  assert.ok(all.length >= 22, `expected the valid fixtures and the twenty patterns, found ${all.length}`);
  for (const { name, doc } of all) {
    const svg = picture(doc, { theme: "light" });
    assert.equal(svg, picture(doc, { theme: "light" }), `${name}: not deterministic`);
    assert.match(svg, /^<svg [^>]*data-picture="graph" viewBox="0 0 400 [\d.]+"/, name);
    for (const n of doc.nodes) assert.equal(svg.split(`data-node="${n.id}"`).length - 1, 1, `${name}: node ${n.id} is drawn ${svg.split(`data-node="${n.id}"`).length - 1} times`);
    for (const e of doc.edges) assert.equal(svg.split(`data-edge="${e.id}"`).length - 1, 1, `${name}: edge ${e.id}`);
    for (const l of doc.loops) assert.equal(svg.split(`data-loop="${l.id}"`).length - 1, 1, `${name}: loop ${l.id}`);
    assert.ok(!svg.includes("NaN") && !svg.includes("undefined"), `${name}: a number or a word is missing`);
    assert.ok(!svg.includes("var(--"), `${name}: a light picture carries its colors`);
  }
});

test("the committed pictures are what the code draws, light and dark", () => {
  for (const doc of [reviewLoop(), graph(join(patternsDir, "specialist-critic-bank.grooph.json"))]) {
    for (const theme of ["light", "dark"] as const) {
      const file = join(fixturesDir, "pictures", `${doc.id}.${theme}.svg`);
      assert.ok(existsSync(file), `${file} is missing: run \`pnpm --filter @grooph/core run golden:write\``);
      assert.equal(read(file), picture(doc, { theme }), `${file} is stale: run \`pnpm --filter @grooph/core run golden:write\` and look at it`);
    }
  }
});

test("the picture says what the graph holds: names, roles, conditions, the bar and every stop in order", () => {
  const svg = picture(reviewLoop(), { theme: "light" });
  for (const said of ["Review loop", "Builder", "Critic", "Merge approval", "Done", "builder · strong · high", "Human gate", ">pass<", ">fail<", "Build-review cycle", "judgment loop", "Bar: Review checklist.", "1. bar passed", "2. max iterations: 4", "3. budget: 40 turns"]) {
    assert.ok(svg.includes(said), `the picture does not say "${said}"`);
  }
  // A back edge is drawn in its loop's color, dashed, in the right margin; an auto picture follows the viewer.
  assert.match(svg, /<g data-edge="e-review-fail"><path [^>]*stroke-dasharray="5 3" style="stroke:#7a4cc2"/);
  assert.match(picture(reviewLoop()), /prefers-color-scheme:dark/);
  // An empty graph, and one whose edge points nowhere, still draw.
  const empty: Graph = { grooph: 0, id: "empty", name: "Empty", version: 1, nodes: [], edges: [], loops: [] };
  assert.ok(picture(empty, { theme: "dark" }).includes("no nodes yet"));
  const dangling: Graph = { ...reviewLoop(), edges: [...reviewLoop().edges, { id: "e-nowhere", from: "builder", to: "ghost" }] };
  assert.ok(!picture(dangling, { theme: "light" }).includes('data-edge="e-nowhere"'));
});

test("text is measured without a browser: wrapping keeps every word, truncation ends in an ellipsis, tracks never share a span", () => {
  const words = "Compare the diff and test output against the checklist and cite the file and line that satisfies each item";
  const lines = wrap(words, 180, 11, 10);
  assert.equal(lines.join(" "), words);
  for (const line of lines) assert.ok(textWidth(line, 11) <= 180, line);
  const cut = wrap(words, 180, 11, 2);
  assert.equal(cut.length, 2);
  assert.ok(cut[1]!.endsWith("…") && textWidth(cut[1]!, 11) <= 180);
  assert.equal(truncate("short", 200, 11), "short");
  assert.deepEqual(wrap("", 100, 11, 2), [""]);
  assert.equal(wrap("Pneumonoultramicroscopicsilicovolcanoconiosis", 60, 11, 2).length, 1);

  const { tracks, count } = assignTracks([{ from: 0, to: 10 }, { from: 2, to: 4 }, { from: 5, to: 8 }, { from: 11, to: 12 }]);
  assert.equal(count, 2);
  assert.deepEqual(tracks, [1, 0, 0, 0]); // the short spans take the inner track; the long one goes around
});

test("text is measured for the widest font a picture is likely to meet, so a line that fits does on Linux too", () => {
  // Advances in ems read from Verdana with a font tool, once, on 2026-10-01. Verdana is about as wide as DejaVu Sans,
  // which is what a bare Linux machine draws `sans-serif` with, and a tenth wider than Arial, which the measure used to assume.
  const regular: [string, number][] = [
    ["Each builds one piece of Splashery on its own branch. Opus 5.5 now; Sonnet 5.5 for lighter work (none running)", 56.85],
    ["a results file per run on a results branch: a RESULT line, the tree tested, each failure and its owner", 50.0],
    ["scheduled message · every 30-45 min", 19.26],
    ["WWW MMM @@@ 000 iii lll", 13.81],
  ];
  const bold: [string, number][] = [
    ["Splashery lanes", 8.86],
    ["Claude Code · claude-opus-5-5", 17.2],
    ["Operator → One-off helpers", 15.45],
    ["Ryan's operation, October 1, 2026", 19.24],
  ];
  for (const [words, ems] of regular) {
    assert.ok(textWidth(words, 1) >= ems, `"${words.slice(0, 30)}…" measured ${textWidth(words, 1).toFixed(2)}, drawn ${ems} in a wide font`);
    assert.ok(textWidth(words, 1) <= ems * 1.06, `"${words.slice(0, 30)}…" measured far wider than any font draws it`);
  }
  for (const [words, ems] of bold) {
    assert.ok(textWidth(words, 1, "bold") >= ems, `bold "${words}" measured ${textWidth(words, 1, "bold").toFixed(2)}, drawn ${ems}`);
    assert.ok(textWidth(words, 1, "bold") <= ems * 1.06);
  }
});

test("a map with one hub keeps its words: the cards keep most of the lane, names and models are whole, and a tall card uses its room", () => {
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "owner-operation-2026-10-01.grooph-map.json"))).map!;
  const svg = mapPicture(map, { theme: "light" });
  // Eighteen handoffs, nearly all through the Operator, are eighteen tracks: the tracks close up and the cards keep their share.
  const cardWidths = [...svg.matchAll(/<rect data-card="" x="[\d.]+" y="[\d.]+" width="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(cardWidths.length, map.sessions.length);
  for (const w of cardWidths) assert.ok(w >= 0.56 * (400 - 2 * 12 - 2 * 8) - 0.5, `a card is ${w} units wide`);
  // The Operator found "Splashery la…" and "Cloud, account…" in 0.1.0.
  const words = [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
  for (const whole of ["Splashery lanes", "Digest and patrol", "Research lanes", "One-off helpers", "Cloud, account B", "claude-opus-5-5", "claude-sonnet-5-5"]) assert.ok(words.includes(whole), `"${whole}" is not drawn whole`);
  // The Operator's card is tall because seventeen arcs end on it; its role is all there, and so is every other session's.
  assert.ok(words.includes("project too"), "the Operator's role stops before its last words");
  const cut = words.filter((w) => w.endsWith("…"));
  assert.deepEqual(cut, [], "words cut short");
  // Every handoff's line in the list is whole too.
  for (const h of map.handoffs) if (h.what) assert.ok(words.includes(h.what.split(" ").slice(-1)[0]!) || words.some((w) => w.endsWith(h.what!.split(" ").slice(-2).join(" "))), `handoff ${h.id}: its last words are missing`);
});

test("however many handoffs a hub has, a card is never narrower than 120 units, and a first line may be narrower than the rest", () => {
  const sample = parseMapText(read(join(fixturesDir, "maps", "valid", "two-sessions.grooph-map.json"))).map!;
  const lane = sample.lanes[0]!.id;
  for (const spokes of [20, 30, 52, 90]) {
    const sessions = [{ id: "hub", name: "Hub", lane, harness: "claude-code", role: "Hands everything out" }, ...Array.from({ length: spokes }, (_, i) => ({ id: `spoke-${i}`, name: `Spoke ${i}`, lane, harness: "claude-code", role: "Takes one thing" }))];
    const handoffs = Array.from({ length: spokes }, (_, i) => ({ id: `h-${i}`, from: "hub", to: `spoke-${i}`, carrier: { kind: "session-message" as const } }));
    const svg = mapPicture({ ...sample, sessions, handoffs }, { theme: "light" });
    const widths = [...svg.matchAll(/<rect data-card="" x="[\d.]+" y="[\d.]+" width="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
    assert.equal(widths.length, spokes + 1);
    for (const w of widths) assert.ok(w >= 119.5, `${spokes} handoffs: a card is ${w} units wide`);
    assert.ok(!/width="-/.test(svg), `${spokes} handoffs: a negative width`);
  }
  // A family's name shares its first line with the count; its second line has the whole width.
  assert.deepEqual(wrap("one two three four five six", (line) => (line === 0 ? textWidth("one two", 10) : textWidth("three four five six", 10)), 10, 2), ["one two", "three four five six"]);
});

test("a handoff's number is readable and belongs to one line: two digits get a wider ring, the arc's own line stops at it, and every other line runs over it unbroken", () => {
  for (const name of ["owner-operation-2026-10-01", "owner-operation-2026-10-01-with-ryan", "owner-operation-2026-09-30"]) {
    const map = parseMapText(read(join(fixturesDir, "maps", "valid", `${name}.grooph-map.json`))).map!;
    const svg = mapPicture(map, { theme: "light" });
    const lines = new Map([...svg.matchAll(/<g data-handoff="([^"]+)"><path d="(M[\d.]+,([\d.]+) H[\d.]+ Q([\d.]+),[^"]*? Q[\d.]+,([\d.]+) [^"]*)"/g)].map((m) => [m[1]!, { d: m[2]!, y1: Number(m[3]), x: Number(m[4]), y2: Number(m[5]), at: m.index! }]));
    const plates = new Map(
      [...svg.matchAll(/<g data-plate="([^"]+)">(?:<circle cx="([\d.]+)" cy="([\d.]+)"|<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)")/g)].map((m) => [
        m[1]!,
        // a circle is given by its center; a pill by its corner and width, 14.4 tall
        { x: m[2] !== undefined ? Number(m[2]) : Number(m[4]) + Number(m[6]) / 2, y: m[3] !== undefined ? Number(m[3]) : Number(m[5]) + 7.2, half: m[6] !== undefined ? Number(m[6]) / 2 : 7.2, at: m.index! },
      ]),
    );
    const numbers = new Map([...svg.matchAll(/<g data-number="([^"]+)"><text [^>]*>(\d+)<\/text>/g)].map((m) => [m[1]!, { n: m[2]!, at: m.index! }]));
    const drawn = map.handoffs.map((h) => h.id);
    assert.deepEqual([...lines.keys()], drawn, `${name}: every arc was read`);
    assert.deepEqual([...plates.keys()].sort(), [...drawn].sort(), `${name}: every ring was read`);
    assert.deepEqual([...numbers.keys()], drawn, `${name}: every number was read`);
    const lastLine = Math.max(...[...lines.values()].map((l) => l.at));
    for (const id of drawn) {
      const line = lines.get(id)!;
      const plate = plates.get(id)!;
      const { n, at } = numbers.get(id)!;
      // The Operator's first Linux picture had 10 to 18 touching their rings: a 14.4-unit circle around 12.5 units of digits.
      if (n.length > 1) assert.ok(plate.half * 2 >= textWidth(n, 8.5, "bold") + 4, `${name}: ${n} has ${plate.half * 2} units for its digits`);
      else assert.equal(plate.half, 7.2);
      assert.ok(Math.abs(plate.x - line.x) < 0.2, `${name}: ${n} is on its own arc's upright`);
      // The number itself is drawn after every line: nothing runs over the digits.
      assert.ok(at > lastLine, `${name}: ${n} is drawn before a line`);
      const gap = new RegExp(` V([\\d.]+) M${String(line.x).replace(".", "\\.")},([\\d.]+) V`).exec(line.d);
      if (gap) {
        // The arc's own line stops at its ring and starts again beyond it, and the ring is laid down before any line:
        // so a line that runs behind this ring, on a neighboring track, is drawn over it and is not broken by it.
        assert.deepEqual([Number(gap[1]), Number(gap[2])].sort((a, b) => a - b).map((v) => Math.round(v * 10) / 10), [Math.round((plate.y - 7.2) * 10) / 10, Math.round((plate.y + 7.2) * 10) / 10], `${name}: ${n}'s line stops at its ring`);
        for (const other of lines.values()) assert.ok(plate.at < other.at, `${name}: ${n}'s ring is drawn over a line`);
      } else {
        // Too short to leave a gap (a session's handoff to itself): its ring sits over its own line, as it always did.
        assert.ok(Math.abs(line.y2 - line.y1) < 2 * 7.2 + 2 * 6 + 1, `${name}: ${n} has room for a gap and no gap`);
      }
      // Another arc's level run, where it crosses this arc's track on its way to a card, is at least 9.5 units from the number.
      for (const [oid, o] of lines) {
        if (oid === id || o.x < plate.x - plate.half - 1) continue;
        for (const level of [o.y1, o.y2]) assert.ok(Math.abs(level - plate.y) >= 9.5, `${name}: number ${n} sits ${Math.abs(level - plate.y).toFixed(1)} units from handoff ${numbers.get(oid)!.n}'s line into a card`);
      }
      // Two numbers on tracks close enough to touch have clear ground between their rings.
      for (const [oid, o] of plates) if (oid !== id && Math.abs(o.x - plate.x) <= o.half + plate.half + 1) assert.ok(Math.abs(o.y - plate.y) >= 2 * 7.2 + 5.5, `${name}: numbers ${n} and ${numbers.get(oid)!.n} are ${Math.abs(o.y - plate.y).toFixed(1)} units apart`);
    }
  }
});

test("a card grows with its role, a person's as a session's: nothing is cut at eight lines", () => {
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "a-person-and-two-sessions.grooph-map.json"))).map!;
  const long =
    "Owns the operation. Talks to the lead in one chat, mostly on a phone; marks the private pages (reviews, decisions, two boards and the weekly ideas); reads the morning notifications and says in the chat what matters in them; carries prompts to the sessions the lead cannot reach, and brings their answers back";
  const svg = mapPicture({ ...map, people: [{ ...map.people![0]!, role: long }], sessions: map.sessions.map((s) => (s.id === "worker" ? { ...s, role: long } : s)) }, { theme: "light" });
  const words = [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
  assert.deepEqual(words.filter((w) => w.endsWith("…")), []);
  assert.equal(words.filter((w) => w === "back" || w.endsWith(" back")).length, 2, "the person's role and the session's both run to their last word");
  // And each card is as tall as its words.
  for (const who of ['data-person="owner"', 'data-session="worker"']) {
    const g = svg.slice(svg.indexOf(`<g ${who}`));
    const group = g.slice(0, g.indexOf("</g>"));
    const card = /<rect data-card="" x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/.exec(group)!;
    const lowest = Math.max(...[...group.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)].map((m) => Number(m[1])));
    assert.ok(lowest + 5 <= Number(card[1]) + Number(card[2]), `${who}: text at ${lowest} in a card that ends at ${Number(card[1]) + Number(card[2])}`);
  }
});

test("a person is drawn in a band above the lanes, a notification as a line of dots, and a session that wakes itself says so", () => {
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "a-person-and-two-sessions.grooph-map.json"))).map!;
  const svg = mapPicture(map, { theme: "light" });
  assert.equal(svg.split('data-person="owner"').length - 1, 1);
  assert.ok(svg.indexOf("data-people") < svg.indexOf('data-lane="laptop"'), "the people band is above the lanes");
  for (const h of map.handoffs) assert.equal(svg.split(`data-handoff="${h.id}"`).length - 1, 1, `handoff ${h.id}`);
  const words = [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);
  for (const whole of ["Person", "The owner", "Asks for the work and reads the result", "The owner → Lead", "Lead → The owner", "notification, e-mail", "wakes itself · every hour"]) assert.ok(words.includes(whole), `"${whole}" is not drawn`);
  assert.equal(svg.split("data-wakes").length - 1, 1, "one session wakes itself");
  assert.match(svg, /data-handoff="h-done"><path [^>]*stroke-dasharray="0\.1 4\.5"/);
  // The outline says the same in words.
  const sections = mapOutline(map);
  const owner = sections.find((s) => s.kind === "Person")!;
  assert.deepEqual(owner.items.find((i) => i.label === "Hands work")!.list, ["to Lead, by session message: what is wanted"]);
  assert.deepEqual(owner.items.find((i) => i.label === "Is handed work")!.list, ["from Lead, by notification, e-mail: done, with a link"]);
  assert.equal(sections.find((s) => s.id === "lead")!.items.find((i) => i.label === "Wakes itself")!.text, "every hour");
  // The owner's operation, with the owner drawn: one person, every session and handoff once.
  const ryan = parseMapText(read(join(fixturesDir, "maps", "valid", "owner-operation-2026-10-01-with-ryan.grooph-map.json"))).map!;
  const drawn = mapPicture(ryan, { theme: "light" });
  assert.equal(drawn.split('data-person="ryan"').length - 1, 1);
  for (const h of ryan.handoffs) assert.equal(drawn.split(`data-handoff="${h.id}"`).length - 1, 1, `handoff ${h.id}`);
});

test("the outline reads top to bottom: the graph, each node with its whole brief, each edge as a sentence, each loop with its stops", () => {
  const doc = reviewLoop();
  const sections = outline(doc);
  assert.deepEqual(
    sections.map((s) => `${s.kind}:${s.id}`),
    ["Graph:review-loop", "Agent:builder", "Agent:critic", "Human gate:merge-gate", "Stop:done", "Loop:review-cycle", "Policy:p-critic-isolation", "Policy:p-no-self-grading"],
  );
  const critic = sections.find((s) => s.id === "critic")!;
  const brief = critic.items.find((i) => i.label === "Brief")!.text!;
  assert.equal(brief, (doc.nodes.find((n) => n.id === "critic") as { brief: string }).brief);
  const then = critic.items.find((i) => i.label === "Then")!.list!;
  assert.ok(then.some((line) => /^on fail, to Builder \(back edge: starts the next round; fresh context/.test(line)), then.join(" | "));
  assert.ok(then.some((line) => /^on pass, to Merge approval/.test(line)));
  const loop = sections.find((s) => s.kind === "Loop")!;
  assert.deepEqual(loop.items.find((i) => i.label === "Stops, in order")!.list, [
    "bar passed: follow the loop's pass exit edges",
    "max iterations: 4: halt the run and report to the human",
    "budget: 40 turns: halt the run and report to the human",
  ]);
  const md = outlineMarkdown(sections);
  assert.match(md, /^# Review loop\n/);
  assert.match(md, /\n## Agent: Critic\n\n`critic`\n/);
  assert.ok(md.endsWith("\n") && !md.includes("\n\n\n"));
  for (const { name, doc: any } of everyGraph()) assert.ok(outlineMarkdown(outline(any)).length > 0, name);
});

test("a map's outline: lanes, each session with what it hands on and is handed, in the map's own words", () => {
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "owner-operation-2026-09-30.grooph-map.json"))).map!;
  const sections = mapOutline(map);
  assert.equal(sections[0]!.kind, "Operation map");
  assert.equal(sections.filter((s) => s.kind === "Lane").length, 3);
  assert.equal(sections.filter((s) => s.kind === "Session").length, 7);
  const grooph = sections.find((s) => s.id === "grooph")!;
  assert.deepEqual(grooph.items.find((i) => i.label === "Is handed work")!.list, ["from Operator, by carried by Ryan: the brief for this round, pasted into a fresh session"]);
  assert.equal(sections.find((s) => s.id === "research")!.items.find((i) => i.label === "Hands work")!.list![0]!.startsWith("to itself, by branch on a private research repository"), true);
});

test("the offline page is one file that asks the network for nothing, and gives the document back", () => {
  const doc = reviewLoop();
  const html = offlinePage(doc, { version: "9.9.9" });
  assert.equal(html, offlinePage(doc, { version: "9.9.9" }), "not deterministic");
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:">/);
  // Nothing in the page points at another file or a server: no src, no href but in-page anchors, no url(), no import.
  assert.deepEqual([...html.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]).filter((u) => !u!.startsWith("#")), []);
  assert.ok(!/url\(|@import|<link|<img|<iframe|fetch\(|XMLHttpRequest|WebSocket/.test(html));
  assert.deepEqual([...html.matchAll(/https?:\/\/[^\s"'<)]+/g)].map((m) => m[0]), ["http://www.w3.org/2000/svg"]);
  // The picture, the outline and the validator's list are in it.
  assert.ok(html.includes('data-picture="graph"') && html.includes('id="s-critic"') && html.includes("W_HOMOGENEOUS_CRITICS"));
  assert.ok(html.includes("0 errors, 1 warning."));
  assert.ok(html.includes("grooph 9.9.9"));
  // The document rides inside, and comes back out byte for byte in canonical form.
  const held = /<script type="application\/json" id="grooph-document" data-name="review-loop\.grooph\.json">([\s\S]*?)<\/script>/.exec(html)![1]!;
  assert.equal(`${JSON.stringify(JSON.parse(held), null, 2)}\n`, canonicalize(doc));

  // A document that says </script> or <img onerror> in a brief stays text.
  const hostile: Graph = { ...doc, name: `</script><img src=x onerror=alert(1)>`, goal: `"><script>alert(1)</script>` };
  const page = offlinePage(hostile);
  assert.equal(page.split("</script>").length - 1, 2, "the page has exactly its own two script elements");
  assert.ok(!page.includes("<img"));
  const heldHostile = /id="grooph-document"[^>]*>([\s\S]*?)<\/script>/.exec(page)![1]!;
  assert.equal((JSON.parse(heldHostile) as Graph).name, hostile.name);

  // A map makes the same kind of page.
  const map = parseMapText(read(join(fixturesDir, "maps", "valid", "owner-operation-2026-09-30.grooph-map.json"))).map!;
  const mapPage = offlinePage(map, { link: "https://example.test/#/open?d=abc" });
  assert.ok(mapPage.includes('data-picture="map"') && mapPage.includes('id="s-operator"') && mapPage.includes("No issues. Every handoff names its carrier."));
  assert.ok(mapPage.includes('<a href="https://example.test/#/open?d=abc">open it in the app</a>'));
  const heldMap = /data-name="ryans-operation-2026-09-30\.grooph-map\.json">([\s\S]*?)<\/script>/.exec(mapPage)![1]!;
  assert.equal(`${JSON.stringify(JSON.parse(heldMap), null, 2)}\n`, canonicalizeMap(map));
});
