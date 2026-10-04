import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { deflateRawSync } from "node:zlib";

import { fixturePath, sheet, status } from "./support.js";

/**
 * Handoff 0078: wherever Import is offered, a person can also paste a graph's JSON. That is the way in
 * every chat has: the chat writes the document, the person copies it, the app checks it.
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
