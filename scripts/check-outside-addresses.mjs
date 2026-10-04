#!/usr/bin/env node
/**
 * The privacy page says the app and the site's pages load nothing from another host (docs/privacy.md). This reads
 * what is built, the app in apps/web/dist and the documents as pages, and fails when one of them names an address
 * on another host as something to load. A link a person follows is not a load and never fails it.
 *
 *   node scripts/check-outside-addresses.mjs           say what was read and what was found
 *   node scripts/check-outside-addresses.mjs --check   exit 1 on a load from another host, or an allow list that is stale (CI)
 *
 * Needs the app built (`pnpm -r build`). The pages are rendered here, by scripts/site-pages.mjs, into a temporary folder.
 *
 * What it can tell exactly, and does:
 *   HTML and SVG   an address in `src`, `srcset`, `poster`, `data`, `background`, `action`, `formaction`, `ping`
 *                  or `manifest` on any tag; in `href` on the tags that load it (`link`, `base`, `script`, and
 *                  SVG's `image`, `use` and `feImage`); a page that sends the browser on by itself
 *                  (`<meta http-equiv="refresh">`); an `<?xml-stylesheet?>`. `<a href>` is a link.
 *   CSS            every `url(...)`, `@import` and `image-set(...)`, in a file, a `<style>` or a `style=""`.
 *   The manifest   every `src`.
 *   Scripts        an address written straight into a call that loads: fetch(), import(), importScripts(),
 *                  sendBeacon(), new WebSocket(), new EventSource(), new Worker(), new SharedWorker(), and a
 *                  module imported by address.
 *
 * What it cannot tell, and does not judge: whether a script asks for an address it holds in a variable. A script's
 * text does not show a link from a load: the app's links are in its scripts, beside namespace names and the
 * addresses in error messages. The outside hosts the scripts name are printed, so a new one can be seen, and none
 * fails the check. What a script really asks for is seen where it runs: the smoke visits (apps/web/e2e/smoke.spec.ts)
 * fail on a request to any host but the one that served the app.
 *
 * scripts/outside-addresses.json is the allow list. It starts empty. An entry is a line added by hand, in a pull
 * request that gives the reason and changes docs/privacy.md with it.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const RECORD = "scripts/outside-addresses.json";

/** Attributes that load their address on any tag, and the tags on which `href` loads too. */
const LOADING_ATTRIBUTES = new Set(["src", "srcset", "imagesrcset", "poster", "data", "background", "action", "formaction", "ping", "manifest"]);
const HREF_LOADS = new Set(["link", "base", "script", "image", "use", "feimage"]);
/** A `<link>` whose every `rel` is one of these names a page, and loads nothing. */
const LINK_RELS_THAT_ONLY_NAME = new Set(["canonical", "alternate", "author", "license", "help", "me", "next", "prev", "search", "bookmark", "tag", "external", "nofollow", "noopener", "noreferrer"]);
const LOADING_CALLS = ["fetch", "import", "importScripts", "sendBeacon", "WebSocket", "EventSource", "Worker", "SharedWorker"];
/** This machine is not another host: `grooph watch` and the tests serve the app from here. */
const HERE = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

