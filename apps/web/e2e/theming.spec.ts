import { picture, mapPicture, parseMapText, type OperationMap } from "@grooph/core";
import { themed } from "@grooph/core/themes";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot, reviewLoop } from "./support.js";

/**
 * A page that holds a picture inline restyles it with its own CSS (docs/exports.md, "Theming"): a rule that names
 * the picture beats the picture's own style sheet in light and in dark, whether it stands before the picture or
 * after it, and a picture the rule does not name keeps its own colors.
 */
const map: OperationMap = parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/a-small-studio.grooph-map.json"), "utf8")).map!;
const OURS = "#7c3aed";
const ACCENT = { light: "#1f5f4a", dark: "#5dbb94" } as const;

const accentOf = (page: Page, selector: string): Promise<string> => page.locator(selector).evaluate((el) => getComputedStyle(el).getPropertyValue("--gp-accent").trim());

for (const scheme of ["light", "dark"] as const) {
  test(`a page's rule restyles an inline picture in ${scheme}, before the picture or after it, and leaves the others alone`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const rule = `<style>.notes .grooph-picture{--gp-accent:${OURS}}.notes .grooph-picture [data-node="critic"] rect[data-card]{stroke-width:3px}</style>`;
    for (const [before, after] of [
      [rule, ""],
      ["", rule],
    ]) {
      await page.setContent(`<!doctype html>${before}<div class="notes">${picture(reviewLoop())}</div><div class="other">${mapPicture(map)}</div>${after}`);
      expect(await accentOf(page, ".notes svg")).toBe(OURS);
      // What is drawn takes it: an agent's mark is filled with the accent.
      const fill = await page.locator('.notes [data-node="builder"] circle').first().evaluate((el) => getComputedStyle(el).fill);
      expect(fill).toBe("rgb(124, 58, 237)");
      expect(await page.locator('.notes [data-node="critic"] rect[data-card]').evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("3px");
      expect(await accentOf(page, ".other svg")).toBe(ACCENT[scheme]);
    }
    // Held to one form by data-theme, the picture still takes the page's rule.
    await page.setContent(`<!doctype html>${rule}<div class="notes">${picture(reviewLoop()).replace('class="grooph-picture"', 'class="grooph-picture" data-theme="dark"')}</div>`);
    expect(await accentOf(page, ".notes svg")).toBe(OURS);
  });
}

test("a picture in a theme keeps the theme's colors against Paper's, and takes a page's rule as specific as the theme's", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const ink = themed(picture(reviewLoop()), "ink");
  await page.setContent(`<!doctype html><div class="a">${picture(reviewLoop())}</div><div class="b">${ink}</div>`);
  expect(await accentOf(page, ".a svg")).toBe(ACCENT.dark);
  expect(await accentOf(page, ".b svg")).not.toBe(ACCENT.dark);
  await page.setContent(`<!doctype html><div class="b">${ink}</div><style>.b .grooph-picture[data-look]:not([data-theme="light"]){--gp-accent:${OURS}}</style>`);
  expect(await accentOf(page, ".b svg")).toBe(OURS);
});
