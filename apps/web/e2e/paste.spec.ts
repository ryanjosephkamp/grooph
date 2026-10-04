import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { deflateRawSync } from "node:zlib";

import { fixturePath, node, sheet, status } from "./support.js";

/**
 * Handoff 0078: wherever Import is offered, a person can also paste a graph's JSON. That is the way in
 * every chat has: the chat writes the document, the person copies it, the app checks it.
 *
 * What opens a document, from a file or from a paste, is a piece of its own (src/ui/Import.tsx), fetched when a
 * person asks for it and not with the page. The last three tests here are about that door.
 */

const doc = readFileSync(fixturePath, "utf8");

const paste = async (page: import("@playwright/test").Page, text: string): Promise<void> => {
  await page.getByRole("button", { name: "Paste a document" }).tap();
  await page.getByLabel(/A graph's JSON/).fill(text);
  await page.getByRole("button", { name: "Open it" }).tap();
};

test("a document pasted as a chat gives it, fence and sentences included, opens in the editor and is kept", async ({ page }) => {
  await page.goto("./");
  await paste(page, `Here is the graph. Paste it into grooph:\n\n\`\`\`json\n${doc}\`\`\`\n\nIt has one loop of at most four rounds.`);
  await expect(status(page)).toHaveText("1 warning");
  await page.getByRole("button", { name: /^Review loop/ }).tap();
  await expect(sheet(page).getByLabel("Id", { exact: true })).toHaveValue("review-loop");

  // It is on the device like an imported file.
  await page.goto("./");
  await expect(page.getByRole("list", { name: "Graphs on this device" }).getByRole("listitem")).toHaveCount(1);
  // The control is there beside Import on the library too, not only on the front page.
  await expect(page.getByRole("button", { name: "Paste a document" })).toBeVisible();
});

test("pasted text that holds no document is refused with the reason, and the text stays to be mended", async ({ page }) => {
  await page.goto("./");
  await paste(page, "make me a graph please");
  await expect(page.getByRole("alert")).toContainText("Could not import what you pasted.");
  await expect(page.getByRole("alert")).toContainText("no JSON document and no grooph link was found");
  await expect(page.getByLabel(/A graph's JSON/)).toHaveValue("make me a graph please");

  // JSON that is not a graph: the same list of issues a file gets, by code.
  await page.getByLabel(/A graph's JSON/).fill('{ "grooph": 0, "id": "Not An Id" }');
  await page.getByRole("button", { name: "Open it" }).tap();
  await expect(page.getByRole("alert")).toContainText("E_SCHEMA");
  await expect(page.getByLabel(/A graph's JSON/)).toHaveValue('{ "grooph": 0, "id": "Not An Id" }');
  await expect(page.getByRole("list", { name: "Graphs on this device" })).toHaveCount(0);

  // Cancel closes the box.
  await page.getByRole("button", { name: "Cancel" }).tap();
  await expect(page.getByLabel(/A graph's JSON/)).toHaveCount(0);
});

test("a pasted grooph link opens what it carries, read-only, as the link itself would", async ({ page }) => {
  const envelope = JSON.stringify({ v: 1, kind: "graph", doc: JSON.parse(doc) as unknown });
  const payload = deflateRawSync(Buffer.from(envelope), { level: 9 }).toString("base64url");
  await page.goto("./");
  await paste(page, `Open this one: https://ryanjosephkamp.github.io/grooph/#/open?d=${payload} (the lean candidate)`);
  await expect(page).toHaveURL(new RegExp(`#/open\\?d=${payload}$`));
  await expect(page.getByRole("button", { name: /Save to this device/ })).toBeVisible();
});

test("a paste on the screen itself, with no box open, opens a document and ignores anything else", async ({ page }) => {
  await page.goto("./");
  const send = (text: string): Promise<void> =>
    page.evaluate((t) => {
      const data = new DataTransfer();
      data.setData("text/plain", t);
      // A real paste is aimed at the focused element, or the body when nothing is focused, and bubbles to the window.
      document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, text);
  await send("just some words from somewhere else");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await send(doc);
  await expect(status(page)).toHaveText("1 warning");
});

const piece = /\/assets\/Import-[^/]+\.js$/;

test("what opens a document is not fetched with the page: it is fetched when someone opens the box or picks a file", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => {
    if (piece.test(r.url())) asked.push(r.url());
  });
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Paste a document" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(asked, "asked for by the front page").toEqual([]);

  // Opening the box fetches it, once, and a document pasted then opens.
  await paste(page, doc);
  await expect(status(page)).toHaveText("1 warning");
  expect(asked).toHaveLength(1);

  // A visit that never opens the box and picks a file fetches the same piece.
  asked.length = 0;
  await page.goto("./");
  await page.reload();
  await expect(page.getByRole("button", { name: "Paste a document" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(asked, "asked for by the library").toEqual([]);
  await page.locator('input[type="file"]').setInputFiles({ name: "again.grooph.json", mimeType: "application/json", buffer: Buffer.from(doc) });
  await expect(status(page)).toHaveText("1 warning");
  expect(asked).toHaveLength(1);
});

test("when the piece cannot be fetched, Paste and Import each say so in plain words, and a reload with a connection mends it", async ({ page }) => {
  // A first visit that lost its connection before the worker held the file: every later visit has it from the worker.
  await page.route(piece, (route) => route.abort("internetdisconnected"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");

  await page.getByRole("button", { name: "Paste a document" }).tap();
  await expect(page.getByRole("alert")).toContainText("Could not import what you paste. The part of grooph that opens it could not be fetched. It needs a connection the first time: reload this page when you have one.");
  await expect(page.getByLabel(/A graph's JSON/)).toHaveCount(0);

  await page.locator('input[type="file"]').setInputFiles({ name: "review-loop.grooph.json", mimeType: "application/json", buffer: Buffer.from(doc) });
  await expect(page.getByRole("alert")).toContainText("Could not import review-loop.grooph.json. The part of grooph that opens it could not be fetched.");
  await expect(page.getByRole("button", { name: "Paste a document" })).toBeVisible();

  // A paste on the screen itself is quiet about it: the person did not ask for anything by name.
  await page.getByRole("button", { name: "Dismiss" }).tap();
  await page.evaluate((t) => {
    const data = new DataTransfer();
    data.setData("text/plain", t);
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, doc);
  await page.waitForTimeout(300);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);

  // The connection is back. Chromium does not ask again for a script it failed to fetch until the page is loaded
  // again, which is why the sentence says to reload; after that the same button fetches the piece and the paste opens.
  await page.unroute(piece);
  await page.reload();
  await paste(page, doc);
  await expect(status(page)).toHaveText("1 warning");
});

test.describe("with the service worker running", () => {
  // Every other test here blocks service workers, so it tests the files as built; this one lets the worker run, as
  // `offline.spec.ts` does.
  test.use({ serviceWorkers: "allow" });

  test("after a visit that saw only the front page, a paste opens with no network: the worker kept the piece", async ({ page, context }) => {
    // No address asks for the piece, but the page names it, and the worker keeps what a page names. (`offline.spec.ts`
    // picks a file with no network, in its test of the exporter: that goes through the same piece.)
    await page.goto("./");
    await expect(page.locator(".land-headline")).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    expect(await page.evaluate(() => performance.getEntriesByType("resource").some((e) => /\/assets\/Import-/.test(e.name)))).toBe(false);

    await context.setOffline(true);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(r.url()));
    await page.reload();
    await paste(page, `Here it is:\n\n\`\`\`json\n${doc}\`\`\`\n`);
    await expect(node(page, "builder")).toBeVisible();
    // The front page's own pictures are not the worker's to keep; every script and style is.
    expect(failed.filter((url) => url.includes("/assets/"))).toEqual([]);
  });
});
