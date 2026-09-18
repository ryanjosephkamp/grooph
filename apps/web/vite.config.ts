import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const coreSource = fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url));

export default defineConfig({
  // GitHub Pages serves the app at https://ryanjosephkamp.github.io/grooph/.
  base: "/grooph/",
  plugins: [react()],
  resolve: {
    // Decision 0005: core is consumed from source, so the browser runs the same
    // modules the CLI compiles — no second build of the compiler.
    alias: { "@grooph/core": coreSource },
  },
  build: { target: "es2022", sourcemap: true },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
