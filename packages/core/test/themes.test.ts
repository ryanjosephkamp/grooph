/**
 * The picture's themes (handoff 0086; docs/themes.md): six looks for one picture. Paper is the picture as it was.
 * The other five change values and nothing else: the markup, the geometry, the words and the accessible name are
 * Paper's. Each is held to 4.5 to 1 for its words, in light and in dark, and each of its rules names only hooks
 * the drawing code writes (that each selector then finds something is a browser's to say: `apps/web/e2e/themes.spec.ts`).
 *
 * That Paper's bytes are what they were before there were themes is not something this file can hold: it has only
 * today's code to draw with. The committed pictures hold it (`picture.test.ts`, `map.test.ts`, `map-views.test.ts`),
 * and the slice's handback records the one comparison with the code before it, over every document in the repository.
 */

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { mapSequence, mapWide } from "../src/index.js";
import { parseMapText } from "../src/map.js";
import { offlinePage } from "../src/offline.js";
import { parseGraphText } from "../src/parse.js";
import { picture } from "../src/picture/graph-picture.js";
import { pictureWithUnits } from "../src/picture/graph-units.js";
import { unitsKit } from "../src/picture/units-kit.js";
import { mapPicture } from "../src/picture/map-picture.js";
import { inkFor, textWidth, wrap, type Color, type PictureOptions, type PictureTheme } from "../src/picture/svg.js";
import { PICTURE_THEMES, THEME_VALUES, isPictureTheme, readTheme, themeParts, themed, themedPage } from "../src/picture/themes.js";
import type { Graph, OperationMap } from "../src/types.js";
import { fixturesDir, read, repoRoot, validFixtures } from "./helpers.js";

const FORMS: PictureTheme[] = ["auto", "light", "dark"];
const FIVE = PICTURE_THEMES.filter((name) => name !== "paper");
/** A theme's style and what it refers to, as a picture carries them: what the tests of the rules read. */
const head = (name: string, form: PictureTheme): string => {
  const parts = themeParts(name, form)!;
  return `<style>${parts.css}</style>${parts.defs ? `<defs>${parts.defs}</defs>` : ""}`;
};
/** A theme's colors in a form, by name; Paper's are the picture's own. */
const colorsOf = (name: string, form: "light" | "dark"): ((color: Color) => string) => (name === "paper" ? inkFor(form) : (color) => themeParts(name, form)!.colors[color]);

const patternsDir = join(repoRoot, "patterns");
const mapsDir = join(fixturesDir, "maps", "valid");
const graphs = (): [string, Graph][] => [
  ...validFixtures().map((f): [string, Graph] => [`fixtures/valid/${f.name}`, parseGraphText(read(f.path)).doc!]),
  ...readdirSync(patternsDir)
    .filter((name) => name.endsWith(".grooph.json"))
    .sort()
    .map((name): [string, Graph] => [`patterns/${name}`, parseGraphText(read(join(patternsDir, name))).doc!]),
];
const maps = (): [string, OperationMap][] => [
  ...readdirSync(mapsDir)
    .filter((name) => name.endsWith(".grooph-map.json"))
    .sort()
    .map((name): [string, OperationMap] => [`fixtures/maps/valid/${name}`, parseMapText(read(join(mapsDir, name))).map!]),
  ["the long map", parseMapText(read(join(repoRoot, "handoffs/briefs/plan-2026-10-04/build.grooph-map.json"))).map!],
];
/** Every picture core draws of every template, valid fixture and sample map: the drawing, by what it is of. */
const everyPicture = (): [string, (options: PictureOptions) => string][] => [
  ...graphs().map(([name, doc]): [string, (o: PictureOptions) => string] => [name, (o) => picture(doc, o)]),
  // A graph with a subgrooph has two more: each subgrooph one box, and each drawn open in a frame.
  ...graphs()
    .filter(([, doc]) => (doc.groups ?? []).some((group) => group.from !== undefined))
    .flatMap(([name, doc]): [string, (o: PictureOptions) => string][] => [
      [`${name}, its subgroophs as boxes`, (o) => pictureWithUnits(unitsKit, doc, o)],
      [`${name}, its subgroophs open`, (o) => pictureWithUnits(unitsKit, doc, { ...o, open: "all" })],
    ]),
  ...maps().flatMap(([name, map]): [string, (o: PictureOptions) => string][] => [
    [`${name}, the phone's`, (o) => mapPicture(map, o)],
    [`${name}, lanes side by side`, (o) => mapWide(map, o)],
    [`${name}, the sequence`, (o) => mapSequence(map, o)],
  ]),
];

