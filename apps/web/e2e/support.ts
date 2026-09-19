import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import {
  buildShareEnvelope,
  encodeSharePayload,
  isCandidateFile,
  parseGraphText,
  parseProposalSetText,
  type Graph,
  type ProposalSet,
} from "@grooph/core";
import { expect, type Download, type Locator, type Page } from "@playwright/test";

export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
export const fixturePath = join(repoRoot, "fixtures/valid/review-loop.grooph.json");
export const goldenDir = join(repoRoot, "fixtures/golden/claude-code/review-loop");

export function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(dir, full).split("\\").join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
}

/** Import a document through the library's file control, as the owner would. */
export async function importDocument(page: Page, name: string, text: string): Promise<void> {
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("button", { name: /^Validation:/ })).toBeVisible();
}

export const status = (page: Page): Locator => page.getByRole("button", { name: /^Validation:/ });
export const toolbar = (page: Page): Locator => page.getByRole("toolbar", { name: "Canvas" });
export const sheet = (page: Page): Locator => page.locator("aside.sheet");
export const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`);
export const edgeLabel = (page: Page, id: string): Locator => page.locator(`.gedge-label[data-edge-id="${id}"]`);

export async function closeSheet(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "Close panel" });
  if (await close.isVisible()) await close.tap();
}

export async function fit(page: Page): Promise<void> {
  await toolbar(page).getByRole("button", { name: "Fit" }).tap();
  await page.waitForTimeout(350);
}

export async function downloadText(download: Download): Promise<string> {
  return readFileSync((await download.path())!, "utf8");
}

export async function downloadBytes(download: Download): Promise<Uint8Array> {
  return new Uint8Array(readFileSync((await download.path())!));
}

/* ─── share links (slice 0006) ──────────────────────────────────────────── */

export const csvSetDir = join(repoRoot, "fixtures/proposals/valid/csv-export");

/** The three-candidate rehearsal set with its `{ file }` candidates inlined, as `grooph share` sends it. */
export function csvSet(): ProposalSet {
  const set = parseProposalSetText(readFileSync(join(csvSetDir, "csv-export.grooph-proposals.json"), "utf8")).set!;
  return {
    ...set,
    candidates: set.candidates.map((c) =>
      isCandidateFile(c.graph) ? { ...c, graph: parseGraphText(readFileSync(join(csvSetDir, c.graph.file), "utf8")).doc! } : c,
    ),
  };
}

export const reviewLoop = (): Graph => parseGraphText(readFileSync(fixturePath, "utf8")).doc!;

/** The app-relative link `grooph share` would print: core's envelope, zlib raw DEFLATE, as the CLI does it. */
export const linkFor = (doc: Graph | ProposalSet): string =>
  `./#/open?d=${encodeSharePayload(buildShareEnvelope(doc), (bytes) => deflateRawSync(bytes, { level: 9 }))}`;

export const pager = (page: Page): Locator => page.locator(".pager-count");
