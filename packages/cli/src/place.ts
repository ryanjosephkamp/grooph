/**
 * Where grooph may put a file on someone else's word, and how. One guard for the MCP tools and for `grooph export`:
 * inside the folder it was given, by real location; never under `.git`; never through a link; and a set of files
 * placed whole or not at all.
 */

import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { Refusal, q } from "./reply.js";

/** The folder a caller may write in. `writes` is false when it was given none of its own. */
export type Place = { project: string; writes?: boolean };

/**
 * What a path here never holds, by the kind of character and not by a list of them: one that ends a line, and one
 * that does not show. The second kind makes a name that reads as another (a zero-width space, or a variation
 * selector, inside `graph.grooph.json`): control and format characters, every code point a renderer may ignore,
 * the variation selectors, a surrogate with no pair, private-use and unassigned code points, every space but the
 * plain one, and the braille blank.
 */
const HIDDEN_IN_PATH = new RegExp(
  `[\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\p{Zl}\\p{Zp}\\p{Default_Ignorable_Code_Point}\\p{Variation_Selector}${String.fromCodePoint(0x2800)}]|(?! )\\p{Zs}`,
  "gu",
);

/** A path argument is refused outright when it holds such a character: its text is repeated in replies, and it names a file. */
export function pathArg(given: string, name: string): string {
  if (new RegExp(HIDDEN_IN_PATH.source, "u").test(given)) {
    // Said as a JSON string with each such character written out as its escape, since some of them show as nothing.
    const escaped = (ch: string): string => [...Array(ch.length).keys()].map((i) => `\\u${ch.charCodeAt(i).toString(16).padStart(4, "0")}`).join("");
    const shown = JSON.stringify(given).replace(HIDDEN_IN_PATH, escaped);
    throw new Refusal(`${q(name)} holds a character that ends a line or does not show (${shown}), which no path here has.`, `pass "${name}" as a plain path`);
  }
  return given;
}

/**
 * The absolute path that may be written: inside the project folder, by its real location.
 * A path that climbs out, an absolute path elsewhere, and a link that points out are all refused;
 * so is every write when no folder was given.
 */
export function within(place: Place, given: string): string {
  if (place.writes === false) {
    throw new Refusal(
      `grooph was not given a project folder (it started in ${q(place.project)}), so it writes no file.`,
      'leave "out" off: the result comes back in this reply. To write files, start the server with grooph mcp --dir <folder>',
    );
  }
  pathArg(given, "out");
  let root: string;
  try {
    root = realpathSync.native(place.project);
  } catch {
    throw new Refusal(`The project folder ${q(place.project)} does not exist, so there is nowhere to write.`, 'leave "out" off: the result comes back in this reply');
  }
  const full = resolve(root, given);
  const outside = (): Refusal => new Refusal(`${q(given)} is outside the project folder (${q(root)}); grooph writes only inside it.`, "give a path inside the project folder, relative to it");
  // A link at the path itself is never written: through it the write would land wherever it points, in the project or not.
  if (isLink(full)) {
    let target: string | undefined;
    try {
      target = realpathSync.native(full);
    } catch {
      target = undefined;
    }
    const rel = target === undefined ? ".." : relative(root, target);
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw outside();
    throw new Refusal(`${q(given)} is a link to another file, and grooph writes files, not through links.`, "give the path of a file of its own, inside the project folder");
  }
  // The nearest folder that exists, by its real location, must be the project or inside it. A path with no existing
  // ancestor at all (a drive that is not there) is outside; so is one that passes through a link to nothing.
  const probe = nearestExisting(full);
  if (probe === undefined) throw outside();
  const real = realpathSync.native(probe);
  const rel = relative(root, real);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw outside();
  // Where the file would really be: nothing is written into a repository's own folder, whatever the case of its name.
  const landing = relative(root, join(real, relative(probe, full)));
  if (landing.split(sep).some((part) => part.toLowerCase() === ".git")) {
    throw new Refusal(`${q(given)} is under .git, and grooph writes nothing there.`, "give a path elsewhere inside the project folder");
  }
  return full;
}

/**
 * The nearest ancestor of `full` that exists (or `full` itself), or undefined when there is none: the walk has
 * reached a root that is not there (a drive letter with no drive), or a link on the way points at nothing.
 * `fs` and `dirname` are parameters so the walk can be run over Windows paths on any machine.
 */
export function nearestExisting(
  full: string,
  fs: { exists: (path: string) => boolean; isLink: (path: string) => boolean } = { exists: existsSync, isLink },
  parentOf: (path: string) => string = dirname,
): string | undefined {
  let probe = full;
  while (!fs.exists(probe)) {
    if (fs.isLink(probe)) return undefined;
    const parent = parentOf(probe);
    if (parent === probe) return undefined;
    probe = parent;
  }
  return probe;
}

export function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** A path as a reply shows it: relative to the project when it is inside it. */
export const shownIn = (place: Place, full: string): string => {
  let root = place.project;
  try {
    root = realpathSync.native(place.project);
  } catch {
    /* shown as given */
  }
  const rel = relative(root, full);
  return rel === "" ? "." : rel === ".." || rel.startsWith(`..${sep}`) ? full : rel;
};

/**
 * Put files where they go, all of them or none: each is written beside its place first, and only when every one is
 * written are they renamed into place. A rename gives the name a new file, so another name for the old one (a hard
 * link, in the project or out of it) keeps what it had, and nothing is ever half written. A failure on the way is a
 * refusal that says which file, with nothing left behind: not a file, and not a folder that was made for one.
 */
export function putAll(place: Place, files: readonly { full: string; contents: string | Uint8Array }[]): void {
  const beside = (full: string): string => `${full}.${process.pid}.grooph-tmp`;
  const written: string[] = [];
  /** The folders this call made, outermost of each: they hold nothing but what this call wrote. */
  const made: string[] = [];
  const undo = (): void => {
    for (const temp of written) if (temp !== "") rmSync(temp, { force: true });
    for (const folder of made.reverse()) rmSync(folder, { recursive: true, force: true });
  };
  const why = (err: unknown): string => {
    const errno = (err as NodeJS.ErrnoException).code;
    return typeof errno === "string" && /^[A-Z0-9_]+$/.test(errno) ? errno : q((err as Error).message);
  };
  for (const { full, contents } of files) {
    try {
      if (existsSync(full) && statSync(full).isDirectory()) throw Object.assign(new Error("a folder is there"), { code: "EISDIR" });
      const first = mkdirSync(dirname(full), { recursive: true });
      if (first !== undefined) made.push(first);
      writeFileSync(beside(full), contents, { flag: "wx" });
      written.push(beside(full));
    } catch (err) {
      undo();
      const code = why(err);
      throw new Refusal(
        `Could not write ${q(shownIn(place, full))} (${code}); nothing was written.`,
        code === "EISDIR" || code === "ENOTDIR" || code === "EEXIST" ? "a file or a folder of another kind is in the way: give another place, or move what is there" : "give another place inside the project folder",
      );
    }
  }
  for (const [i, { full }] of files.entries()) {
    try {
      renameSync(beside(full), full);
      written[i] = "";
    } catch (err) {
      // Files already in place stay, in the folders made for them; only what was not yet placed is taken back.
      for (const temp of written) if (temp !== "") rmSync(temp, { force: true });
      const placed = files.slice(0, i).map((f) => q(shownIn(place, f.full)));
      throw new Refusal(`Could not put ${q(shownIn(place, full))} in place (${why(err)}).${placed.length > 0 ? ` Already placed: ${placed.join(", ")}.` : " Nothing was placed."}`, "look at what is at that path, then call again");
    }
  }
}