/** What a theme puts in the frame, taken back out: its name, its style and what the style refers to, and its ground. */
const bare = (svg: string): string =>
  svg
    .replace(/ data-look="[a-z]+"/, "")
    .replace(/<style>.*?<\/style>(?:<defs>.*?<\/defs>)?/, "")
    .replace(/<rect width="100%" height="100%" fill="url\(#gp-[a-z-]+\)"\/>/, "");

test("Paper by name, and a name that is none of the six, is no theme at all; a picture with none carries nothing of one", () => {
  assert.deepEqual([...PICTURE_THEMES], ["paper", "blueprint", "ink", "phosphor", "transit", "chalk"]);
  // Such a name has no parts, and `themed` gives the picture back as it came: the very text it was handed.
  const plainest = picture(parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!);
  for (const name of [undefined, "paper", "sepia", "constructor", "__proto__", "toString", "", "Blueprint", "chalk ", "chalk-dark"]) {
    assert.equal(themeParts(name), undefined, `themeParts(${JSON.stringify(name)})`);
    for (const form of FORMS) assert.equal(themed(plainest, name, form), plainest, `themed(…, ${JSON.stringify(name)}, ${form})`);
  }
  // Nor is one that is in a theme already: it is not given a second.
  for (const first of FIVE) for (const second of FIVE) assert.throws(() => themed(themed(plainest, first), second), /as core draws it to follow the viewer/, `${first}, then ${second}`);
  // A picture that already has its colors written in is not one a theme can be added to, and that is said.
  assert.throws(() => themed(picture(parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!, { theme: "light" }), "chalk"), /as core draws it to follow the viewer/);
  assert.ok(isPictureTheme("paper") && isPictureTheme("chalk") && !isPictureTheme("constructor"));
  // What `--theme` and an address say: a name, light, dark or auto, or a name and one of them.
  assert.deepEqual(readTheme("chalk"), { name: "chalk" });
  assert.deepEqual(readTheme("chalk-dark"), { name: "chalk", form: "dark" });
  assert.deepEqual(readTheme("dark"), { name: "paper", form: "dark" });
  assert.deepEqual(readTheme("paper-auto"), { name: "paper", form: "auto" });
  for (const wrong of ["sepia", "Chalk", "chalk-", "chalk--dark", "chalk_dark", "dark-chalk", "-dark", "", "constructor", "chalk-dark-dark"]) assert.equal(readTheme(wrong), undefined, wrong);
  for (const [name, draw] of everyPicture()) {
    for (const theme of FORMS) {
      const plain = draw({ theme });
      assert.ok(!plain.includes("data-look") && !plain.includes("<defs>") && !plain.includes("gp-"+"paper"), `${name}, ${theme}: the default picture carries something of a theme`);
      // One `<style>` at most, the palette's, and only in the picture that follows the viewer.
      assert.equal(plain.split("<style>").length - 1, theme === "auto" ? 1 : 0, `${name}, ${theme}`);
    }
  }
});

