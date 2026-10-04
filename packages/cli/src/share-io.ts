/**
 * The shell side of share links and proposal sets (docs/executive.md §2, §4):
 * raw DEFLATE through `node:zlib`, reading a graph or a proposal set from disk
 * with its `{ file }` candidates inlined, and opening a link in a browser.
 */

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import {
  formatIssue,
  isCandidateFile,
  isMapLike,
  isProposalSetLike,
  isRunBundleLike,
  parseGraph,
  parseMap,
  parseProposalSet,
  parseRunBundle,
  type Candidate,
  type DeflateRaw,
  type Graph,
  type InflateRaw,
  type IssueLike,
  type OperationMap,
  type ProposalSet,
  type RunBundle,
} from "@grooph/core";

import { readText } from "./io.js";

export const deflateRaw: DeflateRaw = (bytes) => deflateRawSync(bytes, { level: 9 });

/** `maxOutputLength` makes zlib throw `RangeError` past the cap, which is the core contract. */
export const inflateRaw: InflateRaw = (bytes, maxOutput) => inflateRawSync(bytes, { maxOutputLength: maxOutput });

export type Loaded =
  | { kind: "graph"; doc: Graph }
  | { kind: "proposals"; doc: ProposalSet; files: Record<string, string> }
  | { kind: "run"; doc: RunBundle }
  | { kind: "map"; doc: OperationMap };

/** Something the user can fix, with the issue lines that say what. */
export class LoadError extends Error {
  readonly lines: string[];
  constructor(message: string, lines: string[] = []) {
    super(message);
    this.name = "LoadError";
    this.lines = lines;
  }
}

const lines = (issues: readonly IssueLike[]): string[] => issues.map(formatIssue);

function readJson(file: string): unknown {
  const text = readText(file);
  try {
    return JSON.parse(text);
  } catch {
    // The parser's own message quotes the text it stopped at. A file that turned out not to be a document is named, not quoted.
    throw new LoadError(`${file} is not JSON`);
  }
}

/** A graph document, a proposal set with every `{ file }` candidate read and inlined, a run bundle file, or an operation map. */
export function loadShareable(file: string, cwd = process.cwd()): Loaded {
  const json = readJson(file);
  if (isMapLike(json)) {
    const parsed = parseMap(json);
    if (!parsed.map) throw new LoadError(`${file} is not an operation map grooph can read`, lines(parsed.issues));
    return { kind: "map", doc: parsed.map };
  }
  if (isRunBundleLike(json)) {
    const parsed = parseRunBundle(json);
    if (!parsed.bundle) throw new LoadError(`${file} is not a run bundle grooph can read`, parsed.issues);
    return { kind: "run", doc: parsed.bundle };
  }
  if (!isProposalSetLike(json)) {
    const parsed = parseGraph(json);
    if (!parsed.doc) throw new LoadError(`${file} is neither a graph document nor a proposal set`, lines(parsed.issues));
    return { kind: "graph", doc: parsed.doc };
  }
  const { set, files } = loadProposals(file, cwd);
  return { kind: "proposals", doc: set, files };
}

/**
 * A proposal set with its candidates' graphs inlined; `files` maps candidate id to the file it came from.
 *
 * `beside` is for a caller that reads on someone else's word (the MCP server): a candidate's file is then read only
 * when it is named as a graph (`*.grooph.json`) and sits, by its real location, in the set's own folder or under it.
 * A set is a document that names files; without this it would be a way to have any file opened.
 */
export function loadProposals(file: string, cwd = process.cwd(), options: { beside?: boolean } = {}): { set: ProposalSet; files: Record<string, string> } {
  const parsed = parseProposalSet(readJson(file));
  if (!parsed.set) throw new LoadError(`${file} is not a proposal set grooph can read`, lines(parsed.issues));
  const files: Record<string, string> = {};
  const candidates = parsed.set.candidates.map((candidate): Candidate => {
    if (!isCandidateFile(candidate.graph)) return candidate;
    const path = options.beside === true ? candidateBeside(file, candidate.id, candidate.graph.file, cwd) : candidatePath(file, candidate.graph.file, cwd);
    if (!path) {
      throw new LoadError(
        `candidate "${candidate.id}" points at ${candidate.graph.file}, which is not in ${shown(dirname(resolve(cwd, file)), cwd)}/ or the working directory. Paths in { "file" } are relative to the proposal set's folder.`,
      );
    }
    const json = readJson(path);
    // Read on someone else's word, a file that does not say it is a graph is named and not quoted: a schema issue
    // repeats the value it found, and this file is not grooph's to repeat.
    if (options.beside === true && !(typeof json === "object" && json !== null && !Array.isArray(json) && "grooph" in json)) {
      throw new LoadError(`candidate "${candidate.id}": ${shown(path, cwd)} is JSON, but not a graph document: it does not carry the "grooph" mark. Nothing of it was read back.`);
    }
    const graph = parseGraph(json);
    if (!graph.doc) throw new LoadError(`candidate "${candidate.id}": ${shown(path, cwd)} is not a graph document`, lines(graph.issues));
    files[candidate.id] = path;
    return { ...candidate, graph: graph.doc };
  });
  return { set: { ...parsed.set, candidates }, files };
}

/** The file a candidate names, when it is a graph by name and inside the set's own folder by real location; otherwise the reason, with nothing read. */
function candidateBeside(setFile: string, candidateId: string, ref: string, cwd: string): string {
  const said = JSON.stringify(ref);
  const no = (why: string): LoadError => new LoadError(`candidate "${candidateId}" names the file ${said}, ${why}. A candidate's graph is a .grooph.json file in the proposal set's own folder; give its name relative to that folder, or put the graph itself in the set.`);
  if (!/[^/\\]\.grooph\.json$/i.test(ref)) throw no("which is not named as a graph");
  if (isAbsolute(ref)) throw no("which is not relative to the set's folder");
  const folder = dirname(resolve(cwd, setFile));
  const path = resolve(folder, ref);
  if (!existsSync(path)) throw no("and there is no such file beside the set");
  const rel = relative(realpathSync.native(folder), realpathSync.native(path));
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw no("which is outside the set's folder");
  return path;
}

/** Relative to the set's folder first (docs/executive.md §1), then to the working directory, which is how an agent in the repo root may have written it. */
function candidatePath(setFile: string, ref: string, cwd: string): string | undefined {
  if (isAbsolute(ref)) return existsSync(ref) ? ref : undefined;
  for (const base of [dirname(resolve(cwd, setFile)), cwd]) {
    const path = resolve(base, ref);
    if (existsSync(path)) return path;
  }
  return undefined;
}

/** A path as the user would type it from where they stand. */
export const shown = (path: string, cwd = process.cwd()): string => {
  const rel = relative(cwd, path);
  return rel === "" ? "." : rel.startsWith("..") || isAbsolute(rel) ? path : rel;
};

export type OpenUrl = (url: string) => Promise<void>;

/** The platform's "open this URL" command. Never waits for the browser. */
export const openUrl: OpenUrl = (url) =>
  new Promise((done, fail) => {
    const [command, args] =
      process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]];
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.once("error", fail);
    child.once("spawn", () => {
      child.unref();
      done();
    });
  });
