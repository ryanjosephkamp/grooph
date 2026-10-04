import { defineConfig } from "@playwright/test";

/**
 * Browser tests at phone size with touch, against the production build served
 * under the GitHub Pages base path (`/grooph/`), so the path the owner's phone
 * loads is the path under test.
 *
 * `GROOPH_E2E_PORT` moves the preview server off 4173, so two worktrees can
 * run their suites at once without one reusing the other's server.
 *
 * `GROOPH_BROWSERS=1` runs the smoke set (`e2e/smoke.spec.ts`) and the
 * service worker across a release (`e2e/release.spec.ts`, less its tests
 * tagged `@chromium`), and nothing else, in three engines: Chromium, WebKit,
 * which is Safari's, and Firefox. Without it every spec runs in Chromium
 * alone, those two among them, so a clone needs the other two browsers only
 * when it asks for them
 * (`pnpm --filter @grooph/web exec playwright install webkit firefox`).
 */
const port = Number(process.env["GROOPH_E2E_PORT"] ?? 4173);
const everyBrowser = process.env["GROOPH_BROWSERS"] === "1";
const everyEngine = { testMatch: ["smoke.spec.ts", "release.spec.ts"], grepInvert: /@chromium/ };

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}/grooph/`,
    viewport: { width: 400, height: 800 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    acceptDownloads: true,
    // The app's service worker (stage 8) answers from its cache; every test but the offline one wants the files as built.
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: everyBrowser
    ? [
        { name: "chromium", ...everyEngine, use: { browserName: "chromium" } },
        { name: "safari", ...everyEngine, use: { browserName: "webkit" } },
        // Playwright has no phone mode for Firefox (`isMobile` is refused): the same narrow window with touch.
        { name: "firefox", ...everyEngine, use: { browserName: "firefox", isMobile: false } },
      ]
    : [{ name: "phone", use: { browserName: "chromium" } }],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/grooph/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