const decode = (text) => text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** The host of an address that is on another host; undefined for a relative address, the site's own, this machine or a `data:` one. */
export function outsideHost(address, own) {
  const text = address.trim();
  const absolute = /^(?:(https?|wss?):)?\/\/([^/?#\s]+)/i.exec(text);
  if (!absolute) return undefined;
  const host = absolute[2].replace(/^[^@]*@/, "").replace(/:\d+$/, "").toLowerCase();
  if (HERE.has(host)) return undefined;
  const normal = text.replace(/^\/\//, "https://");
  for (const prefix of own) {
    // The site's own pages, and its origin said bare, as a page says it when it asks who sent a message.
    if (normal === prefix.replace(/\/$/, "") || normal.startsWith(prefix) || normal.replace(/\/$/, "") === new URL(prefix).origin) return undefined;
  }
  return host;
}

/** Every address CSS loads: `url()`, `@import`, and the strings of an `image-set()`. `@namespace` names, and loads nothing. */
export function cssAddresses(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@namespace[^;]*;/gi, "");
  const found = [];
  for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) found.push({ what: "url()", address: m[1] ?? m[2] ?? m[3] });
  for (const m of text.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) found.push({ what: "@import", address: m[1] ?? m[2] });
  for (const set of text.matchAll(/image-set\(([^;{}]*)/gi)) {
    for (const m of set[1].matchAll(/(?:^|,)\s*(?:"([^"]*)"|'([^']*)')/g)) found.push({ what: "image-set()", address: m[1] ?? m[2] });
  }
  return found.filter((f) => f.address !== "");
}

/** In a script: the addresses written straight into a call that loads, and every address it names at all. */
export function scriptAddresses(js) {
  const calls = [];
  const call = new RegExp(`\\b(${LOADING_CALLS.join("|")})\\s*\\(\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`)`, "g");
  for (const m of js.matchAll(call)) calls.push({ what: `${m[1]}()`, address: m[2] ?? m[3] ?? m[4] });
  // A module taken by name, as a bundler writes it: `import"…"` and `}from"…"`, the quote tight against the word.
  // With a space between them the words are as likely to be prose in a string, and the hosts named below catch the rest.
  for (const m of js.matchAll(/(?:^|[;}\s*])(?:import|from)(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g)) calls.push({ what: "import", address: m[1] ?? m[2] ?? m[3] });
  const named = [];
  for (const m of js.matchAll(/(?:https?|wss?):\/\/[A-Za-z0-9.-]+(?::\d+)?[^\s"'`\\<>)]*/g)) named.push(m[0]);
  // An address with no scheme, only where it opens a string: `"//cdn.example/x.js"`. Anywhere else `//` is a comment or a division.
  for (const m of js.matchAll(/["'`](\/\/[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?[^\s"'`\\<>)]*)/g)) named.push(m[1]);
  return { calls, named };
}

/**
 * Every address an HTML or SVG document loads, and the text of its scripts. Tags are read with their attributes;
 * what is inside `<script>` and `<style>` is read as a script and as CSS. Text that only shows a tag, as a code
 * block does, is escaped and is not a tag.
 */
export function markupAddresses(markup) {
  const loads = [];
  const scripts = [];
  let text = markup.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (whole, attributes, body) => {
    if (body.trim() !== "") scripts.push(body);
    return `<script${attributes}></script>`;
  });
  text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (whole, body) => {
    for (const f of cssAddresses(body)) loads.push({ what: `<style> ${f.what}`, address: f.address });
    return "";
  });
  for (const m of text.matchAll(/<\?xml-stylesheet\b([^?]*)\?>/gi)) {
    const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[1]);
    if (href) loads.push({ what: "<?xml-stylesheet?>", address: decode(href[1] ?? href[2]) });
  }
  for (const tag of text.matchAll(/<([A-Za-z][\w:-]*)((?:\s+[^\s"'<>=/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*\/?>/g)) {
    const name = tag[1].toLowerCase();
    const attributes = new Map();
    for (const a of tag[2].matchAll(/([^\s"'<>=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)) attributes.set(a[1].toLowerCase(), decode(a[2] ?? a[3] ?? a[4] ?? ""));
    for (const [attribute, value] of attributes) {
      const bare = attribute.replace(/^xlink:/, "");
      if (attribute === "style") {
        for (const f of cssAddresses(value)) loads.push({ what: `<${name} style> ${f.what}`, address: f.address });
      } else if (attribute === "srcset" || attribute === "imagesrcset") {
        for (const candidate of value.split(",")) {
          const address = candidate.trim().split(/\s+/)[0];
          if (address) loads.push({ what: `<${name} ${attribute}>`, address });
        }
      } else if (LOADING_ATTRIBUTES.has(attribute)) {
        loads.push({ what: `<${name} ${attribute}>`, address: value });
      } else if (bare === "href" && HREF_LOADS.has(name)) {
        const rels = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        if (name === "link" && rels.length > 0 && rels.every((rel) => LINK_RELS_THAT_ONLY_NAME.has(rel))) continue;
        loads.push({ what: `<${name} ${attribute}${name === "link" && rels.length > 0 ? ` rel="${rels.join(" ")}"` : ""}>`, address: value });
      }
    }
    if (name === "meta" && (attributes.get("http-equiv") ?? "").toLowerCase() === "refresh") {
      const to = /url\s*=\s*['"]?([^'";]+)/i.exec(attributes.get("content") ?? "");
      if (to) loads.push({ what: '<meta http-equiv="refresh">', address: to[1] });
    }
  }
  return { loads, scripts };
}

/** Every `src` in a web app manifest: its icons, screenshots and shortcuts. */
export function manifestAddresses(json) {
  const found = [];
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) {
        if (key === "src" && typeof inner === "string") found.push({ what: "manifest src", address: inner });
        else walk(inner);
      }
    }
  };
  walk(JSON.parse(json));
  return found;
}

const KINDS = { ".html": "markup", ".htm": "markup", ".svg": "markup", ".css": "css", ".js": "script", ".mjs": "script", ".webmanifest": "manifest" };

/**
 * Hold what was read against the allow list. `files` is `[{ path, text }]`, the kind taken from the path's ending;
 * `allow` is `{ address: reason }`. Returns the lines to print: `loads` (something loaded from another host) and
 * `stale` (an allowed address nothing loads); and `hosts`, the outside hosts the scripts name, which are not judged.
 */
export function judge(files, allow, own) {
  const loads = [];
  const hosts = new Set();
  const allowed = new Set();
  const refuse = (path, what, address) => {
    const host = outsideHost(address, own);
    if (host === undefined) return;
    if (Object.hasOwn(allow, address)) allowed.add(address);
    else loads.push(`${path}: ${what} loads ${address}`);
  };
  const script = (path, js) => {
    const { calls, named } = scriptAddresses(js);
    for (const { what, address } of calls) refuse(path, what, address);
    for (const address of named) {
      const host = outsideHost(address, own);
      if (host !== undefined) hosts.add(host);
    }
  };
  for (const { path, text } of files) {
    const kind = KINDS[extname(path).toLowerCase()];
    if (kind === "markup") {
      const found = markupAddresses(text);
      for (const { what, address } of found.loads) refuse(path, what, address);
      for (const js of found.scripts) script(path, js);
    } else if (kind === "css") {
      for (const { what, address } of cssAddresses(text)) refuse(path, what, address);
    } else if (kind === "script") {
      script(path, text);
    } else if (kind === "manifest") {
      for (const { what, address } of manifestAddresses(text)) refuse(path, what, address);
    }
  }
  const stale = Object.keys(allow).filter((address) => !allowed.has(address)).map((address) => `the allow list has ${address}, and nothing loads it`);
  return { loads, stale, hosts: [...hosts].sort() };
}

/** Every file under `dir` that this check reads, with its text; `label` stands for `dir` in what is printed. */
export function read(dir, label) {
  const files = [];
  const walk = (folder) => {
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (KINDS[extname(name).toLowerCase()]) files.push({ path: join(label, relative(dir, path)), text: readFileSync(path, "utf8") });
    }
  };
  if (existsSync(dir)) walk(dir);
  return files;
}

function main() {
  const fail = (message) => {
    console.error(`check-outside-addresses: ${message}`);
    process.exit(1);
  };
  const option = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);

  const site = JSON.parse(readFileSync(join(root, "scripts/site/pages.json"), "utf8")).site;
  const own = [site.url];
  const recordPath = option("--record") ?? join(root, RECORD);
  if (!existsSync(recordPath)) fail(`${RECORD} is missing`);
  const allow = JSON.parse(readFileSync(recordPath, "utf8")).loads;
  if (typeof allow !== "object" || allow === null || Array.isArray(allow)) fail(`${RECORD} needs a "loads" object: each allowed address with its reason`);

  // A check with nothing to read has not checked anything: no built app, or no rendered page, is a failure.
  const dist = option("--dist") ?? join(root, "apps/web/dist");
  const app = read(dist, "apps/web/dist");
  if (!app.some((file) => file.path.endsWith("index.html")) || !app.some((file) => file.path.endsWith(".js"))) {
    fail("the built app was not found in apps/web/dist (a page and its scripts); run `pnpm -r build` first");
  }

  let pagesDir = option("--pages");
  let scratch;
  if (pagesDir === undefined) {
    scratch = mkdtempSync(join(tmpdir(), "grooph-outside-"));
    try {
      execFileSync(process.execPath, [join(root, "scripts/site-pages.mjs"), "--out", scratch], { cwd: root, stdio: "pipe" });
    } catch (error) {
      rmSync(scratch, { recursive: true, force: true });
      fail(`the site's pages could not be rendered: ${String(error.stderr ?? error.message).trim().split("\n").pop()}`);
    }
    pagesDir = join(scratch, "docs");
  }
  const pages = read(pagesDir, "docs");
  if (scratch) rmSync(scratch, { recursive: true, force: true });
  if (!pages.some((file) => file.path.endsWith(".html"))) fail("no rendered page of the site was found to read");

  const { loads, stale, hosts } = judge([...app, ...pages], allow, own);

  if (loads.length > 0) {
    console.error(loads.join("\n"));
    console.error(
      `\n${loads.length === 1 ? "That is" : "Those are"} loaded from another host, and docs/privacy.md says nothing is. Serve the file from the site itself. If the owner has decided otherwise, add the address to "loads" in ${RECORD} with the reason, and change the privacy page in the same pull request.`,
    );
  }
  if (stale.length > 0) {
    console.error(`${loads.length > 0 ? "\n" : ""}${stale.join("\n")}`);
    console.error(`\nstale: ${RECORD}; take those lines out`);
  }
  if (loads.length + stale.length > 0) {
    if (process.argv.includes("--check")) process.exit(1);
    return;
  }
  const count = (list, ending) => list.filter((file) => file.path.endsWith(ending)).length;
  console.log(`nothing is loaded from another host: read the built app (${count(app, ".html")} page, ${count(app, ".js")} scripts, ${count(app, ".css")} style sheets) and ${count(pages, ".html")} rendered pages`);
  // Not judged: a script's text does not show a link from a load. Printed so that a new host can be seen.
  if (hosts.length > 0) console.log(`the scripts name ${hosts.length} outside ${hosts.length === 1 ? "host" : "hosts"}, as links, namespaces and names: ${hosts.join(", ")}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