test("a theme is a set of values: in all six the markup, the geometry and the words are the same", () => {
  let drawn = 0;
  for (const [what, draw] of everyPicture()) {
    const paper = bare(draw({ theme: "auto" }));
    const words = (svg: string): string[] => [...svg.matchAll(/<(?:text|title)[^>]*>([^<]*)</g)].map((m) => m[1]!);
    for (const name of FIVE) {
      const follows = themed(draw({ theme: "auto" }), name);
      assert.match(follows, new RegExp(`^<svg [^>]*data-look="${name}"`), what);
      // The picture that follows the viewer: take out what the theme put in the frame, and it is Paper's.
      assert.equal(bare(follows), paper, `${what} in ${name}: the picture itself differs from Paper's`);
      assert.deepEqual(words(follows), words(draw({ theme: "auto" })), `${what} in ${name}: the words differ`);
      assert.equal(follows, themed(draw({ theme: "auto" }), name), `${what} in ${name}: not the same bytes twice`);
      // A picture in light or dark only is that same picture with each color written in, and nothing left to look up.
      for (const form of ["light", "dark"] as const) {
        const fixed = themed(draw({ theme: "auto" }), name, form);
        const written = bare(follows).replace(/var\(--gp-([a-z0-9-]+)\)/g, (_, color: Color) => themeParts(name, form)!.colors[color]);
        assert.equal(bare(fixed), written, `${what} in ${name}, ${form}`);
        assert.ok(!fixed.includes("var(--") && !fixed.includes("prefers-color-scheme"), `${what} in ${name}, ${form}: a picture in one form carries its colors`);
        // And it is drawn from the same picture Paper's light and dark are: only the colors and the frame differ.
        const strip = (svg: string): string => svg.replace(/ style="[^"]*"/g, "");
        assert.equal(strip(bare(fixed)), strip(draw({ theme: form })), `${what} in ${name}, ${form}: not Paper's ${form} picture with other colors`);
        drawn++;
      }
    }
  }
  assert.ok(drawn > 400, `only ${drawn} pictures were compared`);
});

// ─── contrast ─────────────────────────────────────────────────────────────

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/**
 * Every pair of a color words are drawn in and the ground they are drawn on, read from the drawing code: a graph's
 * and a map's pictures, a map's other two views, the marks an embed adds while a run plays, and the canvas in the
 * web app, which takes a theme's colors as its own (a loop's label on a card's ground, a halted node's badge).
 */
// prettier-ignore
const WORDS_ON: [Color, Color[]][] = [
  // the page: titles, captions, goals, the loops, the handoffs' list, a label's pill (its words are the edge's color)
  ["bg", ["ink", "ink-2", "ink-3", "gate", "warning", "loop-0", "loop-1", "loop-2", "loop-3", "accent", "check", "merge", "error"]],
  // a card: a node's kind, its name and lines; a session's harness, role, schedule, graph and what the hooks saw
  ["surface", ["ink", "ink-2", "ink-3", "accent", "gate", "check", "merge", "stop", "loop-0", "loop-1", "loop-2", "loop-3", "warning"]],
  // a rank's band, a lane, the people's band
  ["surface-2", ["ink", "ink-2", "ink-3"]],
  // a person's card
  ["gate-soft", ["ink", "ink-2", "gate", "warning"]],
  // a family's count, and a node's state while a run plays
  ["accent-soft", ["accent"]],
  ["ok-soft", ["ok"]],
  ["error-soft", ["error"]],
];

/**
 * One more ground, which is the app's and not the picture's: the map screen fills a handoff's line in the list when
 * it is picked. In a theme the fill is the lanes' ground (apps/web/src/ui/theme/themes.ts); in Paper it is the
 * site's soft accent, which is the picture's. The words on it are the line's: who, what, and what carries it, in
 * each carrier's color.
 */
const ROW_WORDS: Color[] = ["ink", "ink-2", "ink-3", "accent", "check", "merge", "loop-3", "gate", "loop-1", "error"];
const pairsFor = (name: string): [Color, Color[]][] => [...WORDS_ON, [name === "paper" ? "accent-soft" : "surface-2", ROW_WORDS]];

