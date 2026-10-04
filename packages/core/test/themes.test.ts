/**
 * The picture's themes (handoff 0086; docs/themes.md): six looks for one picture. Paper is the picture as it was,
 * byte for byte. The other five change values and nothing else: the markup, the geometry, the words and the
 * accessible name are Paper's. Each is held to 4.5 to 1 for its words, in light and in dark, and each of its rules
 * to a hook the pictures really carry.
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
import { mapPicture } from "../src/picture/map-picture.js";
import { inkFor, type Color, type PictureLook, type PictureOptions, type PictureTheme } from "../src/picture/svg.js";
import { PICTURE_THEMES, THEME_VALUES, isPictureTheme, pictureLook } from "../src/picture/themes.js";
import type { Graph, OperationMap } from "../src/types.js";
import { fixturesDir, read, repoRoot, validFixtures } from "./helpers.js";

const FORMS: PictureTheme[] = ["auto", "light", "dark"];
const FIVE = PICTURE_THEMES.filter((name) => name !== "paper");
const looks = (): PictureLook[] => FIVE.map((name) => pictureLook(name)!);

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
  ...maps().flatMap(([name, map]): [string, (o: PictureOptions) => string][] => [
    [`${name}, the phone's`, (o) => mapPicture(map, o)],
    [`${name}, lanes side by side`, (o) => mapWide(map, o)],
    [`${name}, the sequence`, (o) => mapSequence(map, o)],
  ]),
];

/** What a theme puts in the frame, taken back out: the look's name, its style and defs, and its ground. */
const bare = (svg: string): string =>
  svg
    .replace(/ data-look="[a-z]+"/, "")
    .replace(/<style>.*?<\/style>(?:<defs>.*?<\/defs>)?/, "")
    .replace(/<rect width="100%" height="100%" fill="url\(#gp-[a-z-]+\)"\/>/, "");

test("Paper is the picture as it was: no theme, Paper by name and a name that is none of the six all draw the same bytes", () => {
  assert.deepEqual([...PICTURE_THEMES], ["paper", "blueprint", "ink", "phosphor", "transit", "chalk"]);
  for (const name of [undefined, "paper", "sepia", "constructor", "toString", "", "Blueprint"]) assert.equal(pictureLook(name), undefined, `pictureLook(${JSON.stringify(name)})`);
  assert.ok(isPictureTheme("paper") && isPictureTheme("chalk") && !isPictureTheme("constructor"));
  for (const [name, draw] of everyPicture()) {
    for (const theme of FORMS) {
      const plain = draw({ theme });
      assert.equal(draw({ theme, ...(pictureLook("paper") ? { look: pictureLook("paper")! } : {}) }), plain, `${name}, ${theme}`);
      assert.ok(!plain.includes("data-look") && !plain.includes("<defs>"), `${name}, ${theme}: the default picture carries something of a theme`);
    }
  }
});

