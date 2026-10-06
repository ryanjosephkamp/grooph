import { fileURLToPath } from "node:url";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { BUILT_INS, FRONT } from "./src/doors.js";

// Core without the compiler (packages/core/src/base.ts says why); the compiler is the next line.
const coreSource = fileURLToPath(new URL("../../packages/core/src/base.ts", import.meta.url));
const compileSource = fileURLToPath(new URL("../../packages/core/src/compile/index.ts", import.meta.url));
// An operation map's other views (slice 0080) are a third door into core. The map screen's piece (src/ui/map/views.tsx)
// goes through it, is fetched when a map is drawn, and is named in the page as the compiler is.
const mapViewsSource = fileURLToPath(new URL("../../packages/core/src/picture/map-views.ts", import.meta.url));
// So is the fold of a subgrooph (slice 0085, `picture/graph-units.ts`): fetched with the box a canvas draws one as.
const unitsSource = fileURLToPath(new URL("../../packages/core/src/picture/graph-units.ts", import.meta.url));
// And the picture's themes (slice 0086): the five that are not Paper. The app's piece for them
// (src/ui/theme/themes.ts) is fetched when one is chosen or named in an address, and named in the page too.
const themesSource = fileURLToPath(new URL("../../packages/core/src/picture/themes.ts", import.meta.url));
// And adoption held to a graph's brakes (slice 0085's follow-up): the comparison a refresh shares. The run page's
// piece for it (src/ui/run/brakes.tsx) is fetched when Adopt is pressed, and named in the page too.
const adoptionSource = fileURLToPath(new URL("../../packages/core/src/adoption.ts", import.meta.url));
// And the one-file offline page (slice 0093's second part): made when a person presses "Offline page" under Keep a
// copy, and by nothing an address shows. src/doc/keep.ts fetches it then, and it is named in the page too.
const offlineSource = fileURLToPath(new URL("../../packages/core/src/offline.ts", import.meta.url));
// And a plan's files (slice 0100): PLAN.md, the picture and the document, for any graph that reads. Their maker is
// part of the Export panel's piece (src/ui/ExportDoor.tsx), which is fetched when Export is pressed and named in the page.
const planSource = fileURLToPath(new URL("../../packages/core/src/plan.ts", import.meta.url));

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
 * Since slice 0070 the compiler is fetched when a person first exports. No address is told to fetch it, but the
 * page names it, in a list the browser does nothing with: the service worker reads a page for the files it names
 * and keeps them, so an export still works with no network.
 *
 * Since slice 0085 the box a subgrooph is drawn as on the canvas is a piece of its own too (`src/ui/canvas/units.tsx`),
 * fetched when a document has one. It is named in the same list, so it is held for a visit with no network.
 *
 * Since then more pieces of the same kind, each named where it is found below: the pictures' themes, adoption's
 * comparison, the built-in templates, the front page's picture, and the offline page's maker, which is fetched when
 * "Offline page" is pressed under Keep a copy.
 *
 * `dist/routes.json` lists the sets; `scripts/perf-budget.mjs` weighs them.
 */
