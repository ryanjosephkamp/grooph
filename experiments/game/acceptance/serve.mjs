#!/usr/bin/env node
/**
 * Serves a folder of static files on this machine, for the held-out checks: the game's built files, or the stand-ins.
 *
 *   node experiments/game/acceptance/serve.mjs <folder> [--port <n>]
 *
 * It answers only on 127.0.0.1, sends no caching headers that would outlive a visit, and stops with Ctrl-C.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".wasm": "application/wasm", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".wav": "audio/wav", ".ogg": "audio/ogg", ".woff2": "font/woff2" };

/** Starts the server; resolves with its address and a way to stop it. */
export function serve(folder, port = 0) {
  const base = resolve(folder);
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
    let file = join(base, path);
    if (file !== base && !file.startsWith(base + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(readFileSync(file));
  });
  return new Promise((done) => {
    server.listen(port, "127.0.0.1", () => done({ url: `http://127.0.0.1:${server.address().port}/`, stop: () => new Promise((closed) => server.close(closed)) }));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--port");
  if (!folder || !existsSync(folder)) {
    console.error("usage: node experiments/game/acceptance/serve.mjs <folder> [--port <n>]");
    process.exit(2);
  }
  const { url } = await serve(folder, Number(args.includes("--port") ? args[args.indexOf("--port") + 1] : 4361));
  console.log(`serving ${resolve(folder)} at ${url}`);
}
