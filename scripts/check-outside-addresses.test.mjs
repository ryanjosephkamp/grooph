/**
 * The outside-addresses check, held against made-up pages and then run for real on a made-up built site.
 * Run with `node --test scripts/check-outside-addresses.test.mjs`.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { cssAddresses, judge, manifestAddresses, markupAddresses, outsideHost, scriptAddresses } from "./check-outside-addresses.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "check-outside-addresses.mjs");
const OWN = ["https://ryanjosephkamp.github.io/grooph/"];
const NONE = {};
const loadsOf = (markup) => markupAddresses(markup).loads.map((load) => `${load.what} ${load.address}`);

test("which address is on another host", () => {
  for (const own of ["assets/app.js", "./demo/run.txt", "/grooph/favicon.svg", "#/templates", "data:image/png;base64,AAAA", "blob:abc", "mailto:a@b.example"]) {
    assert.equal(outsideHost(own, OWN), undefined, own);
  }
  assert.equal(outsideHost("https://ryanjosephkamp.github.io/grooph/og.png", OWN), undefined);
  assert.equal(outsideHost("https://ryanjosephkamp.github.io/grooph", OWN), undefined);
  // The origin said bare, as a page says it when it asks who sent a message; another project on the same host is not this site.
  assert.equal(outsideHost("https://ryanjosephkamp.github.io", OWN), undefined);
  assert.equal(outsideHost("https://ryanjosephkamp.github.io/other/x.js", OWN), "ryanjosephkamp.github.io");
  assert.equal(outsideHost("https://fonts.googleapis.com/css2?family=Inter", OWN), "fonts.googleapis.com");
  assert.equal(outsideHost("//cdn.example.com/x.js", OWN), "cdn.example.com");
  assert.equal(outsideHost("wss://Live.Example.com:8443/socket", OWN), "live.example.com");
  assert.equal(outsideHost("https://user@tracker.example/p", OWN), "tracker.example");
  for (const here of ["http://localhost:4174/grooph/", "http://127.0.0.1:4174/api/live.json"]) assert.equal(outsideHost(here, OWN), undefined, here);
});

test("in a page, what loads is told from what links", () => {
  assert.deepEqual(
    loadsOf(`<!doctype html><html><head>
      <link rel="stylesheet" href="https://fonts.example/a.css">
      <link rel="preconnect" href="https://fonts.example">
      <link rel="canonical" href="https://elsewhere.example/page/">
      <link rel="icon" href="/favicon.svg">
      <script type="module" src="https://cdn.example/app.js"></script>
      <base href="https://base.example/">
      </head><body>
      <a href="https://github.com/ryanjosephkamp/grooph" rel="noopener">Source</a>
      <a href="https://linked.example/" ping="https://counter.example/hit">Out</a>
      <img src="https://img.example/a.png" srcset="https://img.example/a2.png 2x, small.png 1x">
      <iframe src="https://frame.example/"></iframe>
      <video poster="https://video.example/p.jpg"><source src="clip.mp4"></video>
      <object data="https://object.example/x"></object>
      <form action="https://forms.example/send"><button formaction="https://forms.example/other">Go</button></form>
      <p style="background: url('https://style.example/bg.png')">text</p>
      </body></html>`),
    [
      '<link href rel="stylesheet"> https://fonts.example/a.css',
      '<link href rel="preconnect"> https://fonts.example',
      '<link href rel="icon"> /favicon.svg',
      "<script src> https://cdn.example/app.js",
      "<base href> https://base.example/",
      "<a ping> https://counter.example/hit",
      "<img src> https://img.example/a.png",
      "<img srcset> https://img.example/a2.png",
      "<img srcset> small.png",
      "<iframe src> https://frame.example/",
      "<video poster> https://video.example/p.jpg",
      "<source src> clip.mp4",
      "<object data> https://object.example/x",
      "<form action> https://forms.example/send",
      "<button formaction> https://forms.example/other",
      "<p style> url() https://style.example/bg.png",
    ],
  );
});

test("a page that sends the browser on by itself, a style block, a comment and a code block", () => {
  assert.deepEqual(loadsOf('<meta http-equiv="refresh" content="0; url=https://moved.example/">'), ['<meta http-equiv="refresh"> https://moved.example/']);
  assert.deepEqual(loadsOf('<style>@import "https://fonts.example/a.css"; body { background: url(bg.png) }</style>'), ["<style> url() bg.png", "<style> @import https://fonts.example/a.css"]);
  assert.deepEqual(loadsOf('<!-- <script src="https://old.example/x.js"></script> -->'), []);
  // A code block that shows a tag holds it escaped: it is text, and loads nothing.
  assert.deepEqual(loadsOf('<pre><code>&lt;iframe src="https://shown.example/"&gt;&lt;/iframe&gt;</code></pre>'), []);
  assert.deepEqual(loadsOf('<a href="https://a.example/?q=1&amp;r=2">an address with &amp; in it</a><img src="https://img.example/?a=1&amp;b=2">'), ["<img src> https://img.example/?a=1&b=2"]);
});

test("the text of a page's own scripts is handed on, and a script taken by address is a load", () => {
  const found = markupAddresses('<script>fetch("https://api.example/v1")</script><script src="assets/app.js"></script>');
  assert.deepEqual(found.scripts, ['fetch("https://api.example/v1")']);
  assert.deepEqual(found.loads, [{ what: "<script src>", address: "assets/app.js" }]);
});

test("in a picture, a link is a link and an image or a style sheet from elsewhere is a load", () => {
  assert.deepEqual(
    loadsOf(`<?xml-stylesheet href="https://sheets.example/a.css" type="text/css"?>
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <a xlink:href="https://linked.example/"><text>out</text></a>
      <image xlink:href="https://img.example/a.png"/><use href="#shape"/><feImage href="https://img.example/f.png"/>
      </svg>`),
    ["<?xml-stylesheet?> https://sheets.example/a.css", "<image xlink:href> https://img.example/a.png", "<use href> #shape", "<feimage href> https://img.example/f.png"],
  );
});

test("in CSS, every url(), @import and image-set() string, and no namespace or comment", () => {
  assert.deepEqual(
    cssAddresses(`@namespace svg url(http://www.w3.org/2000/svg);
      /* @import "https://commented.example/a.css"; */
      @import url("https://fonts.example/a.css");
      @import 'https://fonts.example/b.css' screen;
      @font-face { font-family: X; src: url(https://fonts.example/x.woff2) format("woff2"), url( 'local.woff2' ); }
      .a { background: image-set("https://img.example/1x.png" 1x, "big.png" 2x) }`).map((f) => `${f.what} ${f.address}`),
    [
      "url() https://fonts.example/a.css",
      "url() https://fonts.example/x.woff2",
      "url() local.woff2",
      "@import https://fonts.example/b.css",
      "image-set() https://img.example/1x.png",
      "image-set() big.png",
    ],
  );
});

test("in a script, an address written into a call that loads, in any kind of quotes", () => {
  const { calls } = scriptAddresses(
    'fetch("https://api.example/a");fetch(u);import(`https://cdn.example/m.js`);new WebSocket(\'wss://live.example/s\');navigator.sendBeacon("https://count.example/b",d);' +
      'importScripts("https://cdn.example/w.js");new EventSource("https://events.example/e");new Worker("worker.js");import{a}from"https://cdn.example/static.js";import"./side.js";',
  );
  assert.deepEqual(
    calls.map((c) => `${c.what} ${c.address}`),
    [
      "fetch() https://api.example/a",
      "import() https://cdn.example/m.js",
      "WebSocket() wss://live.example/s",
      "sendBeacon() https://count.example/b",
      "importScripts() https://cdn.example/w.js",
      "EventSource() https://events.example/e",
      "Worker() worker.js",
      "import https://cdn.example/static.js",
      "import ./side.js",
    ],
  );
});

