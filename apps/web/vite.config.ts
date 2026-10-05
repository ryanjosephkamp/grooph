import { fileURLToPath } from "node:url";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Core without the compiler (packages/core/src/base.ts says why); the compiler is the next line.
const coreSource = fileURLToPath(new URL("../../packages/core/src/base.ts", import.meta.url));
const compileSource = fileURLToPath(new URL("../../packages/core/src/compile/index.ts", import.meta.url));
// An operation map's other views (slice 0080) are a third door into core. The map screen's piece (src/ui/map/views.tsx)
// goes through it, is fetched when a map is drawn, and is named in the page as the compiler is.
const mapViewsSource = fileURLToPath(new URL("../../packages/core/src/picture/map-views.ts", import.meta.url));

/**
 * What each address loads, and the app's share of it fetched at once.
 *
 * Since slice 0056 the entry script is small and chooses by the address: `#/embed?…` loads only the embed, and every
 * other address loads the app. Left alone, the app's scripts and styles would be asked for only after the entry
 * had run, and the two stylesheets one after the other: on a slow link that measured half a second later to the
 * first heading than when it was all one file. So the page says, before the entry loads, which files the app
 * needs, and the browser fetches them beside it. An embed address is told nothing, and stays light.
 *
 * Since slice 0069 the screens that draw on the canvas are a module of their own (`src/ui/screens.ts`), which the
 * front page, the library and the template list do not load. The page asks for it too when the address opens on
 * one of those screens, so such an address loads what it did before, at once. Every stylesheet of the app is
 * still asked for at every app address: they are small, and their order is then the same on every screen.
 *
 * Since slice 0078 what opens a document a person hands over, from a file or from a paste, is fetched when they
 * pick the file or open the paste box (src/ui/Import.tsx), and is named in the same list as the compiler, for the
 * same reason.
 *
 * Since slice 0070 the compiler is fetched when a person first exports. No address is told to fetch it, but the
 * page names it, in a list the browser does nothing with: the service worker reads a page for the files it names
 * and keeps them, so an export still works with no network.
 *
 * `dist/routes.json` lists the sets; `scripts/perf-budget.mjs` weighs them.
 */