/** The figures the handback and docs/themes.md quote: each theme's least contrast in each form, and where it is. */
export function contrastFigures(): { theme: string; form: "light" | "dark"; least: number; words: Color; on: Color }[] {
  const out = [];
  for (const name of PICTURE_THEMES) {
    for (const form of ["light", "dark"] as const) {
      const color = colorsOf(name, form);
      let worst = { least: Infinity, words: "ink" as Color, on: "bg" as Color };
      for (const [on, list] of pairsFor(name)) for (const words of list) if (contrast(color(words), color(on)) < worst.least) worst = { least: contrast(color(words), color(on)), words, on };
      out.push({ theme: name, form, ...worst });
    }
  }
  return out;
}

test("the five themes' words are at 4.5 to 1 or better on their ground, in light and in dark", () => {
  const short: string[] = [];
  for (const name of FIVE) {
    for (const form of ["light", "dark"] as const) {
      const color = colorsOf(name, form);
      for (const [on, list] of pairsFor(name)) {
        for (const words of list) {
          const ratio = contrast(color(words), color(on));
          if (ratio < 4.5) short.push(`${name}, ${form}: ${words} ${color(words)} on ${on} ${color(on)} is ${ratio.toFixed(2)}`);
        }
      }
    }
  }
  assert.deepEqual(short, []);
  // Paper is not held to it here, because it cannot be changed here: it is today's picture, byte for byte. Some of
  // its pairs are a little short, and the figures say so; they are not hidden. `paperShort` lists them.
  const figures = contrastFigures();
  assert.equal(figures.length, 12);
  for (const row of figures) assert.ok(row.theme === "paper" ? row.least > 3.8 : row.least >= 4.5, `${row.theme} ${row.form}: ${row.least.toFixed(2)}`);
  assert.deepEqual(
    paperShort().map((p) => `${p.form}: ${p.words} on ${p.on}, ${p.ratio.toFixed(2)}`),
    [
      "light: gate on bg, 4.22",
      "light: loop-1 on bg, 4.43",
      "light: gate on gate-soft, 4.14",
      "light: gate on accent-soft, 3.90",
      "light: loop-1 on accent-soft, 4.09",
      "dark: merge on accent-soft, 4.37",
      "dark: loop-3 on accent-soft, 4.38",
    ],
  );
});

/** Paper's pairs under 4.5 to 1, as they are on `main`: in the picture, in an embed's marks, and in a picked line of the map screen's list. */
export function paperShort(): { form: "light" | "dark"; words: Color; on: Color; ratio: number }[] {
  const out = [];
  for (const form of ["light", "dark"] as const) {
    const color = inkFor(form);
    for (const [on, list] of pairsFor("paper")) for (const words of list) if (contrast(color(words), color(on)) < 4.5) out.push({ form, words, on, ratio: contrast(color(words), color(on)) });
  }
  return out;
}

test("with one ink, weight and words say what color said: a gate, a stop, a loop's edge and a person are told apart in Ink", () => {
  for (const form of ["light", "dark"] as const) {
    assert.equal(new Set(["accent", "gate", "check", "merge", "stop", "error", "ok", "loop-0", "loop-3"].map((c) => colorsOf("ink", form)(c as Color))).size, 1, "Ink is one ink");
  }
  const svg = themed(picture(parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!), "ink", "light");
  // The picture says each kind in words, a gate's card has the heavier outline, a stop's the rounder corners, a
  // loop's back edge is dashed and labeled: none of it is the theme's, so none of it is lost with the colors.
  for (const kind of ["Agent", "Human gate", "Stop"]) assert.ok(svg.includes(`>${kind}</text>`), kind);
  assert.match(svg, /<rect data-card=""[^>]* rx="9" stroke-width="1.8"/);
  assert.match(svg, /<rect data-card=""[^>]* rx="16" stroke-width="1"/);
  assert.match(svg, /<path [^>]*stroke-dasharray="5 3"/);
  assert.ok(svg.includes(">fail</text>"));
  // And the theme makes the two that color carried alone heavier still.
  const rules = head("ink", "light");
  assert.match(rules, /rect\[data-card\]\[stroke-width="1\.8"\]\{stroke-width:3\}/);
  assert.match(rules, /rect\[data-card\]\[stroke-width="1\.4"\]\{stroke-width:2\.4\}/);
  assert.match(rules, /\[data-edge\] path\[stroke-width="2"\]\{stroke-width:2\.4\}/);
});

