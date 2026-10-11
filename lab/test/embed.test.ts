/**
 * `embed` of a run folder: the run-folder half of the product's "a run folder and an operation map embed too"
 * (packages/cli/test/embed.test.ts), moved when reading a run folder left the product for the lab (slice 0103).
 * The lab's command reads the folder into a bundle and hands it to the product's `embed`. The frame's address is
 * decoded with core's own decoder and the product's zlib codec, so what is asserted is what the app will receive.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { decodeSharePayload } from "@grooph/core";

import type { Output } from "@grooph/cli/print";
import { inflateRaw } from "@grooph/cli/share-io";

import { run } from "../src/index.js";
import { root as repoRoot } from "./root.js";

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};

async function embed(file: string, ...flags: string[]) {
  const io = capture();
  const code = await run(["embed", file, ...flags], io);
  const frame = io.stdout[0] ?? "";
  const src = (/ src="([^"]+)"/.exec(frame)?.[1] ?? "").replace(/&amp;/g, "&");
  const payload = /#\/embed\?d=([A-Za-z0-9_-]+)/.exec(src)?.[1] ?? "";
  return { io, code, frame, src, payload };
}

test("a run folder embeds too", async () => {
  const folder = await embed(join(repoRoot, "fixtures/runs/run-gate/runs/20260919-1200-gate"));
  assert.equal(folder.code, 0, folder.io.stderr.join("\n"));
  assert.equal((decodeSharePayload(folder.payload, inflateRaw) as { envelope: { kind: string } }).envelope.kind, "run");
});
