import { join } from "node:path";

import { canonicalize } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { bundleText, linkFor, repoRoot, runBundle } from "./support.js";
import { AT, desktop, eventsOf, httpsSite, mapNamed, patternRun, sampleMap, sessionsView, stubSessions, viewOf } from "./support-alive.js";

/**
 * Handoff 0062, criteria 1 and 9: the map, the live view and a run, at phone
 * and desktop size, light and dark. Made only on request, into the slice
 * folder, under the name given (`before` or `after`):
 *
 *   GROOPH_SHOTS=after GROOPH_E2E_PORT=4351 pnpm --filter @grooph/web exec playwright test e2e/screenshots-0062.spec.ts
 *
 * With `GROOPH_WATCH=http://127.0.0.1:<port>/grooph/` it also shoots the live
 * view as a real `grooph watch --sessions --events demo=fixtures/events` serves it.
 */
const phase = process.env["GROOPH_SHOTS"];
test.skip(phase !== "before" && phase !== "after", "screenshots are made on request (GROOPH_SHOTS=before or after)");

const dir = join(repoRoot, "handoffs/0062-map-live-run/shots");

for (const size of ["phone", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      const wide = size === "desktop";
      test.use({ colorScheme: scheme, ...(wide ? desktop : { deviceScaleFactor: 1.5 }) });
      const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `${phase}-${name}-${size}-${scheme}.png`) });
      const press = (page: Page, selector: string) => (wide ? page.locator(selector).click() : page.locator(selector).tap());

      test(`map ${size} ${scheme}`, async ({ page }) => {
        await page.goto(linkFor(sampleMap() as never));
        await expect(page.locator(".map-picture svg")).toBeVisible();
        await page.waitForTimeout(300);
        await shot(page, "map");
        await press(page, '[data-session="operator"]');
        await page.waitForTimeout(300);
        await shot(page, "map-session");
        if (scheme === "light") {
          await press(page, '[data-number="h-brief-grooph"]');
          await page.waitForTimeout(700);
          await shot(page, "map-handoff");
        }
      });

      test(`live ${size} ${scheme}`, async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (m) => (m.type() === "error" ? errors.push(m.text()) : undefined));

        // No grooph watch behind the page: the public site, which answers the sessions endpoint with a 404.
        const site = await httpsSite(page);
        await page.goto(`${site}#/live`);
        await page.waitForTimeout(2_600);
        await shot(page, "live-none");
        console.log(`[0062 ${phase}] live view on a site with no watch, ${size} ${scheme}: ${errors.length} console error(s)${errors.length ? `, the first: ${errors[0]}` : ""}`);

        // Sessions in every state.
        await stubSessions(page, sessionsView());
        await page.goto("./#/live");
        await expect(page.locator(".live-session").first()).toBeVisible();
        await page.waitForTimeout(300);
        await shot(page, "live");

        // With an operation map.
        if (scheme === "light") {
          await page.unroute("**/grooph/api/live.json");
          const named = [...eventsOf("claude-code-running.jsonl", "operator"), ...eventsOf("codex-two-subagents.jsonl", "codex"), ...eventsOf("claude-code-planned.jsonl", "grooph")];
          await stubSessions(page, { ...viewOf(named, AT), map: mapNamed("owner-operation-2026-09-30.grooph-map.json") });
          await page.goto("./");
          await page.goto("./#/live");
          await expect(page.locator(".live-map svg")).toBeVisible();
          await page.waitForTimeout(300);
          await shot(page, "live-map");
        }

        // As a real grooph watch serves the recordings, read today: every one of them is over or long silent.
        const watch = process.env["GROOPH_WATCH"];
        if (watch) {
          await page.unroute("**/grooph/api/live.json");
          await page.goto(`${watch}#/live`);
          await expect(page.locator(".live-session").first()).toBeVisible();
          await page.waitForTimeout(300);
          await shot(page, "live-watch");
        }
      });

      test(`run ${size} ${scheme}`, async ({ page }) => {
        // A stored run: the source graph, then the run's bundle, through the library's file control.
        const stored = patternRun("fresh-grind-rare-judge");
        await page.goto("./");
        await page.locator('input[type="file"]').setInputFiles({ name: `${stored.source.id}.grooph.json`, mimeType: "application/json", buffer: Buffer.from(canonicalize(stored.source)) });
        await expect(page.getByRole("button", { name: /^Validation:/ })).toBeVisible();
        await page.goto("./");
        await page.locator('input[type="file"]').setInputFiles({ name: `${stored.run}.grooph-run.json`, mimeType: "application/json", buffer: Buffer.from(bundleText(stored)) });
        await expect(page.locator(".title-sub")).toContainText("on this device");
        await expect(page.locator(".run-badge").first()).toBeVisible();
        await page.waitForTimeout(600);
        await shot(page, "run-stored");

        // A run halted at a gate, from a link.
        if (scheme === "light") {
          await page.goto(linkFor(patternRun("review-gate")));
          await expect(page.locator(".run-badge").first()).toBeVisible();
          await page.waitForTimeout(600);
          await shot(page, "run-halted");
        }

        // A live run with a node running, as grooph watch serves it. Motion is stilled so the shot is the same each time.
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: scheme });
        await page.route("**/grooph/api/run.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: bundleText(runBundle("run-live")) }));
        await page.goto("./#/run?live");
        await expect(page.locator(".run-badge").first()).toBeVisible();
        await page.waitForTimeout(600);
        await shot(page, "run-live");
      });
    });
  }
}
