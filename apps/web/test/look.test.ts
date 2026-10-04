import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PICTURE_THEMES, THEME_VALUES } from "@grooph/core/themes";
import { describe, expect, it } from "vitest";

import { LOOKS, lookNamed, lookNow } from "../src/doc/look.js";
import { parseEmbedHash } from "../src/ui/embed/link.js";
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
  });

  it("an embed's light or dark is read after a theme's name too", () => {
    expect(parseEmbedHash("#/embed?d=abc&theme=dark").theme).toBe("dark");
    expect(parseEmbedHash("#/embed?d=abc&theme=chalk-dark").theme).toBe("dark");
    expect(parseEmbedHash("#/embed?d=abc&theme=blueprint-light").theme).toBe("light");
    expect(parseEmbedHash("#/embed?d=abc&theme=blueprint").theme).toBeUndefined();
    expect(parseEmbedHash("#/embed?d=abc&theme=darker").theme).toBeUndefined();
    expect(parseEmbedHash("#/embed?d=abc").theme).toBeUndefined();
  });

  it("writes a theme for the canvas and for an embed as variables those two really read", () => {
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

    for (const [id] of LOOKS.slice(1)) {
      const t = THEME_VALUES[id as keyof typeof THEME_VALUES];
      // The canvas and the loops' legend over it take the colors; nothing else on the screen does.
      expect(css).toContain(`.stage[data-look="${id}"] .react-flow,.stage[data-look="${id}"] .loop-legend{--bg:${t.light.bg};`);
      expect(css).toContain(`.gx[data-look="${id}"]{--gx-bg:${t.light.bg};`);
      // A theme with one form says nothing of dark; the others follow the device, as the site does.
      const dark = css.includes(`@media (prefers-color-scheme:dark){.stage[data-look="${id}"]`);
      expect(dark).toBe(t.dark !== t.light);
      // Corners, outlines and lettering sit inside :where(), so a node's own state always outranks them.
      for (const rule of css.match(new RegExp(`[^}]*${id}"\\]\\) \\.g(?:node|edge)[^{]*\\{`, "g")) ?? []) expect(rule.startsWith(":where(") || rule.includes(",:where(")).toBe(true);
      expect(css).toContain(`:where(.stage[data-look="${id}"]) .gnode{border-radius:${t.canvas.radius}px;border-width:${t.canvas.border}px}`);
    }
    // Nothing is asked of any other address, and nothing here could end the style element early.
    expect(css).not.toMatch(/url\(|@import|@font-face|https?:|</);
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
