import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BUILT_INS, FRONT } from "../src/doors.js";
import { repoRoot } from "./helpers.js";

/**
 * Slice 0093. The page's head asks for a piece beside the app, before any of the app has run, and the app waits
 * for the same piece before its first screen. Both read `src/doors.ts`. These hold those rules to the app's own
 * routes (`parse` in `App.tsx`): an address that waited for a piece the page had not asked for would get it a
 * round late, which is a slower page; one that asked for a piece it does not wait for would fetch what it does
 * not need.
 */
const front = new RegExp(FRONT);
const builtIns = new RegExp(BUILT_INS);

/** The screen each address opens on, as `parse` in App.tsx decides it, written out here by hand. */
const ADDRESSES: [string, "library" | "about" | "templates" | "built-in" | "yours" | "plan" | "graph" | "open" | "run" | "live-run" | "live" | "embed"][] = [
  ["", "library"],
  ["#", "library"],
  ["#/", "library"],
  ["#/about", "about"],
  ["#/templates", "templates"],
  ["#/templates/built-in/review-gate", "built-in"],
  ["#/templates/built-in/review-gate/use", "built-in"],
  ["#/templates/built-in/a%20name", "built-in"],
  ["#/templates/yours/mine", "yours"],
  ["#/templates/yours/mine/use", "yours"],
  // A plan's own address (slice 0100) is a template's view: the canvas's, with no front page and none of the twenty.
  ["#/templates/plan/solo-project", "plan"],
  ["#/templates/plan/solo-project/use", "plan"],
  ["#/g/abc", "graph"],
  ["#/g/abc?new", "graph"],
  ["#/open?d=abc", "open"],
  ["#/open?d=abc&c=lean&theme=ink", "open"],
  ["#/run/abc", "run"],
  ["#/run?live", "live-run"],
  ["#/live", "live"],
  ["#/embed", "embed"],
  ["#/embed?d=abc&theme=dark", "embed"],
  // Every address that is no other screen's is the library's: a mistyped one, a link cut short, one with a tail.
  ["#/nope", "library"],
  ["#/about/", "library"],
  ["#/about?x", "library"],
  ["#/?utm=1", "library"],
  ["#/open", "library"],
  ["#/run", "library"],
  ["#/run/", "library"],
  ["#/run/abc?x", "library"],
  ["#/live/", "library"],
  ["#/g/", "library"],
  ["#/g/abc/def", "library"],
  ["#/g/abc?old", "library"],
  ["#/templates/", "library"],
  ["#/templates/built-in", "library"],
  ["#/templates/built-in/", "library"],
  ["#/templates/built-in/x/", "library"],
  ["#/templates/built-in/x/use/", "library"],
  ["#/templates/theirs/x", "library"],
  ["#/embedded", "library"],
  ["#about", "library"],
];

describe("which address asks for which piece (slice 0093)", () => {
  it("the front page's picture: at #/about and at every address that is the library's, and at no other screen's", () => {
    for (const [hash, screen] of ADDRESSES) expect(front.test(hash), `${hash || "(no hash)"} is ${screen}`).toBe(screen === "library" || screen === "about");
  });

  it("the built-in templates: at the list and at a built-in template's view and Use form, and at no other", () => {
    for (const [hash, screen] of ADDRESSES) expect(builtIns.test(hash), `${hash || "(no hash)"} is ${screen}`).toBe(screen === "templates" || screen === "built-in");
  });

  it("the list above says what the app's own routes say: each address written here is checked against `parse`", () => {
    // `parse` is not exported; its rules are few and are read here as text, so that a route added or changed there
    // without this list being looked at again fails.
    const app = readFileSync(join(repoRoot, "apps/web/src/App.tsx"), "utf8");
    const routes = app.slice(app.indexOf("function parse(hash: string): Route {"), app.indexOf("\nexport function App"));
    for (const rule of [
      'if (hash === "#/run?live") return { name: "live-run" };',
      'if (hash === "#/live") return { name: "live" };',
      "const run = /^#\\/run\\/([^?]+)$/.exec(hash);",
      'if (hash === "#/about") return { name: "about" };',
      'if (hash === "#/templates") return { name: "templates" };',
      'if (hash === "#/embed" || hash.startsWith("#/embed?")) return { name: "embed" };',
      "const template = /^#\\/templates\\/(built-in|yours|plan)\\/([^/?]+)(\\/use)?$/.exec(hash);",
      "const graph = /^#\\/g\\/([^/?]+)(\\?new)?$/.exec(hash);",
      'if (hash.startsWith("#/open?")) {',
      'return { name: "library" };',
    ]) expect(routes, `App.tsx no longer has the rule: ${rule}`).toContain(rule);
    // Nine ways out of `parse` that are not the library, and no tenth: a new screen means a new line in doors.ts.
    expect(routes.match(/return \{ name: "/g)).toHaveLength(10);
  });

  it("the page and the app read the same rules, and nothing else decides", () => {
    const config = readFileSync(join(repoRoot, "apps/web/vite.config.ts"), "utf8");
    expect(config).toContain('import { BUILT_INS, FRONT } from "./src/doors.js";');
    expect(config).toContain("/${BUILT_INS}/.test(location.hash)?${list(found.templates)}:[]");
    expect(config).toContain("/${FRONT}/.test(location.hash)?${list(found.front)}:[]");
    const app = readFileSync(join(repoRoot, "apps/web/src/App.tsx"), "utf8");
    expect(app).toContain("if (new RegExp(BUILT_INS).test(hash)) wanted.push(loadBuiltIns());");
    expect(app).toContain("if (new RegExp(FRONT).test(hash)) wanted.push(Promise.race([loadFront(), ");
    // They are written into a script in the page as they are: nothing in them can end the script or the string.
    for (const rule of [FRONT, BUILT_INS]) expect(/<|`|\$\{|\n/.test(rule)).toBe(false);
    // And the script is put into the page by a function. Given as text, a replacement is read for `$&`, `$'`, `` $` ``,
    // `$$` and `$1`, and the rules are full of `$`: one of those in a rule would be rewritten on its way in.
    expect(config).toContain('return html.replace("</title>", () => `</title>\\n    ${hint}`);');
    expect(config).not.toMatch(/html\.replace\("<\/title>", `/);
    for (const rule of [FRONT, BUILT_INS]) expect("<title>x</title>".replace("</title>", () => `</title>/${rule}/`)).toBe(`<title>x</title>/${rule}/`);
  });

  it.skipIf(!existsSync(join(repoRoot, "apps/web/dist/index.html")))("the built page holds the rules as they are written, character for character", () => {
    // After a build (as in CI, where `pnpm -r build` comes first): shown as skipped without one.
    const page = readFileSync(join(repoRoot, "apps/web/dist/index.html"), "utf8");
    expect(page).toContain(`/${BUILT_INS}/.test(location.hash)?`);
    expect(page).toContain(`/${FRONT}/.test(location.hash)?`);
    // The loader writes a module's preload where the browser knows it, and a script's where it does not.
    expect(page).toContain('if(m)l.rel="modulepreload";else{l.rel="preload";l.as="script";l.crossOrigin=""}');
  });
});