test("in a script, every address it names, and nothing that only looks like one", () => {
  const { named } = scriptAddresses('var a=`https://reactflow.dev?utm_source=attribution`,b="http://www.w3.org/2000/svg",c="//cdn.example.com/x.js";var d=e//f.g/h\n;var i=1/2//comment.with.dots\n');
  assert.deepEqual(named, ["https://reactflow.dev?utm_source=attribution", "http://www.w3.org/2000/svg", "//cdn.example.com/x.js"]);
});

test("a manifest's icons", () => {
  assert.deepEqual(
    manifestAddresses(JSON.stringify({ name: "grooph", start_url: "./", icons: [{ src: "icon-192.png" }, { src: "https://icons.example/512.png" }], shortcuts: [{ icons: [{ src: "s.png" }] }] })).map((f) => f.address),
    ["icon-192.png", "https://icons.example/512.png", "s.png"],
  );
});

test("the judgment: a load is refused, a link is not, and the allow list lets through only what it names", () => {
  const page = { path: "apps/web/dist/index.html", text: '<link rel="stylesheet" href="https://fonts.example/a.css"><a href="https://github.com/x/y">y</a><script src="/grooph/assets/app.js"></script>' };
  const refused = judge([page], NONE, OWN);
  assert.deepEqual(refused.loads, ['apps/web/dist/index.html: <link href rel="stylesheet"> loads https://fonts.example/a.css']);
  assert.deepEqual(refused.stale, []);

  const allowed = judge([page], { "https://fonts.example/a.css": "the owner's word, 2026-10-05" }, OWN);
  assert.deepEqual(allowed.loads, []);
  assert.deepEqual(allowed.stale, []);
  // The allow list names an address, not a host: another file from the same host is still refused.
  const other = judge([{ path: "a.css", text: "@import 'https://fonts.example/b.css';" }], { "https://fonts.example/a.css": "allowed" }, OWN);
  assert.equal(other.loads.length, 1);
  assert.deepEqual(other.stale, ["the allow list has https://fonts.example/a.css, and nothing loads it"]);
});

