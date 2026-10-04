import { expect, test, type Page } from "@playwright/test";

/** A probe, not a test to keep: what WebKit does with the service worker when Playwright says "offline". */
const say = (label: string, value: unknown): void => console.log(`PROBE ${test.info().project.name} | ${label} | ${JSON.stringify(value)}`);
const attempt = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
  try {
    say(label, (await fn()) ?? "ok");
  } catch (error) {
    say(label, `THREW ${(error as Error).message.split("\n")[0]}`);
  }
};

async function firstVisit(page: Page): Promise<string> {
  await page.goto("./");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect.poll(() => page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => /\/assets\/screens-[^/]*\.js$/.test(r.url)).length)).toBe(1);
  return page.evaluate(async () => (await (await caches.open("grooph-app-v1")).keys()).map((r) => r.url).find((u) => /\/assets\/index-[^/]*\.js$/.test(u))!);
}

const fetchIn = (page: Page, url: string) =>
  page.evaluate(async (u) => {
    try {
      const r = await fetch(u, { cache: "no-store" });
      return `${r.status} ${(await r.text()).length} bytes`;
    } catch (e) {
      return `fetch threw ${(e as Error).message}`;
    }
  }, url);

test.describe("worker allowed", () => {
  test.use({ serviceWorkers: "allow" });

  test("A: setOffline, then fetches from the page", async ({ page, context }) => {
    const asset = await firstVisit(page);
    say("onLine before", await page.evaluate(() => navigator.onLine));
    await context.setOffline(true);
    say("onLine after", await page.evaluate(() => navigator.onLine));
    await attempt("fetch ./ (network first, then cache)", () => fetchIn(page, "./"));
    await attempt("fetch hashed asset (cache first)", () => fetchIn(page, asset));
    await attempt("fetch a file the worker never saw", () => fetchIn(page, "./patterns/index.json"));
  });

  test("B: setOffline, then navigations", async ({ page, context }) => {
    await firstVisit(page);
    await context.setOffline(true);
    await attempt("page.goto ./", async () => (await page.goto("./"))?.status());
    await attempt("h1 after goto", async () => page.getByRole("heading", { name: "grooph", level: 1 }).isVisible());
    await attempt("page.reload", async () => (await page.reload())?.status());
    await attempt("location.reload then h1", async () => {
      await page.evaluate(() => location.reload());
      await expect(page.getByRole("heading", { name: "grooph", level: 1 })).toBeVisible({ timeout: 5000 });
      return "h1 visible";
    });
    await attempt("hash change to a template, then node", async () => {
      await page.evaluate(() => (location.hash = "#/templates/built-in/review-gate"));
      await expect(page.locator('.react-flow__node[data-id="builder"]')).toBeVisible({ timeout: 5000 });
      return "builder visible";
    });
  });

  test("C: every request aborted by a route instead of setOffline", async ({ page, context }) => {
    await firstVisit(page);
    const aborted: string[] = [];
    await context.route("**/*", (route) => {
      aborted.push(`${route.request().isNavigationRequest() ? "NAV " : ""}${new URL(route.request().url()).pathname}`);
      return route.abort("internetdisconnected");
    });
    await attempt("page.goto ./", async () => (await page.goto("./"))?.status());
    await attempt("h1 after goto", async () => {
      await expect(page.getByRole("heading", { name: "grooph", level: 1 })).toBeVisible({ timeout: 5000 });
      return "h1 visible";
    });
    await attempt("template address, reload, node", async () => {
      await page.goto("./#/templates/built-in/review-gate");
      await page.reload();
      await expect(page.locator('.react-flow__node[data-id="builder"]')).toBeVisible({ timeout: 5000 });
      return "builder visible";
    });
    say("requests the route saw and aborted", aborted);
  });
});

test("D: setOffline with the worker blocked, for the error a plain offline navigation gives", async ({ page, context }) => {
  await page.goto("./");
  await context.setOffline(true);
  await attempt("page.goto ./", async () => (await page.goto("./"))?.status());
});