// ─── the rules and the frame ──────────────────────────────────────────────

test("every rule of every theme selects something the pictures carry, and is written for this picture only", () => {
  const all = everyPicture().map(([, draw]) => draw({ theme: "light" })).join("");
  for (const name of FIVE) {
    for (const form of FORMS) {
      const frame = head(name, form);
      const css = /<style>(.*?)<\/style>/.exec(frame)![1]!;
      // Every selector starts at the picture in this theme: inline in a page, a rule reaches nothing else.
      // A rule may sit inside a condition (dark, or a property the renderer must know): it is read as the rule it holds.
      const selectors = css
        .replace(/@(?:media|supports) \([^)]*\)\{((?:[^{}]*\{[^{}]*\})+)\}/g, "$1")
        .split("}")
        .map((rule) => rule.split("{")[0]!)
        .filter(Boolean)
        .flatMap((list) => list.split(/,(?![^\[]*\])/));
      assert.ok(selectors.length >= 3, `${name}: ${selectors.length} selectors`);
      for (const selector of selectors) assert.ok(selector.startsWith(`.grooph-picture[data-look="${name}"]`), `${name}, ${form}: "${selector}" is not kept to this theme's pictures`);
      // And every hook it names is one the drawing code writes.
      for (const [, attribute, value] of css.matchAll(/\[([a-z-]+)(?:="([^"]*)")?\]/g)) {
        if (attribute === "data-look" || attribute === "data-theme" || attribute === "style") continue;
        const written = value === undefined ? ` ${attribute}=` : ` ${attribute}="${value}"`;
        assert.ok(all.includes(written), `${name}: a rule selects [${attribute}${value === undefined ? "" : `="${value}"`}], which no picture carries`);
      }
      assert.ok(!/[<&]/.test(css), `${name}: the style has a character that would end it`);
      assert.ok(!/url\(\s*["']?(?!#)/.test(frame) && !/https?:|@import|@font-face/.test(frame), `${name}: a theme asks for something outside the picture`);
    }
  }
});

test("a theme's recoloring finds the color it replaces, in each form", () => {
  // Transit draws the plain edges in its route's color. Their own color is written on them, so the rule names it.
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  for (const form of FORMS) {
    const svg = themed(picture(doc), "transit", form);
    const plain = form === "auto" ? "var(--gp-ink-2)" : themeParts("transit", form)!.colors["ink-2"];
    assert.ok(svg.includes(`[data-edge] [style="stroke:${plain}"]`), `${form}: the rule`);
    assert.match(svg, new RegExp(`<g data-edge="[^"]+"><path [^>]*style="stroke:${plain.replace(/[()]/g, "\\$&")}"/>`), `${form}: an edge it applies to`);
  }
});

test("in a fixed-width face no full line of the repository's prose leaves its box: Phosphor's sizes and Blueprint's are sound, not lucky", () => {
  // Core lays every line out for a face that sets letters by their own widths, a little wide. A fixed-width face
  // sets a line of narrow letters wider still, and nothing in a theme can lay the line out again. So the two
  // themes that use one draw those lines smaller and closer, by amounts chosen by measuring. This is the measure:
  // every long string in the templates, the fixtures and the sample maps, wrapped as a picture wraps it at each
  // size, in the rooms a card or the page gives it, and set in the widest fixed-width face a picture is likely to
  // meet (the site's own, 0.632 em to the letter; a device's is 0.60 to 0.62).
  const ADVANCE = 0.632;
  const prose: string[] = [];
  const gather = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.length >= 40 && /\s/.test(value)) prose.push(value.replace(/\s+/g, " "));
    } else if (value && typeof value === "object") for (const inner of Object.values(value)) gather(inner);
  };
  for (const [, doc] of graphs()) gather(doc);
  for (const [, map] of maps()) gather(map);
  assert.ok(prose.length > 400, `only ${prose.length} pieces of prose`);
  // [what, the size core lays it out at, its weight, the rooms it is wrapped to, units from the room's end to the box's edge]
  const LINES: [string, number, "bold" | "regular", number[], number][] = [
    ["a title", 17, "bold", [376], 11],
    ["a card's name", 13.5, "bold", [356, 315, 170, 120], 9],
    ["a lane's name", 12.5, "bold", [356, 170], 9],
    ["who hands to whom", 12, "bold", [352], 11],
    ["a carrier", 11, "bold", [328], 11],
    ["what runs a session", 10.5, "bold", [315, 170, 120], 9],
    ["a schedule", 10, "bold", [300, 157], 9],
    ["a goal", 11.5, "regular", [376], 11],
    ["a role, a loop's lines, what is handed", 11, "regular", [360, 352, 315, 170, 120], 9],
    ["a card's small line", 10.5, "regular", [356, 315, 170], 9],
    ["a session's last line", 10, "regular", [315, 170, 120], 9],
  ];
  const past = (size0: number, weight: "bold" | "regular", rooms: number[], grace: number, size: number, tracking: number): { lines: number; past: number } => {
    let [lines, over] = [0, 0];
    for (const room of rooms) {
      for (const piece of prose) {
        for (const line of wrap(piece, room, size0, 99, weight).slice(0, -1)) {
          lines++;
          if (line.length * (ADVANCE + tracking) * size > room + grace) over++;
        }
      }
    }
    return { lines, past: over };
  };

  // Phosphor: every line. The size each is drawn at, and how much closer its letters are, read from the theme's own rules.
  const phosphor = head("phosphor", "light");
  const tracking = Number(/data-look="phosphor"\] text\{letter-spacing:(-?[\d.]+)em\}/.exec(phosphor)![1]);
  assert.ok(tracking < 0 && tracking >= -0.06, `letters ${tracking} em closer: closer than that and a fixed-width face's letters touch`);
  const sizeOf = (size0: number, weight: "bold" | "regular"): number => {
    const rule = (bold: boolean): string | undefined => new RegExp(`text\\[font-size="${String(size0).replace(".", "\\.")}"\\]${bold ? '\\[font-weight="700"\\]' : ""}\\{font-size:([\\d.]+)px\\}`).exec(phosphor)?.[1];
    return Number((weight === "bold" ? rule(true) : undefined) ?? rule(false) ?? size0);
  };
  let total = 0;
  for (const [what, size0, weight, rooms, grace] of LINES) {
    const size = sizeOf(size0, weight);
    assert.ok(size < size0 && size >= size0 * 0.78, `${what}: drawn at ${size}, from ${size0}`);
    const found = past(size0, weight, rooms, grace, size, tracking);
    assert.equal(found.past, 0, `Phosphor, ${what}: ${found.past} of ${found.lines} full lines run past their box at ${size} px`);
    total += found.lines;
  }
  assert.ok(total > 20_000, `only ${total} lines were measured`);
  // And the sizes are not smaller than they need to be by much: a quarter of a unit larger, and the regular lines no longer all fit.
  assert.ok(past(10.5, "regular", [356, 315, 170], 9, sizeOf(10.5, "regular") + 0.5, tracking).past > 0, "a card's small line would fit half a unit larger: the size can go up");

  // Blueprint: its fixed-width lines are a card's small line and a lane's, at one size.
  const blueprint = head("blueprint", "light");
  const small = /\[data-node\]>text\[font-size="10\.5"\],[^{]*\{font-family:[^;]*;font-size:([\d.]+)px;letter-spacing:(-?[\d.]+)em\}/.exec(blueprint)!;
  assert.equal(past(10.5, "regular", [356, 315, 170], 9, Number(small[1]), Number(small[2])).past, 0, "Blueprint, a card's small line");
  // Its title is in capitals, which are wider than what was measured in any face: held against the widest face core measures for.
  const title = /text\[font-size="17"\]\{text-transform:uppercase;letter-spacing:([\d.]+)em;font-size:([\d.]+)px\}/.exec(blueprint)!;
  let cut = 0;
  for (const piece of prose) for (const line of wrap(piece, 376, 17, 99, "bold").slice(0, -1)) if (textWidth(line.toUpperCase(), Number(title[2]), "bold") + line.length * Number(title[1]) * Number(title[2]) > 376 + 11) cut++;
  assert.equal(cut, 0, "Blueprint, a title in capitals");
});

