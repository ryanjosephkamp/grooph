import { fileURLToPath } from "node:url";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const coreSource = fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url));

/**
 * What each address loads, and the app's share of it fetched at once.
 *
 * Since slice 0056 the entry script is small and chooses by the address: `#/embed?…` loads only the embed, and every
 * other address loads the app. Left alone, the app's scripts and styles would be asked for only after the entry
 * had run, and the two stylesheets one after the other: on a slow link that measured half a second later to the
 * first heading than when it was all one file. So the page says, before the entry loads, which files the app
 * needs, and the browser fetches them beside it. An embed address is told nothing, and stays light.
 *
 * `dist/routes.json` lists both sets; `scripts/perf-budget.mjs` weighs them.
 */
function routes(): Plugin {
  let found: { app: { js: string[]; css: string[] }; embed: { js: string[]; css: string[] }; entry: string[] } | undefined;
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
        if (!entry || !app || !embed) return html;
        const inEntry = closure(entry);
        const cssOf = (files: Set<string>): string[] => [...files].flatMap((f) => [...(byFile.get(f)?.viteMetadata?.importedCss ?? [])]);
        const embedCss = cssOf(closure(embed));
        // The app's styles are imported by code in main.tsx: every stylesheet that is not the embed's own.
        const appCss = Object.values(ctx.bundle)
          .filter((a) => a.type === "asset" && a.fileName.endsWith(".css") && !embedCss.includes(a.fileName))
          .map((a) => a.fileName)
          .sort((x, y) => Number(y.startsWith("assets/base-")) - Number(x.startsWith("assets/base-")));
        found = {
          entry: [...inEntry],
          app: { js: [...closure(app)].filter((f) => !inEntry.has(f)), css: appCss },
          embed: { js: [...closure(embed)].filter((f) => !inEntry.has(f)), css: embedCss },
        };
        const base = ctx.server ? "/" : "/grooph/";
        const list = (files: string[]): string => JSON.stringify(files.map((f) => `${base}${f}`));
        // The styles go in as stylesheets, in the order main.tsx imports them (React Flow's base, then the app's,
        // which overrides it). Vite's own loader finds them there and does not fetch them again, one after another.
        const hint = `<script>if(!/^#\\/embed(\\?|$)/.test(location.hash)){for(const h of ${list(found.app.css)}){const l=document.createElement("link");l.rel="stylesheet";l.href=h;document.head.appendChild(l)}for(const h of ${list(found.app.js)}){const l=document.createElement("link");l.rel="modulepreload";l.href=h;document.head.appendChild(l)}}</script>`;
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
    alias: { "@grooph/core": coreSource },
  },
  // Three chunks since slice 0056: a small entry, the app, and what the app and an embed share. The limit is set
  // just above the largest, so the build warns when it grows, not every time. scripts/perf-budget.mjs weighs
  // what each address loads.
  build: { target: "es2022", sourcemap: true, chunkSizeWarningLimit: 900 },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
