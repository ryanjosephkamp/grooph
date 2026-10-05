import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { offlineKit } from "@grooph/core";
import { offlinePageWith } from "@grooph/core/offline";
import { describe, expect, it } from "vitest";

import { repoRoot, reviewLoop } from "./helpers.js";

const root = join(repoRoot, "apps/web/src");
const read = (path: string): string => readFileSync(join(root, path), "utf8");

/**
 * Slice 0093, second part: the offline page's maker is a piece of the app, fetched when "Offline page" is pressed
 * under Keep a copy. Every address carried it before. These tests hold it out of what the app starts with and out
 * of the canvas's screens, and hold the one place that asks for it.
 */
describe("the offline page's maker is fetched when it is asked for", () => {
  it("nothing the app starts with, and no screen of the canvas, imports it except through piece()", () => {
    const seen = new Set<string>();
    const follow = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      // Every import that is not an `import()`: what a file brings with it without waiting.
      for (const [, to] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\s(?!type\b)(?:[^;]*?\sfrom\s+)?"([^"]+)";/gm)) {
        expect(to, `${file.slice(root.length + 1)} imports the offline page's maker outright`).not.toBe("@grooph/core/offline");
        if (!to!.startsWith(".")) continue;
        const base = join(dirname(file), to!.replace(/\.js$/, ""));
        const found = [`${base}.ts`, `${base}.tsx`].find((path) => existsSync(path));
        if (found) follow(found);
      }
    };
    for (const start of ["main.tsx", "App.tsx", "ui/screens.ts", "ui/embed/EmbedApp.tsx"]) follow(join(root, start));
    const reached = [...seen].map((file) => file.slice(root.length + 1));
    for (const file of ["doc/keep.ts", "ui/Keep.tsx", "ui/ExportPanel.tsx"]) expect(reached, `the walk did not reach ${file}`).toContain(file);
    // One place asks, by the name the build gives the piece's file, and hands the maker core's parts.
    const keep = read("doc/keep.ts");
    expect(keep).toContain('piece("offline", () => import("@grooph/core/offline"))');
    expect(keep).toContain("offlinePageWith(offlineKit, doc, { version: APP_VERSION })");
    // And it is asked for in the press, not when the panel or the file is loaded.
    expect(keep).toMatch(/export const pageMaker = \(\): Promise<.+> =>\s+piece\("offline"/);
    const askers = reached.filter((file) => /@grooph\/core\/offline/.test(read(file)));
    expect(askers).toEqual(["doc/keep.ts"]);
  });

  it("a press that cannot fetch it says so and downloads nothing", () => {
    const panel = read("ui/Keep.tsx");
    // The failure is caught where the button is, said in the panel's alert, and no file is made of nothing.
    // (The browser test presses the button with the piece refused; this holds the words and where they are said.)
    expect(panel).toMatch(/try \{\s*make = await pageMaker\(\);\s*\} catch \{\s*setProblem\(NO_PAGE\);\s*return;\s*\}/);
    expect(panel).toContain('<p className="refusal" role="alert">');
    expect(/const NO_PAGE = "([^"]+)";/.exec(panel)?.[1]).toBe("The offline page could not be made: its maker could not be fetched. It needs a connection the first time. The pictures above are made without it.");
  });

  it("the page made through the app's two doors is the page core's whole entry makes", async () => {
    // The app reaches the maker and its kit by two addresses of core; the CLI by one. The same bytes either way.
    const whole = await import("../../../packages/core/src/index.js");
    const doc = reviewLoop();
    const html = offlinePageWith(offlineKit, doc, { version: "0.0.0" });
    expect(html).toBe(whole.offlinePage(doc, { version: "0.0.0" }));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Made with grooph 0.0.0");
  });
});