test("a rule a PNG's renderer would get wrong is kept from it: Transit's arrowheads grow only where their own middle can be named", () => {
  // The CLI draws a PNG with a renderer that knows `transform` and not `transform-box`: given the rule bare, it
  // scales each arrowhead about the picture's corner and moves it across the picture. A condition it does not read
  // keeps the rule from it, and a browser, which knows both, applies it.
  for (const form of FORMS) {
    const frame = head("transit", form);
    const guarded = /@supports \(transform-box:fill-box\)\{[^{}]*\{[^{}]*\}\}/.exec(frame);
    assert.ok(guarded, `${form}: no guarded rule`);
    assert.ok(guarded[0].includes("transform:scale("));
    assert.ok(!/[;{]transform(?:-box|-origin)?:/.test(frame.replace(guarded[0], "")), `${form}: a transform outside the condition`);
  }
  for (const name of ["blueprint", "ink", "phosphor", "chalk"]) assert.ok(!/[;{]transform(?:-box|-origin)?:/.test(head(name, "light")), name);
});

test("a rule for a card's own lines does not reach a mark a page adds inside the card", () => {
  // An embed writes a node's state into its card while a run plays, as a small line of words in a group of its own.
  // A node's kind and its lines are children of the node; the rules for them say so, and pass the mark by.
  for (const name of FIVE) assert.ok(!/\[data-node\] text\[font-size="(?:9\.5|10\.5)"\]/.test(head(name, "light")), `${name}: a rule for any text of that size inside a node`);
  assert.match(head("blueprint", "light"), /\[data-node\]>text\[font-size="9\.5"\]\{[^}]*text-transform:uppercase/);
  // And a family's count keeps its pill where the cards' corners change: only the card and the two edges behind it are named.
  assert.match(head("ink", "light"), /\[data-session\]>rect\[data-card\],[^{]*\[data-session\]>rect\[rx="9"\]\{rx:2px/);
});

test("a ground and its pattern share an id that says the form, so two forms in one page each keep their own", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  for (const name of ["blueprint", "phosphor"]) {
    const ids = FORMS.map((form) => {
      const svg = themed(picture(doc), name, form);
      const id = /<pattern id="([^"]+)"/.exec(svg)![1]!;
      assert.ok(svg.includes(`<rect width="100%" height="100%" fill="url(#${id})"/>`), `${name}, ${form}: the ground does not name its pattern`);
      // The ground is the second thing drawn: over the background, under every card and line.
      assert.match(svg, /<\/defs><rect x="0" y="0" [^>]*\/><rect width="100%" height="100%" fill="url\(#/, `${name}, ${form}`);
      return id;
    });
    assert.equal(new Set(ids).size, 3, `${name}: ${ids.join(", ")}`);
  }
  for (const name of ["ink", "transit", "chalk"]) assert.ok(!themed(picture(doc), name).includes("<pattern"), name);
});

test("a theme with one form is the same picture in light and in dark", () => {
  assert.equal(THEME_VALUES.phosphor.light, THEME_VALUES.phosphor.dark);
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const auto = themed(picture(doc), "phosphor");
  assert.ok(!auto.includes("prefers-color-scheme"), "a picture with one form does not ask which the viewer prefers");
  assert.equal(themed(picture(doc), "phosphor", "light").replaceAll("gp-phosphor-light", "x"), themed(picture(doc), "phosphor", "dark").replaceAll("gp-phosphor-dark", "x"));
  for (const name of ["blueprint", "ink", "transit", "chalk"] as const) assert.notEqual(THEME_VALUES[name].light, THEME_VALUES[name].dark, name);
});

test("the six pictures docs/themes.md shows are what the code draws", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const page = read(join(repoRoot, "docs", "themes.md"));
  for (const name of PICTURE_THEMES) {
    const path = `handoffs/0086-themes/pictures/review-loop.${name}.svg`;
    assert.equal(read(join(repoRoot, path)), themed(picture(doc), name), `${path} is stale: grooph image fixtures/valid/review-loop.grooph.json --theme ${name} --out ${path}`);
    assert.ok(page.includes(`<img src="../${path}"`), `docs/themes.md does not show ${name}`);
  }
});

test("an offline page takes a theme as a picture does: its picture in the theme, and every other byte the page it was", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const plain = offlinePage(doc, { version: "0.0.0" });
  assert.equal(themedPage(plain, "paper"), plain);
  assert.equal(themedPage(plain, "sepia"), plain);
  const chalk = themedPage(plain, "chalk");
  assert.ok(chalk.includes('data-look="chalk"') && chalk.includes('<filter id="gp-chalk">'));
  // Its picture is the one `themed` makes, and everything else is untouched.
  const svg = /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" class="grooph-picture".*?<\/svg>/s;
  assert.equal(svg.exec(chalk)![0], themed(picture(doc), "chalk").trimEnd());
  assert.equal(chalk.replace(svg, ""), plain.replace(svg, ""));
  // A map's page too.
  const map = maps()[0]![1];
  assert.equal(svg.exec(themedPage(offlinePage(map, { version: "0.0.0" }), "ink"))![0], themed(mapPicture(map), "ink").trimEnd());
});