function routes(): Plugin {
  type Files = { js: string[]; css: string[] };
  let found: { app: Files; canvas: Files; embed: Files; entry: string[]; later: string[] } | undefined;
  let outDir = "dist";
  return {
    name: "grooph-routes",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        type Chunk = { type: "chunk"; fileName: string; isEntry: boolean; facadeModuleId: string | null; imports: string[]; viteMetadata?: { importedCss: Set<string> } };
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === "chunk") as unknown as Chunk[];
        const byFile = new Map(chunks.map((c) => [c.fileName, c]));
        const closure = (start: Chunk): Set<string> => {
          const seen = new Set<string>();
          const walk = (c: Chunk): void => {
            if (seen.has(c.fileName)) return;
            seen.add(c.fileName);
            for (const name of c.imports) {
              const next = byFile.get(name);
              if (next) walk(next);
            }
          };
          walk(start);
          return seen;
        };
        const entry = chunks.find((c) => c.isEntry);
        const app = chunks.find((c) => c.facadeModuleId?.endsWith("/src/App.tsx"));
        const embed = chunks.find((c) => c.facadeModuleId?.endsWith("/ui/embed/EmbedApp.tsx"));
        const screens = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/screens.ts"));
        const compiler = chunks.find((c) => c.facadeModuleId?.endsWith("/core/src/compile/index.ts"));
        const mapViews = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/map/views.tsx"));
        const importer = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/Import.tsx"));
        // A page without these lists would still work, and load in more rounds than anyone measured. Say so instead.
        if (!entry || !app || !embed || !screens || !compiler || !mapViews || !importer) {
          const missing = Object.entries({ entry, app, embed, screens, compiler, mapViews, importer }).filter(([, c]) => !c).map(([name]) => name);
          throw new Error(`grooph-routes: no chunk of its own for ${missing.join(", ")}. The build no longer splits where vite.config.ts expects.`);
        }
        const inEntry = closure(entry);
        const inApp = closure(app);
        const cssOf = (files: Set<string>): string[] => [...files].flatMap((f) => [...(byFile.get(f)?.viteMetadata?.importedCss ?? [])]);
        const embedCss = cssOf(closure(embed));
        // The app's styles: every stylesheet that is not the embed's own. Their order decides which of two equal rules
        // wins, so it is fixed here and not left to the order the bundle lists them in: React Flow's base, then the
        // app's shared sheet (styles.css), then the sheets screens keep beside their components, which build on it.
        const rank = (file: string): number => (file.startsWith("assets/base-") ? 0 : file.startsWith("assets/styles-") ? 1 : 2);
        const appCss = Object.values(ctx.bundle)
          .filter((a) => a.type === "asset" && a.fileName.endsWith(".css") && !embedCss.includes(a.fileName))
          .map((a) => a.fileName)
          .sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
        found = {
          entry: [...inEntry],
          app: { js: [...inApp].filter((f) => !inEntry.has(f)), css: appCss },
          canvas: { js: [...closure(screens)].filter((f) => !inEntry.has(f) && !inApp.has(f)), css: [] },
          // What no address loads first and the page still names, so that the worker fetches it as it installs: the
          // compiler, the map's views, what opens a handed-over document, and the embed's own script and styles. The
          // front page plays its recorded run in a frame at `#/embed`, and a visit that never watched it should still
          // have it with no network (handoff 0083).
          later: [...new Set([...closure(compiler), ...closure(mapViews), ...closure(importer), ...closure(embed), ...embedCss])].filter((f) => !inEntry.has(f) && !inApp.has(f) && !closure(screens).has(f)),
          embed: { js: [...closure(embed)].filter((f) => !inEntry.has(f)), css: embedCss },
        };
        const base = ctx.server ? "/" : "/grooph/";
        const list = (files: string[]): string => JSON.stringify(files.map((f) => `${base}${f}`));
        // The styles go in as stylesheets, in that order. Vite's own loader finds them there and does not fetch them
        // again, one after another.
        const hint = `<script>if(!/^#\\/embed(\\?|$)/.test(location.hash)){for(const h of ${list(found.app.css)}){const l=document.createElement("link");l.rel="stylesheet";l.href=h;document.head.appendChild(l)}for(const h of ${list(found.app.js)}.concat(/^#\\/(g\\/|open\\?|run|live|templates\\/)/.test(location.hash)?${list(found.canvas.js)}:[])){const l=document.createElement("link");l.rel="modulepreload";l.href=h;document.head.appendChild(l)}}void ${list(found.later)}</script>`;
        return html.replace("</title>", `</title>\n    ${hint}`);
      },
    },
    closeBundle() {
      if (found) writeFileSync(join(outDir, "routes.json"), `${JSON.stringify(found, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the app at https://ryanjosephkamp.github.io/grooph/.
  base: "/grooph/",
  plugins: [react(), routes()],
  resolve: {
    // Decision 0005: core is consumed from source, so the browser runs the same
    // modules the CLI compiles — no second build of the compiler.
    // The compiler first: it is a part of core with an address of its own (slice 0070), fetched when a person exports.
    alias: [
      { find: "@grooph/core/compile", replacement: compileSource },
      { find: "@grooph/core/map-views", replacement: mapViewsSource },
      { find: "@grooph/core", replacement: coreSource },
    ],
  },
  // Three chunks since slice 0056: a small entry, the app, and what the app and an embed share. The limit is set
  // just above the largest, so the build warns when it grows, not every time. scripts/perf-budget.mjs weighs
  // what each address loads.
  build: { target: "es2022", sourcemap: true, chunkSizeWarningLimit: 900 },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
