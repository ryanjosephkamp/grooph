import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/** Reads a file; a missing one is named as the caller typed it, not as an absolute path. */
export function readText(path: string): string {
  try {
    return readFileSync(resolve(path), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw Object.assign(new Error(`no such file: ${path}`), { code: "ENOENT", path });
    throw err;
  }
}

/**
 * The folders grooph keeps under `.grooph` for something other than a package: core's `keptFolder` names the same
 * five, and a test holds the two lists equal. They are written out here because this file is also compiled with the
 * web app's tests, where core is its lighter entry and has no `keptFolder`.
 */
export const NOT_A_PACKAGE: readonly string[] = ["graphs", "proposals", "templates", "events", "hooks"];

/**
 * Whether a path is the graph a package keeps, `<project>/.grooph/<graph id>/graph.grooph.json`, by where the file
 * really is: through a link, and in whatever letter case a disk that ignores case was handed. The folders grooph keeps
 * under `.grooph` for something else (graphs, proposals, templates, events, hooks) hold no package.
 */
export function isKeptGraph(path: string): boolean {
  const full = resolve(path);
  let real: string;
  try {
    real = realpathSync.native(full);
  } catch {
    try {
      real = join(realpathSync.native(dirname(full)), basename(full));
    } catch {
      real = full;
    }
  }
  const folder = basename(dirname(real));
  return basename(real).toLowerCase() === "graph.grooph.json" && basename(dirname(dirname(real))) === ".grooph" && /^[a-z][a-z0-9-]*$/.test(folder) && !NOT_A_PACKAGE.includes(folder);
}

/** Said by every command but `export` that is asked to write the graph a package keeps. */
export const keptGraphRefusal = (path: string): string =>
  `${path} is the graph a package keeps. Only grooph export writes it: an export compares the next graph with it, and a change made to it here would move that comparison with no word said. Nothing was written. Work on a copy of your own (.grooph/graphs/<id>.grooph.json is the usual place) and export that.`;

export function writeText(path: string, contents: string): void {
  // The graph a package keeps is the baseline an export holds the next graph to. `grooph export` places it with the
  // rest of the package (../place.ts); no other command writes it, whatever it was asked.
  if (isKeptGraph(path)) throw Object.assign(new Error(keptGraphRefusal(path)), { code: "KEPT_GRAPH" });
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents, "utf8");
}

export function writeBytes(path: string, contents: Uint8Array): void {
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}
