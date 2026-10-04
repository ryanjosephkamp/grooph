import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { piece } from "../src/piece.js";

/**
 * `src/piece.ts`: an import that fails is tried again once its file has been fetched, and the first failure is the
 * one reported. The file's address comes from the first script in the page's head and from nowhere else.
 */
const LISTS = 'if(!embed){for(const h of ["/grooph/assets/styles-1.css"]){}}void ["/grooph/assets/compile-Ab_1-x.js","/grooph/assets/screens-Zz9.js","/grooph/assets/screens-Zz9.css","/grooph/assets/EmbedApp-Q.js"]';
/**
 * A page: the text of the first script in its head, what the app has drawn in its body, and its title, which the
 * app may set and which stands in the head before that script. Only `head.querySelector` answers as a browser's
 * would; the rest is there to be read by a loader that looks where it should not.
 */
function page(firstScript: string | undefined, rest = "", title = "grooph"): void {
  const head = `<title>${title}</title><script>${firstScript ?? ""}</script>`;
  const all = `<head>${head}</head><body>${rest}</body>`;
  vi.stubGlobal("document", {
    head: { querySelector: (query: string) => (query === "script:not([src])" && firstScript !== undefined ? { textContent: firstScript } : null), innerHTML: head, textContent: `${title}${firstScript ?? ""}` },
    body: { innerHTML: rest, textContent: rest },
    documentElement: { innerHTML: all, outerHTML: `<html>${all}</html>`, textContent: `${firstScript ?? ""}${rest}` },
  });
}
const answer = (ok: boolean) => ({ ok, arrayBuffer: async () => new ArrayBuffer(0) });
const FAILED = new Error("Importing a module script failed.");

beforeEach(() => vi.stubGlobal("location", { href: "https://grooph.example/grooph/#/templates", origin: "https://grooph.example" }));
afterEach(() => vi.unstubAllGlobals());

describe("a piece of the app, fetched when it is needed", () => {
  it("is what its import gives, and asks for nothing more, when the import works; and once it has come it is kept", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const load = vi.fn(async () => "the embed");
    expect(await piece("EmbedApp", load)).toBe("the embed");
    expect(await piece("EmbedApp", load)).toBe("the embed");
    expect(load).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("when the import fails, fetches the file the page names for it and imports again", async () => {
    page(LISTS);
    const fetch = vi.fn(async () => answer(true));
    vi.stubGlobal("fetch", fetch);
    const load = vi.fn().mockRejectedValueOnce(FAILED).mockResolvedValueOnce("the screens");
    expect(await piece("screens", load)).toBe("the screens");
    // The script, not the style sheet of the same name; and by the address the page gave.
    expect(fetch.mock.calls).toEqual([["/grooph/assets/screens-Zz9.js"]]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reports the first failure when the file cannot be had, and does not import again", async () => {
    page(LISTS);
    for (const fetch of [vi.fn(async () => answer(false)), vi.fn(async () => Promise.reject(new TypeError("Load failed")))]) {
      vi.stubGlobal("fetch", fetch);
      const load = vi.fn().mockRejectedValue(FAILED);
      await expect(piece("compile", load)).rejects.toBe(FAILED);
      expect(fetch.mock.calls).toEqual([["/grooph/assets/compile-Ab_1-x.js"]]);
      expect(load).toHaveBeenCalledTimes(1);
    }
    // What could not be had is forgotten: the next call asks afresh, and what comes then is kept.
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const load = vi.fn(async () => "the compiler");
    expect(await piece("compile", load)).toBe("the compiler");
    expect(await piece("compile", load)).toBe("the compiler");
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("where the file's address is read", () => {
  // What a document someone was sent could put on the page: an address that looks like the piece's, on another
  // host, in a graph's name or a brief. The app draws that in its body, before and after anything else it draws.
  const elsewhere = (name: string): string => `<h1>"https://elsewhere.example/grooph/assets/${name}-Xx1.js"</h1><p>"//elsewhere.example/assets/${name}-Xx2.js" "/grooph/assets/${name}-Xx3.js"</p>`;

  it("takes it from the head's first script, whatever look-alike the page holds before and after it", async () => {
    const lists = LISTS.replace("void [", 'void ["/grooph/assets/views-Real.js",');
    // Before it: the page's title, which stands first in the head. After it: the body, twice over.
    page(lists, `${elsewhere("views")}<main>drawn by the app</main>${elsewhere("views")}`, '"https://elsewhere.example/grooph/assets/views-Xx0.js"');
    const fetch = vi.fn(async () => answer(true));
    vi.stubGlobal("fetch", fetch);
    // The import fails every time it is tried, so the last try is made: the file, at its own address past a `#`.
    const load = vi.fn().mockRejectedValue(FAILED);
    const imported = await piece("views", load).then(
      () => "(it imported)",
      (error: Error) => String(error.message),
    );
    expect(fetch.mock.calls).toEqual([["/grooph/assets/views-Real.js"]]);
    expect(load).toHaveBeenCalledTimes(2);
    // There is no such file here, so that import fails, and says what it was asked for: the real address, and no other.
    expect(imported).toContain("/grooph/assets/views-Real.js#");
    expect(imported).not.toContain("elsewhere.example");
    expect(imported).not.toMatch(/Xx\d/);
  });

  it("fetches nothing, imports nothing more and reports the first failure when the head does not name the piece, though the body does", async () => {
    const fetch = vi.fn(async () => answer(true));
    vi.stubGlobal("fetch", fetch);
    for (const firstScript of [LISTS, "", undefined]) {
      // `LISTS` names no "space"; the body names three, one of them on this very site.
      page(firstScript, elsewhere("space"));
      const load = vi.fn().mockRejectedValue(FAILED);
      await expect(piece("space", load)).rejects.toBe(FAILED);
      expect(load).toHaveBeenCalledTimes(1);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not take an address on another host even from the head's first script", async () => {
    const fetch = vi.fn(async () => answer(true));
    vi.stubGlobal("fetch", fetch);
    for (const address of ["//elsewhere.example/assets/far-1.js", "https://elsewhere.example/grooph/assets/far-1.js"]) {
      page(`void ["${address}"]`);
      const load = vi.fn().mockRejectedValue(FAILED);
      await expect(piece("far", load)).rejects.toBe(FAILED);
      expect(load).toHaveBeenCalledTimes(1);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