test("the themes are behind a door of their own: core's first door does not lead to them, and they import nothing", () => {
  // The web app starts from base.ts and a bundler follows every import (decision 0021): an address that shows
  // only Paper would carry the five if any file base.ts reaches imported them.
  const src = join(repoRoot, "packages", "core", "src");
  const runtimeImports = (file: string): string[] => [...read(file).matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+"(\.[^"]+)\.js"/gms)].map((m) => join(file, "..", `${m[1]}.ts`));
  const reached = new Set<string>();
  const follow = (file: string): void => {
    if (reached.has(file)) return;
    reached.add(file);
    for (const next of runtimeImports(file)) follow(next);
  };
  follow(join(src, "base.ts"));
  assert.ok(reached.size > 20 && reached.has(join(src, "picture", "svg.ts")), "base.ts was not followed");
  assert.ok(!reached.has(join(src, "picture", "themes.ts")), "base.ts leads to picture/themes.ts");
  // Nothing shared with the rest of core, so fetching the themes moves no other file (map-kit.ts says what happens otherwise).
  assert.deepEqual(runtimeImports(join(src, "picture", "themes.ts")), []);
  // Nothing on base's side names a theme, and none of it was changed for them: a theme is added to a picture after
  // it is drawn. (Ink shares its name with a color, so it is not looked for.)
  for (const file of reached) for (const name of FIVE) assert.ok(name === "ink" || !new RegExp(`["'\`]${name}["'\`]`).test(read(file)), `${file.slice(src.length + 1)} names the theme ${name}`);
  assert.equal(Object.keys(THEME_VALUES).join(), FIVE.join());
});
