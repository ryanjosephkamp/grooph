/**
 * The shell side of share links and proposal sets (docs/executive.md §2, §4):
 * raw DEFLATE through `node:zlib`, reading a graph or a proposal set from disk
 * with its `{ file }` candidates inlined, and opening a link in a browser.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

import {
  formatIssue,
  isCandidateFile,
  isProposalSetLike,
  isRunBundleLike,
  parseGraph,
  parseProposalSet,
  parseRunBundle,
  type Candidate,
  type DeflateRaw,
  type Graph,
  type InflateRaw,
  type IssueLike,
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
  | { kind: "run"; doc: RunBundle };

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
  } catch (err) {
    throw new LoadError(`${file} is not JSON: ${(err as Error).message}`);
  }
}

/** A graph document, a proposal set with every `{ file }` candidate read and inlined, or a run bundle file. */
export function loadShareable(file: string, cwd = process.cwd()): Loaded {
  const json = readJson(file);
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

/** A proposal set with its candidates' graphs inlined; `files` maps candidate id to the file it came from. */
export function loadProposals(file: string, cwd = process.cwd()): { set: ProposalSet; files: Record<string, string> } {
  const parsed = parseProposalSet(readJson(file));
  if (!parsed.set) throw new LoadError(`${file} is not a proposal set grooph can read`, lines(parsed.issues));
  const files: Record<string, string> = {};
  const candidates = parsed.set.candidates.map((candidate): Candidate => {
    if (!isCandidateFile(candidate.graph)) return candidate;
    const path = candidatePath(file, candidate.graph.file, cwd);
    if (!path) {
      throw new LoadError(
        `candidate "${candidate.id}" points at ${candidate.graph.file}, which is not in ${shown(dirname(resolve(cwd, file)), cwd)}/ or the working directory. Paths in { "file" } are relative to the proposal set's folder.`,
      );
    }
    const graph = parseGraph(readJson(path));
    if (!graph.doc) throw new LoadError(`candidate "${candidate.id}": ${shown(path, cwd)} is not a graph document`, lines(graph.issues));
    files[candidate.id] = path;
    return { ...candidate, graph: graph.doc };
  });
  return { set: { ...parsed.set, candidates }, files };
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