test("the judgment: a script's links and names are listed and never fail; an address in a call that loads does", () => {
  // As the app's bundle holds them: a link in a footer, a namespace, the address in an error message.
  const app = { path: "apps/web/dist/assets/app.js", text: 'var links=[{label:`X`,href:`https://x.com/someone`}],ns="http://www.w3.org/2000/svg",err="https://react.dev/errors/"+code;' };
  const named = judge([app], NONE, OWN);
  assert.deepEqual(named.loads, []);
  assert.deepEqual(named.hosts, ["react.dev", "www.w3.org", "x.com"]);

  const fetching = judge([{ path: "app.js", text: 'fetch("https://x.com/api/count")' }], NONE, OWN);
  assert.deepEqual(fetching.loads, ["app.js: fetch() loads https://x.com/api/count"]);
  // Its own host and this machine are not another host, in a call or anywhere.
  assert.deepEqual(judge([{ path: "app.js", text: 'fetch("/grooph/api/live.json");fetch(`https://ryanjosephkamp.github.io/grooph/patterns/index.json`);fetch("http://127.0.0.1:4174/api/run.json")' }], NONE, OWN).loads, []);
});

test("the judgment: a style sheet's font, a manifest's icon and a page's own script are each read as what they are", () => {
  const { loads } = judge(
    [
      { path: "assets/styles.css", text: "@font-face{src:url(https://fonts.gstatic.example/x.woff2)}" },
      { path: "manifest.webmanifest", text: '{"icons":[{"src":"https://icons.example/a.png"}]}' },
      { path: "docs/index.html", text: '<script>new WebSocket("wss://live.example/s")</script>' },
      { path: "docs/poster.svg", text: '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://img.example/p.png"/></svg>' },
      { path: "notes.txt", text: 'fetch("https://not-read.example/")' },
    ],
    NONE,
    OWN,
  );
  assert.deepEqual(loads, [
    "assets/styles.css: url() loads https://fonts.gstatic.example/x.woff2",
    "manifest.webmanifest: manifest src loads https://icons.example/a.png",
    "docs/index.html: WebSocket() loads wss://live.example/s",
    "docs/poster.svg: <image href> loads https://img.example/p.png",
  ]);
});

/** A built app and rendered pages, made up, for the script to read in place of the real ones. */
function scratch(t, { index = '<script type="module" src="/grooph/assets/app.js"></script>', page = "<h1>Docs</h1>", record = { loads: {} }, script: js = "console.log(1)" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "grooph-outside-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const put = (path, text) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  if (index !== null) {
    put("dist/index.html", index);
    put("dist/assets/app.js", js);
  }
  if (page !== null) put("pages/index.html", page);
  if (record !== null) put("record.json", JSON.stringify(record));
  mkdirSync(join(dir, "dist"), { recursive: true });
  mkdirSync(join(dir, "pages"), { recursive: true });
  const run = () => spawnSync(process.execPath, [script, "--check", "--dist", join(dir, "dist"), "--pages", join(dir, "pages"), "--record", join(dir, "record.json")], { encoding: "utf8" });
  return { dir, run };
}

test("the check passes on a site that loads only its own files, and a link in its script does not fail it", (t) => {
  const done = scratch(t, { script: "var footer=[{label:`LinkedIn`,href:`https://www.linkedin.com/in/someone`}]" }).run();
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /nothing is loaded from another host/);
  assert.match(done.stdout, /the scripts name 1 outside host, as links, namespaces and names: www\.linkedin\.com/);
});

test("an allowed address passes, and an allowed address nothing loads is stale", (t) => {
  const index = '<link rel="stylesheet" href="https://fonts.example/a.css"><script src="assets/app.js"></script>';
  const allowed = scratch(t, { index, record: { loads: { "https://fonts.example/a.css": "the owner's word" } } }).run();
  assert.equal(allowed.status, 0, allowed.stderr);
  const stale = scratch(t, { record: { loads: { "https://fonts.example/a.css": "the owner's word" } } }).run();
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /the allow list has https:\/\/fonts\.example\/a\.css, and nothing loads it/);
});

test("the check fails on a font from another host, in the app or in a page, and says where", (t) => {
  const app = scratch(t, { index: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"><script src="assets/app.js"></script>' }).run();
  assert.equal(app.status, 1);
  assert.match(app.stderr, /apps\/web\/dist\/index\.html: <link href rel="stylesheet"> loads https:\/\/fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.match(app.stderr, /docs\/privacy\.md says nothing is/);

  const page = scratch(t, { page: '<style>@import "https://fonts.example/a.css";</style><h1>Docs</h1>' }).run();
  assert.equal(page.status, 1);
  assert.match(page.stderr, /docs\/index\.html: <style> @import loads https:\/\/fonts\.example\/a\.css/);
});

test("the check fails when there is nothing to read: no built app, no rendered page, no record", (t) => {
  const noApp = scratch(t, { index: null }).run();
  assert.equal(noApp.status, 1);
  assert.match(noApp.stderr, /the built app was not found/);
  const noPages = scratch(t, { page: null }).run();
  assert.equal(noPages.status, 1);
  assert.match(noPages.stderr, /no rendered page of the site was found/);
  const noRecord = scratch(t, { record: null }).run();
  assert.equal(noRecord.status, 1);
  assert.match(noRecord.stderr, /outside-addresses\.json is missing/);
});
