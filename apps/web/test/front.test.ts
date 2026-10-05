import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { glyph, instantiate, parseGraphText, picture, type Graph } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { BUILT_IN_TEMPLATES } from "../src/doc/builtins.js";
import { BUILT_IN_CREDITS } from "../src/doc/credits.generated.js";
import { builtIns, builtInTemplate, loadBuiltIns } from "../src/doc/templates.js";
import { hasLongGlyph } from "../src/ui/Glyph.js";
import { HERO, HERO_SVG, TILES } from "../src/ui/landing/front.js";
import { repoRoot } from "./helpers.js";

const pattern = (id: string): Graph => parseGraphText(readFileSync(join(repoRoot, "patterns", `${id}.grooph.json`), "utf8")).doc!;
const STALE = "run `node scripts/front-page.mjs` (after `pnpm -r build`) and commit what it writes";

/**
 * Slice 0093: the twenty built-in templates are a piece of the app fetched when a screen needs them, and the front
 * page carries its one picture and six glyphs as they were drawn when the app was built. These hold the two files
 * that were written then to what the code draws now, and the templates out of the first load.
 */
describe("the front page without the templates (slice 0093)", () => {
  it("draws the picture the code draws from the review gate, byte for byte", () => {
    // What the front page did when it drew the picture itself: the template's own examples in its slots.
    const template = pattern(HERO);
    expect(HERO).toBe("review-gate");
    const values = Object.fromEntries((template.template?.slots ?? []).map((slot) => [slot.key, slot.example ?? ""]).filter(([, v]) => v !== ""));
    values["task"] = "Add a slugify(text) function to src/strings.ts.";
    const drawn = picture(instantiate(template, { name: "Add slugify, reviewed", values }), { theme: "auto" });
    expect(HERO_SVG === drawn, `the front page's picture is not what the code draws: ${STALE}`).toBe(true);
    expect(HERO_SVG).toContain('class="grooph-picture"');
    expect(HERO_SVG).toContain("Add slugify, reviewed");
  });

  it("shows the six tiles the code draws: each template's title and glyph, and whether the glyph is a long one", () => {
    expect(TILES.map((tile) => tile.id)).toEqual(["grind-loop", "spec-then-loop", "metric-sandwich", "heterogeneous-critic", "tournament-then-judge", "patrol-pulse"]);
    for (const tile of TILES) {
      const doc = pattern(tile.id);
      expect({ ...tile }, `${tile.id}: ${STALE}`).toEqual({ id: doc.id, title: doc.template!.title, glyph: glyph(doc), long: hasLongGlyph(doc) });
    }
  });

  it("credits whom the built-in templates credit, for a card that does not wait for them", () => {
    const credited = Object.fromEntries(BUILT_IN_TEMPLATES.filter((doc) => (doc.template?.credits ?? []).length > 0).map((doc) => [doc.id, doc.template!.credits]));
    expect(Object.keys(credited).length).toBeGreaterThan(3);
    expect(BUILT_IN_CREDITS, STALE).toEqual(credited);
  });

  it("is what the generator writes: neither file was edited by hand or left behind", () => {
    // The generator's own check, when core is built for it to draw with (it is after `pnpm -r build`, as in CI).
    if (!existsSync(join(repoRoot, "packages/core/dist/src/base.js"))) return;
    expect(execFileSync(process.execPath, [join(repoRoot, "scripts/front-page.mjs"), "--check"], { encoding: "utf8" })).toContain("both files are current");
  });

  it("the piece holds every pattern in patterns/, and the door hands them over once it has been asked", async () => {
    const files = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json"));
    expect(BUILT_IN_TEMPLATES).toHaveLength(files.length);
    expect(await loadBuiltIns()).toBe(BUILT_IN_TEMPLATES);
    expect(builtIns()).toBe(BUILT_IN_TEMPLATES);
    expect(builtInTemplate("review-gate")?.template?.title).toBe(pattern("review-gate").template!.title);
    expect(builtInTemplate("no-such-template")).toBeUndefined();
  });

  it("keeps the templates out of the first load: nothing the app starts with reaches them, or reads patterns/", () => {
    // What every address loads first is whatever the entry reaches without waiting: every import that is not an
    // `import()`. Followed from the entry, file by file (as test/look.test.ts follows it for the themes).
    const root = join(repoRoot, "apps/web/src");
    const first = new Set<string>();
    const follow = (file: string): void => {
      if (first.has(file)) return;
      first.add(file);
      for (const [, to] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)(?:[^;]*?\sfrom\s+)?"([^"]+)";/gm)) {
        if (!to!.startsWith(".")) continue;
        const base = join(dirname(file), to!.replace(/\.js$/, ""));
        const found = [`${base}.ts`, `${base}.tsx`].find((path) => existsSync(path));
        if (found) follow(found);
      }
    };
    follow(join(root, "main.tsx"));
    follow(join(root, "App.tsx"));
    const reached = [...first].map((file) => file.slice(root.length + 1));
    for (const file of ["ui/landing/Landing.tsx", "ui/templates/TemplatesScreen.tsx", "doc/templates.ts", "ui/Library.tsx"]) expect(reached, `the walk did not reach ${file}`).toContain(file);
    expect(reached, "the built-in templates are in the first load").not.toContain("doc/builtins.ts");
    // Nor the front page's own picture, which only the front page's address asks for (beside the app, by name).
    for (const file of ["ui/landing/front.ts", "ui/landing/front.generated.ts"]) expect(reached, `${file} is carried by every address`).not.toContain(file);
    for (const file of first) expect(/patterns\/\*|import\.meta\.glob/.test(readFileSync(file, "utf8")), `${file.slice(root.length + 1)} bundles files of its own`).toBe(false);
    // The canvas's screens do not carry them either: the Insert panel and a template's screens ask at the door.
    const canvas = new Set<string>();
    const further = (file: string): void => {
      if (canvas.has(file) || first.has(file)) return;
      canvas.add(file);
      for (const [, to] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)(?:[^;]*?\sfrom\s+)?"([^"]+)";/gm)) {
        if (!to!.startsWith(".")) continue;
        const base = join(dirname(file), to!.replace(/\.js$/, ""));
        const found = [`${base}.ts`, `${base}.tsx`].find((path) => existsSync(path));
        if (found) further(found);
      }
    };
    further(join(root, "ui/screens.ts"));
    expect(canvas.size).toBeGreaterThan(30);
    expect([...canvas].map((file) => file.slice(root.length + 1))).not.toContain("doc/builtins.ts");
    for (const file of ["ui/landing/front.ts", "ui/landing/front.generated.ts"]) expect([...canvas].map((path) => path.slice(root.length + 1))).not.toContain(file);
    // One place asks for each piece, through `piece()`, by the name the build gives its file.
    expect(readFileSync(join(root, "doc/templates.ts"), "utf8")).toContain('piece("builtins", () => import("./builtins.js"))');
    expect(readFileSync(join(root, "ui/landing/Landing.tsx"), "utf8")).toContain('piece("front", () => import("./front.js"))');
    // The page's own links to its template do not wait for the piece: the id is the generated one.
    expect(readFileSync(join(root, "ui/landing/Landing.tsx"), "utf8")).toContain(`const HERO = "${HERO}";`);
  });
});