function routes(): Plugin {
  type Files = { js: string[]; css: string[] };
  let found: { app: Files; canvas: Files; embed: Files; entry: string[]; later: string[]; space: string[]; templates?: string[]; front?: string[]; stage?: string[]; views?: string[]; more?: string[]; offline?: string[]; exporting?: string[] } | undefined;
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
        const mapSpace = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/map/space.ts"));
        const units = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/canvas/units.tsx"));
        const graphViews = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/canvas/graph-views.tsx"));
        const themes = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/theme/themes.ts"));
        const brakes = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/run/brakes.tsx"));
        // A page without these lists would still work, and load in more rounds than anyone measured. Say so instead.
        if (!entry || !app || !embed || !screens || !compiler || !mapViews || !mapSpace || !units || !graphViews || !themes || !brakes) {
          const missing = Object.entries({ entry, app, embed, screens, compiler, mapViews, mapSpace, units, graphViews, themes, brakes }).filter(([, c]) => !c).map(([name]) => name);
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
          // compiler, the map's views, a map in three dimensions, a subgrooph's box, the pictures' themes, and the
          // embed's own script and styles. The front page plays its recorded run in a frame at `#/embed`, and a visit
          // that never watched it should still have it with no network (handoff 0083).
          later: [...new Set([...closure(compiler), ...closure(mapViews), ...closure(mapSpace), ...closure(units), ...closure(graphViews), ...closure(themes), ...closure(brakes), ...closure(embed), ...embedCss])].filter((f) => !inEntry.has(f) && !inApp.has(f) && !closure(screens).has(f)),
          // What choosing a map's view in three dimensions fetches, over what the map screen has already (handoff 0087).
          space: [...closure(mapSpace)].filter((f) => !inEntry.has(f) && !inApp.has(f) && !closure(mapViews).has(f)),
          embed: { js: [...closure(embed)].filter((f) => !inEntry.has(f)), css: embedCss },
        };
        // The built-in templates (slice 0093, src/doc/builtins.ts): the twenty pattern documents, a piece the template
        // screens fetch. It was part of the app at every address. It is named in the page with the other pieces, so
        // the worker holds it, and an address that lists the templates or opens a built-in one asks for it beside the
        // app, in the round it always came in (one of a person's own does not need it, and does not ask). Which
        // addresses those are is in src/doors.ts, which the app reads too, so the two cannot differ. Written apart
        // from the lists above, which other slices are adding to.
        const builtIns = chunks.find((c) => c.facadeModuleId?.endsWith("/src/doc/builtins.ts"));
        if (!builtIns) throw new Error("grooph-routes: no chunk of its own for the built-in templates (src/doc/builtins.ts). The build no longer splits where vite.config.ts expects.");
        found.templates = [...closure(builtIns)].filter((f) => !inEntry.has(f) && !inApp.has(f) && !closure(screens).has(f));
        // And the front page's picture and tiles (src/ui/landing/front.ts), drawn ahead of time: a piece only
        // the front page's address asks for beside the app. It is part of that address's first load, and
        // scripts/perf-budget.mjs weighs it there; a graph, a share link and the template screens do not carry it.
        const frontPage = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/landing/front.ts"));
        if (!frontPage) throw new Error("grooph-routes: no chunk of its own for the front page's picture (src/ui/landing/front.ts). The build no longer splits where vite.config.ts expects.");
        found.front = [...closure(frontPage)].filter((f) => !inEntry.has(f) && !inApp.has(f));
        // A graph's other views in three dimensions (slice 0096; src/ui/canvas/graph-stage.tsx): one piece for the
        // stage and every view on it, fetched when one is chosen, and named in the page so the worker holds it. One
        // piece and not one a view: a name is on every address's first load. Written apart from the lists above too.
        const graphStage = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/canvas/graph-stage.tsx"));
        if (!graphStage) throw new Error("grooph-routes: no chunk of its own for a graph's other views in three dimensions (src/ui/canvas/graph-stage.tsx). The build no longer splits where vite.config.ts expects.");
        // Over what a canvas has by then: the switch's own piece, which asks for this one, is not weighed here again.
        const stage = [...closure(graphStage)].filter((f) => !inEntry.has(f) && !inApp.has(f) && !closure(screens).has(f) && !closure(graphViews).has(f));
        // The kinds that are not in the stage's piece (src/ui/canvas/graph-more.tsx: Rings, and Columns with it): one
        // piece, fetched beside the stage when either is chosen, named in the page with the rest, and weighed apart
        // from the stage, over what the stage has brought by then.
        const graphMore = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/canvas/graph-more.tsx"));
        if (!graphMore) throw new Error("grooph-routes: no chunk of its own for a graph's kinds of view that are not in the stage (src/ui/canvas/graph-more.tsx). The build no longer splits where vite.config.ts expects.");
        found.more = [...closure(graphMore)].filter((f) => !inEntry.has(f) && !inApp.has(f) && !closure(screens).has(f) && !closure(graphViews).has(f) && !stage.includes(f));
        found.later = [...new Set([...found.later, ...stage, ...found.more, ...found.templates, ...found.front])];
        // Both are on no address's first load, and each has a line of its own in scripts/perf-budget.json: the
        // stage, which choosing one of those views fetches, and the switch with the graph's reading, which every
        // address that draws on the canvas fetches once the canvas is drawn. A piece nothing measures grows.
        found.stage = stage;
        found.views = [...closure(graphViews)].filter((f) => !inEntry.has(f) && !inApp.has(f) && !closure(screens).has(f));
        // And the offline page's maker (packages/core/src/offline.ts): fetched when "Offline page" is pressed, held by
        // the worker from its install, so that a copy can be kept with no network. No address loads it first.
        const offlinePage = chunks.find((c) => c.facadeModuleId?.endsWith("/core/src/offline.ts"));
        if (!offlinePage) throw new Error("grooph-routes: no chunk of its own for the offline page's maker (packages/core/src/offline.ts). The build no longer splits where vite.config.ts expects.");
        // It imports nothing (it is handed core's parts, `offline-kit.ts`), and that is what keeps it from cutting
        // the file every address loads in pieces. A static import of it somewhere leaves a chunk by this name that
        // only points at the canvas's, with the maker back on every canvas: so an import of any kind fails the build.
        if (offlinePage.imports.length > 0) throw new Error(`grooph-routes: the offline page's maker imports ${offlinePage.imports.join(", ")}. It is a piece that imports nothing (packages/core/src/offline-kit.ts says why); something imports it outright, or it imports core.`);
        const inCanvas = closure(screens);
        found.offline = [...closure(offlinePage)].filter((f) => !inEntry.has(f) && !inApp.has(f) && !inCanvas.has(f));
        found.later = [...new Set([...found.later, ...found.offline])];
        // And the Export panel (src/ui/ExportPanel.tsx, slice 0100) with the plan's maker in it: fetched when Export is
        // pressed, and soon after an editor opens. No address loads it first, and the worker holds it from its install.
        const exportPanel = chunks.find((c) => c.facadeModuleId?.endsWith("/src/ui/ExportPanel.tsx"));
        if (!exportPanel) throw new Error("grooph-routes: no chunk of its own for the Export panel (src/ui/ExportPanel.tsx). Something imports it outright, and every canvas carries it again.");
        found.exporting = [...closure(exportPanel)].filter((f) => !inEntry.has(f) && !inApp.has(f) && !inCanvas.has(f));
        found.later = [...new Set([...found.later, ...found.exporting])];
        const base = ctx.server ? "/" : "/grooph/";
        const list = (files: string[]): string => JSON.stringify(files.map((f) => `${base}${f}`));
        // The styles go in as stylesheets, in that order. Vite's own loader finds them there and does not fetch them
        // again, one after another. The scripts go in as `modulepreload`, or, in a browser that does not know it
        // (Safari before 17, Firefox before 115), as a preload of a script fetched as a module is: such a browser
        // would otherwise ask for a piece only when the app imported it, a round after the app (slice 0093).
        const hint = `<script>if(!/^#\\/embed(\\?|$)/.test(location.hash)){for(const h of ${list(found.app.css)}){const l=document.createElement("link");l.rel="stylesheet";l.href=h;document.head.appendChild(l)}const r=document.createElement("link").relList,m=r&&r.supports&&r.supports("modulepreload");for(const h of ${list(found.app.js)}.concat(/^#\\/(g\\/|open\\?|run|live|templates\\/)/.test(location.hash)?${list(found.canvas.js)}:[],/${BUILT_INS}/.test(location.hash)?${list(found.templates)}:[],/${FRONT}/.test(location.hash)?${list(found.front)}:[])){const l=document.createElement("link");if(m)l.rel="modulepreload";else{l.rel="preload";l.as="script";l.crossOrigin=""}l.href=h;document.head.appendChild(l)}}void ${list(found.later)}</script>`;
        // With a function: a replacement given as text is read for `$&` and its kind, and the rules are full of `$`.
        return html.replace("</title>", () => `</title>\n    ${hint}`);
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
      { find: "@grooph/core/units", replacement: unitsSource },
      { find: "@grooph/core/themes", replacement: themesSource },
      { find: "@grooph/core/adoption", replacement: adoptionSource },
      { find: "@grooph/core/offline", replacement: offlineSource },
      { find: "@grooph/core/plan", replacement: planSource },
      { find: "@grooph/core", replacement: coreSource },
    ],
  },
  // Three chunks since slice 0056: a small entry, the app, and what the app and an embed share. The limit is set
  // just above the largest, so the build warns when it grows, not every time. scripts/perf-budget.mjs weighs
  // what each address loads.
  build: { target: "es2022", sourcemap: true, chunkSizeWarningLimit: 900 },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