test("a theme is a set of values: in all six the markup, the geometry and the words are the same", () => {
  let drawn = 0;
  for (const [name, draw] of everyPicture()) {
    const paper = bare(draw({ theme: "auto" }));
    const words = (svg: string): string[] => [...svg.matchAll(/<(?:text|title)[^>]*>([^<]*)</g)].map((m) => m[1]!);
    for (const look of looks()) {
      const themed = draw({ theme: "auto", look });
      assert.match(themed, new RegExp(`^<svg [^>]*data-look="${look.name}"`), name);
      // The picture that follows the viewer: take out what the theme put in the frame, and it is Paper's.
      assert.equal(bare(themed), paper, `${name} in ${look.name}: the picture itself differs from Paper's`);
      assert.deepEqual(words(themed), words(draw({ theme: "auto" })), `${name} in ${look.name}: the words differ`);
      assert.equal(themed, draw({ theme: "auto", look }), `${name} in ${look.name}: not the same bytes twice`);
      // A picture in one form is that same picture with each color written in.
      for (const form of ["light", "dark"] as const) {
        const fixed = draw({ theme: form, look });
        const written = bare(themed).replace(/var\(--gp-([a-z0-9-]+)\)/g, (_, color: Color) => look[form][color]);
        assert.equal(bare(fixed), written, `${name} in ${look.name}, ${form}`);
        assert.ok(!fixed.includes("var(--") && !fixed.includes("prefers-color-scheme"), `${name} in ${look.name}, ${form}: a picture in one form carries its colors`);
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
 * and a map's pictures, a map's other two views, and the marks an embed adds while a run plays.
 */
// prettier-ignore
const WORDS_ON: [Color, Color[]][] = [
  // the page: titles, captions, goals, the loops, the handoffs' list, a label's pill (its words are the edge's color)
  ["bg", ["ink", "ink-2", "ink-3", "gate", "warning", "loop-0", "loop-1", "loop-2", "loop-3", "accent", "check", "merge", "error"]],
  // a card: a node's kind, its name and lines; a session's harness, role, schedule, graph and what the hooks saw
  ["surface", ["ink", "ink-2", "ink-3", "accent", "gate", "check", "merge", "stop", "loop-0", "warning"]],
  // a rank's band, a lane, the people's band
  ["surface-2", ["ink", "ink-2", "ink-3"]],
  // a person's card
  ["gate-soft", ["ink", "ink-2", "gate"]],
  // a family's count, and a node's state while a run plays
  ["accent-soft", ["accent"]],
  ["ok-soft", ["ok"]],
  ["error-soft", ["error"]],
];

/** The figures the handback and docs/themes.md quote: each theme's least contrast in each form, and where it is. */
export function contrastFigures(): { theme: string; form: "light" | "dark"; least: number; words: Color; on: Color }[] {
  const out = [];
  for (const name of PICTURE_THEMES) {
    for (const form of ["light", "dark"] as const) {
      const color = inkFor(form, pictureLook(name));
      let worst = { least: Infinity, words: "ink" as Color, on: "bg" as Color };
      for (const [on, list] of WORDS_ON) for (const words of list) if (contrast(color(words), color(on)) < worst.least) worst = { least: contrast(color(words), color(on)), words, on };
      out.push({ theme: name, form, ...worst });
    }
  }
  return out;
}

test("the five themes' words are at 4.5 to 1 or better on their ground, in light and in dark", () => {
  const short: string[] = [];
  for (const name of FIVE) {
    for (const form of ["light", "dark"] as const) {
      const color = inkFor(form, pictureLook(name));
      for (const [on, list] of WORDS_ON) {
        for (const words of list) {
          const ratio = contrast(color(words), color(on));
          if (ratio < 4.5) short.push(`${name}, ${form}: ${words} ${color(words)} on ${on} ${color(on)} is ${ratio.toFixed(2)}`);
        }
      }
    }
  }
  assert.deepEqual(short, []);
  // Paper is not held to it here, because it cannot be changed here: it is today's picture, byte for byte, and in
  // light three of its pairs are a little short (an approval's label and a person's carrier on the page, a loop's
  // second color on the page, a halted node's mark in an embed). The figures say so; they are not hidden.
  const figures = contrastFigures();
  assert.equal(figures.length, 12);
  for (const row of figures) assert.ok(row.theme === "paper" ? row.least > 4.1 : row.least >= 4.5, `${row.theme} ${row.form}: ${row.least.toFixed(2)}`);
  assert.equal(figures.find((row) => row.theme === "paper" && row.form === "light")!.least.toFixed(2), "4.14");
});

test("with one ink, weight and words say what color said: a gate, a stop, a loop's edge and a person are told apart in Ink", () => {
  const ink = pictureLook("ink")!;
  for (const form of ["light", "dark"] as const) {
    assert.equal(new Set(["accent", "gate", "check", "merge", "stop", "error", "ok", "loop-0", "loop-3"].map((c) => ink[form][c as Color])).size, 1, "Ink is one ink");
  }
  const svg = picture(parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!, { theme: "light", look: ink });
  // The picture says each kind in words, a gate's card has the heavier outline, a stop's the rounder corners, a
  // loop's back edge is dashed and labeled: none of it is the theme's, so none of it is lost with the colors.
  for (const kind of ["Agent", "Human gate", "Stop"]) assert.ok(svg.includes(`>${kind}</text>`), kind);
  assert.match(svg, /<rect data-card=""[^>]* rx="9" stroke-width="1.8"/);
  assert.match(svg, /<rect data-card=""[^>]* rx="16" stroke-width="1"/);
  assert.match(svg, /<path [^>]*stroke-dasharray="5 3"/);
  assert.ok(svg.includes(">fail</text>"));
  // And the theme makes the two that color carried alone heavier still.
  const head = ink.head("light");
  assert.match(head, /rect\[data-card\]\[stroke-width="1\.8"\]\{stroke-width:3\}/);
  assert.match(head, /rect\[data-card\]\[stroke-width="1\.4"\]\{stroke-width:2\.4\}/);
  assert.match(head, /\[data-edge\] path\[stroke-width="2"\]\{stroke-width:2\.4\}/);
});

// ─── the rules and the frame ──────────────────────────────────────────────

test("every rule of every theme selects something the pictures carry, and is written for this picture only", () => {
  const all = everyPicture().map(([, draw]) => draw({ theme: "light" })).join("");
  for (const look of looks()) {
    for (const form of FORMS) {
      const head = look.head(form);
      const css = /<style>(.*?)<\/style>/.exec(head)![1]!;
      // Every selector starts at the picture in this theme: inline in a page, a rule reaches nothing else.
      const selectors = css
        .replace(/@media \(prefers-color-scheme:dark\)\{([^{}]*\{[^{}]*\})\}/g, "$1")
        .split("}")
        .map((rule) => rule.split("{")[0]!)
        .filter(Boolean)
        .flatMap((list) => list.split(/,(?![^\[]*\])/));
      assert.ok(selectors.length >= 3, `${look.name}: ${selectors.length} selectors`);
      for (const selector of selectors) assert.ok(selector.startsWith(`.grooph-picture[data-look="${look.name}"]`), `${look.name}, ${form}: "${selector}" is not kept to this theme's pictures`);
      // And every hook it names is one the drawing code writes.
      for (const [, attribute, value] of css.matchAll(/\[([a-z-]+)(?:="([^"]*)")?\]/g)) {
        if (attribute === "data-look" || attribute === "data-theme" || attribute === "style") continue;
        const written = value === undefined ? ` ${attribute}=` : ` ${attribute}="${value}"`;
        assert.ok(all.includes(written), `${look.name}: a rule selects [${attribute}${value === undefined ? "" : `="${value}"`}], which no picture carries`);
      }
      assert.ok(!/[<&]/.test(css), `${look.name}: the style has a character that would end it`);
      assert.ok(!/url\(\s*["']?(?!#)/.test(head) && !/https?:|@import|@font-face/.test(head), `${look.name}: a theme asks for something outside the picture`);
    }
  }
});

test("a theme's recoloring finds the color it replaces, in each form", () => {
  // Transit draws the plain edges in its route's color. Their own color is written on them, so the rule names it.
  const transit = pictureLook("transit")!;
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  for (const form of FORMS) {
    const svg = picture(doc, { theme: form, look: transit });
    const plain = form === "auto" ? "var(--gp-ink-2)" : transit[form]["ink-2"];
    assert.ok(svg.includes(`[data-edge] [style="stroke:${plain}"]`), `${form}: the rule`);
    assert.match(svg, new RegExp(`<g data-edge="[^"]+"><path [^>]*style="stroke:${plain.replace(/[()]/g, "\\$&")}"/>`), `${form}: an edge it applies to`);
  }
});

test("a ground and its pattern share an id that says the form, so two forms in one page each keep their own", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  for (const name of ["blueprint", "phosphor"]) {
    const ids = FORMS.map((form) => {
      const svg = picture(doc, { theme: form, look: pictureLook(name)! });
      const id = /<pattern id="([^"]+)"/.exec(svg)![1]!;
      assert.ok(svg.includes(`<rect width="100%" height="100%" fill="url(#${id})"/>`), `${name}, ${form}: the ground does not name its pattern`);
      // The ground is the second thing drawn: over the background, under every card and line.
      assert.match(svg, /<\/defs><rect x="0" y="0" [^>]*\/><rect width="100%" height="100%" fill="url\(#/, `${name}, ${form}`);
      return id;
    });
    assert.equal(new Set(ids).size, 3, `${name}: ${ids.join(", ")}`);
  }
  for (const name of ["ink", "transit", "chalk"]) assert.ok(!picture(doc, { look: pictureLook(name)! }).includes("<pattern"), name);
});

test("a theme with one form is the same picture in light and in dark", () => {
  const phosphor = pictureLook("phosphor")!;
  assert.equal(phosphor.light, phosphor.dark);
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const auto = picture(doc, { look: phosphor });
  assert.ok(!auto.includes("prefers-color-scheme"), "a picture with one form does not ask which the viewer prefers");
  assert.equal(picture(doc, { theme: "light", look: phosphor }).replaceAll("gp-phosphor-light", "x"), picture(doc, { theme: "dark", look: phosphor }).replaceAll("gp-phosphor-dark", "x"));
  for (const name of ["blueprint", "ink", "transit", "chalk"]) assert.notEqual(pictureLook(name)!.light, pictureLook(name)!.dark, name);
});

test("the six pictures docs/themes.md shows are what the code draws", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const page = read(join(repoRoot, "docs", "themes.md"));
  for (const name of PICTURE_THEMES) {
    const path = `handoffs/0086-themes/pictures/review-loop.${name}.svg`;
    const look = pictureLook(name);
    assert.equal(read(join(repoRoot, path)), picture(doc, look ? { look } : {}), `${path} is stale: grooph image fixtures/valid/review-loop.grooph.json --theme ${name} --out ${path}`);
    assert.ok(page.includes(`<img src="../${path}"`), `docs/themes.md does not show ${name}`);
  }
});

test("the offline page draws its picture in the theme it is given, and is today's page without one", () => {
  const doc = parseGraphText(read(join(fixturesDir, "valid", "review-loop.grooph.json"))).doc!;
  const plain = offlinePage(doc, { version: "0.0.0" });
  assert.ok(!plain.includes("data-look"));
  const themed = offlinePage(doc, { version: "0.0.0", look: pictureLook("chalk")! });
  assert.ok(themed.includes('data-look="chalk"') && themed.includes('<filter id="gp-chalk">'));
  // Everything but the picture is the page as it was.
  assert.equal(themed.replace(/<svg .*?<\/svg>/s, ""), plain.replace(/<svg .*?<\/svg>/s, ""));
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
  // Nothing on base's side names a theme: the frame is handed a look and knows none of the six. (Ink shares its
  // name with a color, so it is not looked for.)
  for (const file of reached) for (const name of FIVE) assert.ok(name === "ink" || !new RegExp(`["'\`]${name}["'\`]`).test(read(file)), `${file.slice(src.length + 1)} names the theme ${name}`);
  assert.equal(Object.keys(THEME_VALUES).join(), FIVE.join());
});
