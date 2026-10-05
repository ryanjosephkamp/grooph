import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { PICTURE_THEMES, THEME_VALUES, themed, themedPage } from "@grooph/core/themes";
import { offlinePage, picture } from "@grooph/core";
import { describe, expect, it } from "vitest";

import { openInAppHref, parseEmbedHash } from "../src/ui/embed/link.js";
import { labelOf, lookNamed, lookNow, styles, withoutLook } from "../src/ui/theme/themes.js";
import { repoRoot, reviewLoop } from "./helpers.js";

const src = (path: string): string => readFileSync(join(repoRoot, "apps/web/src", path), "utf8");
const FIVE = PICTURE_THEMES.filter((id) => id !== "paper");

describe("the pictures' themes in the app (handoff 0086)", () => {
  it("offers core's six, by name; Paper has no values, and Keep a copy's files in a theme are core's", () => {
    expect(PICTURE_THEMES.map(labelOf)).toEqual(["Paper", "Blueprint", "Ink", "Phosphor", "Transit", "Chalk"]);
    // With no page there is no address and nothing kept: Paper, in which the files are made as they always were.
    expect(lookNow("#/")).toBe("paper");
    expect(lookNow("#/open?d=abc&theme=chalk")).toBe("chalk");
    // What Keep a copy is handed in a theme is `themed` and `themedPage`, and nothing of its own.
    const doc = reviewLoop();
    const html = offlinePage(doc, { version: "0.0.0" });
    expect(themed(picture(doc), "chalk", "dark")).toContain('data-look="chalk"');
    expect(themedPage(html, "chalk")).not.toBe(html);
  });

  it("reads a theme from a share link's or an embed's address; a name that is none of the six is Paper", () => {
    expect(lookNamed("#/open?d=abc&theme=blueprint")).toBe("blueprint");
    expect(lookNamed("#/embed?d=abc&frame=1&theme=chalk-dark&play=1")).toBe("chalk");
    expect(lookNamed("#/embed?d=abc&theme=transit-light")).toBe("transit");
    expect(lookNamed("#/open?d=abc&theme=paper")).toBe("paper");
    // An unknown name is today's picture, not the reader's own choice and not an error.
    expect(lookNamed("#/open?d=abc&theme=sepia")).toBe("paper");
    expect(lookNamed("#/embed?d=abc&theme=constructor")).toBe("paper");
    // Light and dark alone are an embed's own, as they were before there were themes: no theme is named.
    expect(lookNamed("#/embed?d=abc&theme=dark")).toBeUndefined();
    expect(lookNamed("#/embed?d=abc")).toBeUndefined();
    // Only a share link and an embed take a theme from their address.
    expect(lookNamed("#/g/abc?theme=ink")).toBeUndefined();
    expect(lookNamed("#/templates/built-in/review-gate")).toBeUndefined();
    // An embed is somebody else's page: with no theme named it is Paper, whatever this browser has chosen.
    expect(lookNow("#/embed?d=abc")).toBe("paper");
    expect(lookNow("#/embed?d=abc&theme=ink")).toBe("ink");
    // As `--theme` takes it: `auto` after a name is that theme, and alone is no theme.
    expect(lookNamed("#/embed?d=abc&theme=chalk-auto")).toBe("chalk");
    expect(lookNamed("#/embed?d=abc&theme=auto")).toBeUndefined();
    // The first `theme=` is the one read, here and for an embed's light or dark.
    expect(lookNamed("#/open?theme=ink&d=abc&theme=chalk")).toBe("ink");
    // A name is one of the six, whole: light or dark is said after a hyphen, as `--theme` takes it, and not run on.
    for (const wrong of ["inklight", "chalkdark", "blueprintauto", "ink-", "Ink"]) expect(lookNamed(`#/open?d=abc&theme=${wrong}`), wrong).toBe("paper");
    expect(parseEmbedHash("#/embed?theme=ink-dark&d=abc&theme=chalk-light")).toMatchObject({ theme: "dark", look: "ink" });
  });

  it("an embed's light or dark is read after a theme's name too", () => {
    expect(parseEmbedHash("#/embed?d=abc&theme=dark").theme).toBe("dark");
    expect(parseEmbedHash("#/embed?d=abc&theme=chalk-dark").theme).toBe("dark");
    expect(parseEmbedHash("#/embed?d=abc&theme=blueprint-light").theme).toBe("light");
    expect(parseEmbedHash("#/embed?d=abc&theme=blueprint").theme).toBeUndefined();
    expect(parseEmbedHash("#/embed?d=abc&theme=darker").theme).toBeUndefined();
    expect(parseEmbedHash("#/embed?d=abc").theme).toBeUndefined();
  });

  it("takes a named theme out of an address and leaves the rest as it was", () => {
    expect(withoutLook("#/open?d=abc&theme=transit")).toBe("#/open?d=abc");
    expect(withoutLook("#/open?theme=transit&d=abc&c=lean")).toBe("#/open?d=abc&c=lean");
    expect(withoutLook("#/open?d=abc&theme=ink&c=lean&theme=chalk")).toBe("#/open?d=abc&c=lean");
    expect(withoutLook("#/open?d=abc&theme=chalk-dark&c=lean")).toBe("#/open?d=abc&c=lean");
    expect(withoutLook("#/open?d=abc&theme=sepia")).toBe("#/open?d=abc");
    // Two side by side: both go, or the second would be the theme on the next load.
    expect(withoutLook("#/open?d=abc&theme=ink&theme=chalk")).toBe("#/open?d=abc");
    expect(withoutLook("#/open?theme=ink&theme=chalk&d=abc")).toBe("#/open?d=abc");
    expect(withoutLook("#/open?theme=ink")).toBe("#/open");
    // Nothing named, nothing changed.
    for (const hash of ["#/open?d=abc", "#/embed?d=abc&theme=dark", "#/g/abc?theme=ink", "#/"]) expect(withoutLook(hash)).toBe(hash);
  });

  it("an embed's link back to the app keeps the theme the embed was drawn in", () => {
    const at = "https://example.test/grooph/#/embed?d=abc";
    expect(openInAppHref(parseEmbedHash("#/embed?d=abc&theme=chalk-dark&c=lean"), at)).toBe("https://example.test/grooph/#/open?d=abc&c=lean&theme=chalk");
    expect(openInAppHref(parseEmbedHash("#/embed?d=abc&theme=dark"), at)).toBe("https://example.test/grooph/#/open?d=abc");
    expect(openInAppHref(parseEmbedHash("#/embed?d=abc"), at)).toBe("https://example.test/grooph/#/open?d=abc");
    // Only letters reach the address: nothing an address could carry in.
    expect(parseEmbedHash("#/embed?d=abc&theme=x%22onload").look).toBeUndefined();
  });

  it("writes a theme for the canvas, for the app's marks on a map and for an embed as variables those really read", () => {
    const css = styles();
    // Every variable set for the canvas is one the app's stylesheet declares; a misspelt one would change nothing.
    // (The pictures' own, --gp-*, are core's, and core's tests hold them.)
    const declared = new Set([...src("styles.css").matchAll(/^\s*--([a-z0-9-]+):/gm)].map((m) => m[1]!));
    const canvas = new Set([...css.matchAll(/(?:\{|;)--(?!gx-|gp-)([a-z0-9-]+):/g)].map((m) => m[1]!));
    expect(canvas.size).toBeGreaterThanOrEqual(28);
    for (const name of canvas) expect(declared.has(name), `--${name} is not a variable of the app`).toBe(true);
    const embedDeclared = new Set([...src("embed.css").matchAll(/^\s*--(gx-[a-z0-9-]+):/gm)].map((m) => m[1]!));
    const embed = new Set([...css.matchAll(/(?:\{|;)--(gx-[a-z0-9-]+):/g)].map((m) => m[1]!));
    for (const name of embed) expect(embedDeclared.has(name), `--${name} is not a variable of the embed`).toBe(true);
    // Every color the embed declares is given, but its shadow, which is no color.
    expect([...embedDeclared].filter((name) => !embed.has(name))).toEqual(["gx-shadow"]);

    // The rules, one by one: a condition's rules are read as the rules they are.
    const rules = css
      .replace(/@(?:media|supports) \([^)]*\)\{((?:[^{}]*\{[^{}]*\})+)\}/g, "$1")
      .split("}")
      .filter(Boolean)
      .map((rule) => ({ selectors: rule.split("{")[0]!.split(/,(?![^(]*\))/), body: rule.split("{")[1]! }));
    for (const id of FIVE) {
      const t = THEME_VALUES[id];
      // The canvas, the loops' legend over it and an empty canvas's words take the colors; nothing else on the screen does.
      expect(css).toContain(`.stage[data-look="${id}"] .react-flow,.stage[data-look="${id}"] .loop-legend,.stage[data-look="${id}"] .empty-canvas{--bg:${t.light.bg};`);
      // An embed's variables. A theme with one form says them where embed.css says dark's, and one attribute more, so
      // it holds whichever sheet comes later.
      const gx = `.gx[data-look="${id}"]`;
      expect(css).toContain(`${t.dark === t.light ? `${gx},${gx}:not([data-theme="light"]),${gx}[data-theme]` : gx}{--gx-bg:${t.light.bg};`);
      // A theme with one form says nothing of dark; the others follow the device, as the site does.
      expect(css.includes(`@media (prefers-color-scheme:dark){.stage[data-look="${id}"]`)).toBe(t.dark !== t.light);
      expect(css).toContain(`:where(.stage[data-look="${id}"]) .gnode{border-radius:${t.canvas.radius}px;border-width:${t.canvas.border}px}`);
    }
    // Every rule is kept to something this piece has marked, or to a control that offers the themes: an address in
    // Paper, where nothing is marked, is touched by none of them.
    for (const selector of rules.flatMap((rule) => rule.selectors)) expect(/data-look="|^\[data-pictures\]/.test(selector), `${selector} reaches the page whether or not it is in a theme`).toBe(true);
    // What a theme says of a plain node, edge or label sits inside :where(), so a node's own state always outranks
    // it. What it says of a state is outside, and names the state: it has to outrank the app's rule for it.
    const onCanvas = rules.flatMap((rule) => rule.selectors).filter((selector) => /\.g(?:node|edge)/.test(selector));
    expect(onCanvas.length).toBeGreaterThan(40);
    for (const selector of onCanvas) {
      const state = /\.(?:is|run)-[a-z]+/.test(selector);
      expect(selector.startsWith(":where(.stage[data-look="), `${selector} ${state ? "is a state's rule inside :where(), and would lose to the app's" : "is outside :where(), and would outrank a node's state"}`).toBe(!state);
    }
    // Nothing is asked of any other address, and nothing here could end the style element early.
    expect(css).not.toMatch(/url\((?!#)|@import|@font-face|https?:|</);
  });

  it("gives the app's own marks a color and a weight that are seen on each theme", () => {
    const css = styles();
    for (const id of FIVE) {
      const t = THEME_VALUES[id];
      const one = t.light.ok === t.light["line-strong"];
      expect(one, id).toBe(id === "ink");
      const canvas = new RegExp(`\\.stage\\[data-look="${id}"\\] \\.react-flow[^{]*\\{([^}]*)\\}`).exec(css)![1]!;
      const map = new RegExp(`\\.map-picture\\[data-look="${id}"\\]\\{([^}]*)\\}`).exec(css)![1]!;
      const frame = new RegExp(`\\.gx\\[data-look="${id}"\\][^{ ]*\\{([^}]*)\\}`).exec(css)![1]!;
      if (one) {
        // One ink: the marks the app tells apart by color keep the site's colors, on the canvas, a map and an embed.
        for (const name of ["accent", "focus", "highlight", "error", "warning", "ok"]) expect(canvas, `${id}: --${name}`).not.toMatch(new RegExp(`--${name}:`));
        expect(map).not.toContain("--accent:");
        expect(frame).not.toContain("--gx-focus:");
      } else {
        // A picked card and the keyboard's place are outlined in the theme's green, never in the color its cards are outlined in.
        expect(t.light.ok).not.toBe(t.light["line-strong"]);
        expect(canvas).toContain(`--focus:${t.light.ok}`);
        expect(map).toContain(`--accent:${t.light.ok}`);
        expect(frame).toContain(`--gx-focus:${t.light.ok}`);
      }
      // A picked row's ground is the lanes': core's contrast test holds every color a row's words are in against it.
      expect(map).toContain(`--accent-soft:${t.light["surface-2"]}`);
      // Emphasis is heavier than the theme's own weight, wherever the app says a state by weight.
      const weight = (pattern: string): number => Number(new RegExp(`${pattern}[^{]*\\{[^}]*?(?:stroke|border)-width:([\\d.]+)`).exec(css)![1]);
      expect(weight(`\\.stage\\[data-look="${id}"\\] \\.gedge\\.is-selected \\.gedge-line`)).toBeGreaterThan(t.canvas.edge);
      expect(weight(`\\.stage\\[data-look="${id}"\\] \\.gnode\\.run-halted`)).toBeGreaterThan(t.canvas.border);
      expect(weight(`\\.stage\\[data-look="${id}"\\] \\.gnode-human-gate\\.run-halted`)).toBeGreaterThanOrEqual(t.canvas.gate);
      expect(weight(`\\.map-picture\\[data-look="${id}"\\] :is\\(\\[data-session\\]`)).toBeGreaterThan(t.canvas.border);
      expect(weight(`\\.gx\\[data-look="${id}"\\] \\.gx-canvas g\\[data-node\\]:focus-visible rect\\[data-card\\],`)).toBeGreaterThan(t.canvas.border);
      // On a gate's card, whose own outline is the heavier, the mark is heavier than that.
      expect(weight(`\\.gx\\[data-look="${id}"\\] \\.gx-canvas g\\[data-node\\]:focus-visible rect\\[data-card\\]\\[stroke-width="1\\.8"\\]`)).toBeGreaterThan(t.canvas.gate);
      expect(weight(`\\.gx\\[data-look="${id}"\\]\\[data-replay\\] g\\[data-edge\\]\\[data-focus\\]`)).toBeGreaterThan(t.canvas.edge);
    }
  });

  it("is kept out of the first load: one entry in the header's menu is all of the themes that is there", () => {
    // What every address of the app loads first is whatever the entry reaches without waiting: every import that is
    // not an `import()`. Followed from the entry, file by file.
    const root = join(repoRoot, "apps/web/src");
    const first = new Set<string>();
    const outside = new Set<string>();
    const follow = (file: string): void => {
      if (first.has(file)) return;
      first.add(file);
      for (const [, to] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)(?:[^;]*?\sfrom\s+)?"([^"]+)";/gm)) {
        if (!to!.startsWith(".")) outside.add(to!);
        else {
          const base = join(dirname(file), to!.replace(/\.js$/, ""));
          const found = [`${base}.ts`, `${base}.tsx`, join(dirname(file), to!)].find((path) => existsSync(path));
          if (found && /\.tsx?$/.test(found)) follow(found);
        }
      }
    };
    follow(join(root, "main.tsx"));
    follow(join(root, "App.tsx"));
    const reached = [...first].map((file) => file.slice(root.length + 1));
    expect(reached.length).toBeGreaterThan(15);
    for (const file of ["ui/landing/Landing.tsx", "ui/landing/Chrome.tsx", "ui/Library.tsx", "piece.ts"]) expect(reached, `the walk did not reach ${file}`).toContain(file);
    // None of it is the themes, the file that looks for a kept choice, or the canvas's dot; and none of it imports core's themes.
    for (const file of ["doc/look.ts", "ui/theme/themes.ts", "ui/canvas/LookMenu.tsx", "ui/Keep.tsx", "ui/screens.ts"]) expect(reached, `${file} is in the first load`).not.toContain(file);
    expect([...outside].filter((to) => /themes/.test(to))).toEqual([]);
    // The header holds the entry, marked for whoever is listening, and no list of themes.
    const header = src("ui/landing/Chrome.tsx");
    expect(header).toContain('data-pictures=""');
    for (const id of FIVE) expect(new RegExp(`["'\`>\\s]${id}["'\`<\\s]`, "i").test(header.replace(/\/\*[^]*?\*\/|\/\/.*$/gm, "")), `the header names ${id}`).toBe(false);
    // Two places ask for the piece, each through `piece()`: the file that looks for a kept choice, and an embed.
    expect(src("doc/look.ts").match(/piece\("themes", \(\) => import\("\.\.\/ui\/theme\/themes\.js"\)\)/g)).toHaveLength(1);
    expect(src("ui/embed/EmbedApp.tsx").match(/piece\("themes", \(\) => import\("\.\.\/theme\/themes\.js"\)\)/g)).toHaveLength(1);
    expect(src("ui/screens.ts")).toContain('import "../doc/look.js";');
    // And the piece imports nothing but core's themes, so fetching it moves no other file.
    expect(src("ui/theme/themes.ts").match(/^import /gm)).toHaveLength(1);
    expect(src("ui/theme/themes.ts")).toMatch(/^import \{[^}]*\} from "@grooph\/core\/themes";$/m);
    // No screen is wired to a theme: the piece dresses what they draw.
    for (const file of ["ui/embed/Embed.tsx", "ui/map/MapView.tsx", "ui/map/views.tsx", "ui/live/LiveSessions.tsx", "ui/landing/Landing.tsx", "ui/landing/RunDemo.tsx"]) expect(src(file), file).not.toMatch(/data-look|doc\/look|theme\/themes/);
  });
});
