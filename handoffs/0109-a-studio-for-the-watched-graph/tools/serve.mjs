#!/usr/bin/env node
/**
 * Serve the watching studio on this machine, on the slice's own port (4370), to look at it or to take its pictures.
 *
 *   node handoffs/0109-a-studio-for-the-watched-graph/tools/serve.mjs      then http://localhost:4370/ and /2
 *
 * The page in the repository begins at its <title>, as every brief does: the place it is published wraps it in a
 * document. This does the same, and reads the file again at every request, so a rebuild shows on a reload.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const briefs = join(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."), "handoffs", "briefs");
/** `/` is the first page, `/2` the second (round two). */
const PAGES = { "/": "studio-watching.html", "/2": "studio-watching-2.html" };
const PORT = 4370;
createServer((req, res) => {
  const file = PAGES[new URL(req.url, "http://localhost").pathname];
  if (!file) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${readFileSync(join(briefs, file), "utf8")}</body></html>`);
}).listen(PORT, "127.0.0.1", () => console.log(`the watching studio: http://localhost:${PORT}/ and http://localhost:${PORT}/2`));
