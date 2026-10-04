import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PICTURE_THEMES, THEME_VALUES } from "@grooph/core/themes";
import { describe, expect, it } from "vitest";

import { LOOKS, lookNamed, lookNow, withoutLook } from "../src/doc/look.js";
import { openInAppHref, parseEmbedHash } from "../src/ui/embed/link.js";
import { look, styles } from "../src/ui/theme/themes.js";
import { repoRoot } from "./helpers.js";

const src = (path: string): string => readFileSync(join(repoRoot, "apps/web/src", path), "utf8");

describe("the picture's theme in the app (handoff 0086)", () => {
  it("offers core's six, by the same names and in the same order", () => {
    expect(LOOKS.map(([id]) => id)).toEqual([...PICTURE_THEMES]);
    for (const [id, label] of LOOKS) expect(label).toBe(id === "paper" ? "Paper" : THEME_VALUES[id as keyof typeof THEME_VALUES].label);
    // Paper needs nothing fetched and has no values; each of the other five has, the same object each time.
    expect(look("paper")).toBeUndefined();
    for (const [id] of LOOKS.slice(1)) {
      expect(look(id)?.name).toBe(id);
      expect(look(id)).toBe(look(id));
    }
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
    expect(parseEmbedHash("#/embed?theme=ink-dark&d=abc&theme=chalk-light")).toMatchObject({ theme: "dark", look: "ink" });
  });

  it("takes a named theme out of an address and leaves the rest: every theme=, but light or dark said with one stays", () => {
    expect(withoutLook("#/open?d=abc&theme=transit")).toBe("#/open?d=abc");
    expect(withoutLook("#/open?theme=transit&d=abc&c=lean")).toBe("#/open?d=abc&c=lean");
    expect(withoutLook("#/open?d=abc&theme=ink&c=lean&theme=chalk")).toBe("#/open?d=abc&c=lean");
    expect(withoutLook("#/embed?d=abc&theme=chalk-dark&frame=1")).toBe("#/embed?d=abc&theme=dark&frame=1");
    expect(withoutLook("#/open?d=abc&theme=sepia")).toBe("#/open?d=abc");
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

  it("an embed's light or dark is read after a theme's name too", () => {
    expect(parseEmbedHash("#/embed?d=abc&theme=dark").theme).toBe("dark");
    expect(parseEmbedHash("#/embed?d=abc&theme=chalk-dark").theme).toBe("dark");
    expect(parseEmbedHash("#/embed?d=abc&theme=blueprint-light").theme).toBe("light");
    expect(parseEmbedHash("#/embed?d=abc&theme=blueprint").theme).toBeUndefined();
    expect(parseEmbedHash("#/embed?d=abc&theme=darker").theme).toBeUndefined();
    expect(parseEmbedHash("#/embed?d=abc").theme).toBeUndefined();
  });

  it("writes a theme for the canvas, for the app's marks on a map and for an embed as variables those really read", () => {
    const css = styles();
    // Every variable set for the canvas is one the app's stylesheet declares; a misspelt one would change nothing.
    const declared = new Set([...src("styles.css").matchAll(/^\s*--([a-z0-9-]+):/gm)].map((m) => m[1]!));
    const canvas = new Set([...css.matchAll(/(?:\{|;)--(?!gx-)([a-z0-9-]+):/g)].map((m) => m[1]!));
    expect(canvas.size).toBeGreaterThanOrEqual(28);
    for (const name of canvas) expect(declared.has(name), `--${name} is not a variable of the app`).toBe(true);
    const embedDeclared = new Set([...src("embed.css").matchAll(/^\s*--(gx-[a-z0-9-]+):/gm)].map((m) => m[1]!));
    const embed = new Set([...css.matchAll(/(?:\{|;)--(gx-[a-z0-9-]+):/g)].map((m) => m[1]!));
    for (const name of embed) expect(embedDeclared.has(name), `--${name} is not a variable of the embed`).toBe(true);
    // Every color the embed declares is given, but its shadow, which is no color.
    expect([...embedDeclared].filter((name) => !embed.has(name))).toEqual(["gx-shadow"]);

    // The rules, one by one: a condition's rules are read as the rules they are.
    const rules = css
      .replace(/@media \(prefers-color-scheme:dark\)\{((?:[^{}]*\{[^{}]*\})+)\}/g, "$1")
      .split("}")
      .filter(Boolean)
      .map((rule) => ({ selectors: rule.split("{")[0]!.split(/,(?![^(]*\))/), body: rule.split("{")[1]! }));
    for (const [id] of LOOKS.slice(1)) {
      const t = THEME_VALUES[id as keyof typeof THEME_VALUES];
      // The canvas, the loops' legend over it and an empty canvas's words take the colors; nothing else on the screen does.
      expect(css).toContain(`.stage[data-look="${id}"] .react-flow,.stage[data-look="${id}"] .loop-legend,.stage[data-look="${id}"] .empty-canvas{--bg:${t.light.bg};`);
      expect(css).toContain(`.gx[data-look="${id}"]{--gx-bg:${t.light.bg};`);
      // A theme with one form says nothing of dark; the others follow the device, as the site does.
      expect(css.includes(`@media (prefers-color-scheme:dark){.stage[data-look="${id}"]`)).toBe(t.dark !== t.light);
      expect(css).toContain(`:where(.stage[data-look="${id}"]) .gnode{border-radius:${t.canvas.radius}px;border-width:${t.canvas.border}px}`);
    }
    // What a theme says of a plain node, edge or label sits inside :where(), so a node's own state always outranks
    // it. What it says of a state is outside, and names the state: it has to outrank the app's rule for it.
    const onCanvas = rules.flatMap((rule) => rule.selectors).filter((selector) => /\.g(?:node|edge)/.test(selector));
    expect(onCanvas.length).toBeGreaterThan(40);
    for (const selector of onCanvas) {
      const state = /\.(?:is|run)-[a-z]+/.test(selector);
      expect(selector.startsWith(":where(.stage[data-look="), `${selector} ${state ? "is a state's rule inside :where(), and would lose to the app's" : "is outside :where(), and would outrank a node's state"}`).toBe(!state);
    }
    // Nothing is asked of any other address, and nothing here could end the style element early.
    expect(css).not.toMatch(/url\(|@import|@font-face|https?:|</);
  });

  it("gives the app's own marks a color and a weight that are seen on each theme", () => {
    const css = styles();
    for (const [id] of LOOKS.slice(1)) {
      const t = THEME_VALUES[id as keyof typeof THEME_VALUES];
      const one = t.light.ok === t.light["line-strong"];
      expect(one, id).toBe(id === "ink");
      const canvas = new RegExp(`\\.stage\\[data-look="${id}"\\] \\.react-flow[^{]*\\{([^}]*)\\}`).exec(css)![1]!;
      const map = new RegExp(`\\.map-picture\\[data-look="${id}"\\]\\{([^}]*)\\}`).exec(css)![1]!;
      const frame = new RegExp(`\\.gx\\[data-look="${id}"\\]\\{([^}]*)\\}`).exec(css)![1]!;
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
      expect(weight(`\\.gx\\[data-look="${id}"\\] \\.gx-canvas g\\[data-node\\]:focus-visible`)).toBeGreaterThan(t.canvas.border);
      expect(weight(`\\.gx\\[data-look="${id}"\\]\\[data-replay\\] g\\[data-edge\\]\\[data-focus\\]`)).toBeGreaterThan(t.canvas.edge);
    }
  });

  it("is kept out of the first load: only the piece reaches core's themes, and the app asks for the piece from one place", () => {
    const files = ["doc/look.ts", "doc/keep.ts", "ui/landing/Chrome.tsx", "ui/landing/Landing.tsx", "ui/canvas/LookMenu.tsx", "ui/embed/Embed.tsx", "ui/map/MapView.tsx", "ui/map/views.tsx", "ui/live/LiveSessions.tsx", "ui/Keep.tsx"];
    for (const file of files) {
      const text = src(file);
      // A type costs nothing; a value would pull the five themes into whatever loads this file.
      for (const line of text.match(/^import [^;]*"@grooph\/core\/themes";$/gm) ?? []) expect(line.startsWith("import type "), `${file}: ${line}`).toBe(true);
      expect(text.includes("ui/theme/themes.js") && !/import\("[^"]*ui\/theme\/themes\.js"\)/.test(text), `${file} imports the piece outright`).toBe(false);
    }
    expect(src("doc/look.ts").match(/(?<!typeof )import\("\.\.\/ui\/theme\/themes\.js"\)/g)).toHaveLength(1);
    expect(src("ui/theme/themes.ts")).toMatch(/^import \{ THEME_VALUES, pictureLook, type PictureLook, type ThemeValues \} from "@grooph\/core\/themes";$/m);
    expect(src("ui/theme/themes.ts").match(/^import /gm)).toHaveLength(1);
  });
});
