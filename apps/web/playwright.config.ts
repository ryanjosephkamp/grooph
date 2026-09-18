import { defineConfig } from "@playwright/test";

/**
 * Browser tests at phone size with touch, against the production build served
 * under the GitHub Pages base path (`/grooph/`), so the path the owner's phone
 * loads is the path under test.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173/grooph/",
    viewport: { width: 400, height: 800 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone", use: { browserName: "chromium" } }],
  webServer: {
    command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/grooph/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
