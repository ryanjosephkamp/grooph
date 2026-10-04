import { afterEach, describe, expect, it, vi } from "vitest";

import { piece } from "../src/piece.js";

/** `src/piece.ts`: an import that fails is tried again once its file has been fetched, and the first failure is the one reported. */
const page = (html: string): void => void vi.stubGlobal("document", { documentElement: { innerHTML: html } });
const NAMED = '<script>void ["/grooph/assets/compile-Ab_1-x.js","/grooph/assets/screens-Zz9.js","/grooph/assets/screens-Zz9.css","/grooph/assets/EmbedApp-Q.js"]</script>';
const answer = (ok: boolean) => ({ ok, arrayBuffer: async () => new ArrayBuffer(0) });

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
    page(NAMED);
    const fetch = vi.fn(async () => answer(true));
    vi.stubGlobal("fetch", fetch);
    const load = vi.fn().mockRejectedValueOnce(new Error("Importing a module script failed.")).mockResolvedValueOnce("the screens");
    expect(await piece("screens", load)).toBe("the screens");
    // The script, not the style sheet of the same name; and by the address the page gave.
    expect(fetch.mock.calls).toEqual([["/grooph/assets/screens-Zz9.js"]]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reports the first failure when the file cannot be had, and does not import again", async () => {
    page(NAMED);
    const first = new Error("Importing a module script failed.");
    for (const fetch of [vi.fn(async () => answer(false)), vi.fn(async () => Promise.reject(new TypeError("Load failed")))]) {
      vi.stubGlobal("fetch", fetch);
      const load = vi.fn().mockRejectedValue(first);
      await expect(piece("compile", load)).rejects.toBe(first);
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

  it("reports the first failure, and fetches nothing, when the page does not name the piece", async () => {
    page(NAMED);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const first = new Error("no such piece");
    await expect(piece("views", async () => Promise.reject(first))).rejects.toBe(first);
    expect(fetch).not.toHaveBeenCalled();
  });
});
