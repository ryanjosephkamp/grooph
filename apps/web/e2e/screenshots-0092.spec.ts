import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, parseMapText } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { linkFor, repoRoot, runBundle } from "./support.js";
import { desktop } from "./support-alive.js";

/**
 * Handoff 0092: a loop graph in three dimensions, on three built-in templates, at a phone's width and at 1440,
 * light and dark. Made only on request, into the slice folder:
 *
 *   GROOPH_SHOTS=0092 GROOPH_E2E_PORT=4365 pnpm --filter @grooph/web exec playwright test e2e/screenshots-0092.spec.ts
 *
 * And, with `GROOPH_SHOTS=0092-switch`, every frame the browser paints while Picture is changed for 3D and back, on
 * a map and on a graph, at a phone's width with the processor slowed four times: `switch-<page>-phone-<n>-<when>.jpg`.
 */
const SHOTS = process.env["GROOPH_SHOTS"];
test.skip(SHOTS !== "0092" && SHOTS !== "0092-switch", "screenshots are made on request (GROOPH_SHOTS=0092 or 0092-switch)");

const dir = join(repoRoot, "handoffs/0092-a-graph-in-three-dimensions/shots");
const TEMPLATES = ["review-gate", "grind-loop", "gauntlet-decomposed"];

const SWITCHED: Record<string, () => string> = {
  map: () => `./#/open?d=${encodeSharePayload(buildShareEnvelope(parseMapText(readFileSync(join(repoRoot, "handoffs/briefs/plan-2026-10-04/build.grooph-map.json"), "utf8")).map!), (bytes) => deflateRawSync(bytes, { level: 9 }))}`,
  graph: () => "./#/templates/built-in/review-gate",
  run: () => linkFor(runBundle("slice-0007-sandwich")),
};
for (const [name, address] of Object.entries(SWITCHED)) {
  test.describe(`the switch on a ${name}`, () => {
    test.skip(SHOTS !== "0092-switch", "the frames of the switch are made with GROOPH_SHOTS=0092-switch");
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    test(`the frames of the switch on a ${name}`, async ({ page }) => {
      await page.goto(address());
      await expect(page.getByRole("radio", { name: "3D" })).toBeVisible();
      await page.waitForTimeout(1200);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const frames: { at: number; data: string }[] = [];
      cdp.on("Page.screencastFrame", (frame) => {
        frames.push({ at: frame.metadata.timestamp! * 1000, data: frame.data });
        void cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId });
      });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
      await page.waitForTimeout(300);
      const pressed: [string, number][] = [];
      for (const press of ["3D", "Picture"]) {
        pressed.push([press === "3D" ? "3d" : "picture", Date.now()]);
        await page.getByRole("radio", { name: press }).click();
        await page.waitForTimeout(1500);
      }
      await cdp.send("Page.stopScreencast");
      frames.forEach((frame, k) => {
        const when = [...pressed].reverse().find(([, at]) => at <= frame.at)?.[0] ?? "start";
        writeFileSync(join(dir, `switch-${name}-phone-${k + 1}-${when}.jpg`), Buffer.from(frame.data, "base64"));
      });
    });
  });
}

for (const size of ["phone", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${size}, ${scheme}`, () => {
      test.skip(SHOTS !== "0092", "the pictures of the views are made with GROOPH_SHOTS=0092");
      test.use({ colorScheme: scheme, ...(size === "desktop" ? desktop : { deviceScaleFactor: 1.5 }) });
      const shot = (page: Page, name: string) => page.screenshot({ path: join(dir, `${name}-${size}-${scheme}.jpg`), type: "jpeg", quality: 60 });
      test(`a recorded run ${size} ${scheme}`, async ({ page }) => {
        await page.goto(linkFor(runBundle("slice-0007-sandwich")));
        await expect(page.locator(".react-flow__node").first()).toBeVisible();
        await page.getByRole("radio", { name: "3D" }).click();
        await expect(page.locator(".space-scene")).toBeVisible();
        await expect.poll(() => page.locator(".space-world").evaluate((el) => (el as HTMLElement).style.transform)).toContain("scale3d(");
        await page.waitForTimeout(300);
        await shot(page, "space-run");
        // The run replayed: its eighth note, which is about an edge.
        await page.getByRole("slider").fill("8");
        await page.waitForTimeout(300);
        await shot(page, "space-run-note-8");
      });
      for (const id of TEMPLATES) {
        test(`${id} ${size} ${scheme}`, async ({ page }) => {
          await page.goto(`./#/templates/built-in/${id}`);
          await page.getByRole("radio", { name: "3D" }).click();
          await expect(page.locator(".space-scene")).toBeVisible();
          await expect.poll(() => page.locator(".space-world").evaluate((el) => (el as HTMLElement).style.transform)).toContain("scale3d(");
          await page.waitForTimeout(300);
          await shot(page, `space-${id}`);
          if (id === "grind-loop" && scheme === "light") {
            const steps = Number(await page.getByRole("slider").getAttribute("max"));
            await page.getByRole("slider").fill(String(steps));
            await page.waitForTimeout(300);
            await shot(page, `space-${id}-last-step`);
          }
        });
      }
    });
  }
}
