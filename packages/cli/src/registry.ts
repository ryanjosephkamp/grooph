/**
 * Template registries (docs/templates.md §3): folders of `*.grooph.json`
 * templates with an `index.json`, looked up by template id, first hit wins:
 *
 *   1. project   .grooph/templates/ at the root of the working tree
 *   2. user      ~/.grooph/templates/ ($GROOPH_HOME/templates when set)
 *   3. built-in  patterns/, bundled into this package at build time
 *   4. remote    --registry <url>, else the published library; consulted only
 *                when a name is not found locally, or by `template add`
 *
 * Core stays pure; this module does the file and network I/O.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalize,
  closest,
  formatIssue,
  parseGraphText,
  templateIndex,
  templateIndexEntry,
  type Graph,
  type TemplateIndexEntry,
} from "@grooph/core";

import { writeText } from "./io.js";

/** The published pattern library (docs/templates.md §3). */
export const PUBLISHED_REGISTRY = "https://ryanjosephkamp.github.io/grooph/patterns/index.json";

/** How long a registry may take to answer before grooph gives up on it. */
const FETCH_TIMEOUT_MS = 10_000;

export type RegistryEnv = {
  /** where the project registry is looked up from */
  cwd: string;
  /** the user registry folder */
  userDir: string;
  /** the built-in library bundled at build time */
  builtinDir: string;
  /** the remote index consulted when no --registry is given */
  defaultRegistry: string;
  fetch: typeof fetch;
};

export function defaultRegistryEnv(): RegistryEnv {
  return {
    cwd: process.cwd(),
    userDir: join(process.env["GROOPH_HOME"] ?? join(homedir(), ".grooph"), "templates"),
    builtinDir: fileURLToPath(new URL("../patterns/", import.meta.url)),
    defaultRegistry: process.env["GROOPH_REGISTRY"] ?? PUBLISHED_REGISTRY,
    fetch: globalThis.fetch,
  };
}

/** A registry problem the user can act on; the CLI prints the message and exits 1. */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

export type Source = "project" | "user" | "built-in" | "remote";

export type Found = {
  source: Source;
  /** file path, or URL for a remote template */
  location: string;
  doc: Graph;
  entry: TemplateIndexEntry;
};

export type Skipped = { location: string; reason: string };

export type LocalRegistry = { source: Exclude<Source, "remote">; dir: string };

/** The root of the working tree: the nearest folder holding `.git`, else `cwd`. */
export function workingTreeRoot(cwd: string): string {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return resolve(cwd);
  }
}

export const projectDir = (env: RegistryEnv): string => join(workingTreeRoot(env.cwd), ".grooph", "templates");

/** The local registries in resolution order. */
export const localRegistries = (env: RegistryEnv): LocalRegistry[] => [
  { source: "project", dir: projectDir(env) },
  { source: "user", dir: env.userDir },
  { source: "built-in", dir: env.builtinDir },
];

/** Read a template document, or say why it is not one. */
function readTemplate(text: string): { doc: Graph } | { reason: string } {
  const parsed = parseGraphText(text);
  if (!parsed.doc) return { reason: `does not match the schema: ${parsed.issues.map(formatIssue).join("; ")}` };
  if (!parsed.doc.template) return { reason: "is a graph, not a template (it has no template block)" };
  return { doc: parsed.doc };
}

/** Every template in a folder, in file-name order. Files that are not templates are skipped with a reason. */
export function scanFolder(registry: LocalRegistry): { found: Found[]; skipped: Skipped[] } {
  const found: Found[] = [];
  const skipped: Skipped[] = [];
  if (!existsSync(registry.dir)) return { found, skipped };
  for (const file of readdirSync(registry.dir).filter((name) => name.endsWith(".grooph.json")).sort()) {
    const location = join(registry.dir, file);
    const read = readTemplate(readFileSync(location, "utf8"));
    if ("reason" in read) skipped.push({ location, reason: read.reason });
    else found.push({ source: registry.source, location, doc: read.doc, entry: templateIndexEntry(read.doc, file) });
  }
  return { found, skipped };
}

/** Every local template, project first; a later one with the same id is shadowed by the first. */
export function scanLocal(env: RegistryEnv): { found: Found[]; skipped: Skipped[] } {
  const found: Found[] = [];
  const skipped: Skipped[] = [];
  for (const registry of localRegistries(env)) {
    const scan = scanFolder(registry);
    found.push(...scan.found);
    skipped.push(...scan.skipped);
  }
  return { found, skipped };
}

// ─── remote ───────────────────────────────────────────────────────────────

/** A registry URL names its `index.json`; a folder URL gets `index.json` appended. */
export function indexUrl(url: string): string {
  if (/\.json(\?.*)?$/.test(url)) return url;
  return `${url.replace(/\/+$/, "")}/index.json`;
}

export const isUrl = (text: string): boolean => /^https?:\/\//i.test(text);

/** The network failed, not the registry: offline, refused, unknown host, or no answer in time. */
export class UnreachableError extends RegistryError {
  readonly url: string;
  readonly reason: string;
  constructor(url: string, reason: string) {
    super(`cannot reach ${url} (${reason}); if you are offline, local templates still work: grooph template list`);
    this.name = "UnreachableError";
    this.url = url;
    this.reason = reason;
  }
}

function unreachable(url: string, err: unknown): UnreachableError {
  const error = err as Error & { cause?: { code?: string; message?: string } };
  const reason =
    error.name === "TimeoutError" || error.name === "AbortError"
      ? `no answer in ${FETCH_TIMEOUT_MS / 1000} s`
      : (error.cause?.code ?? error.cause?.message ?? error.message);
  return new UnreachableError(url, reason);
}

export async function fetchText(url: string, env: RegistryEnv): Promise<string> {
  let response: Response;
  try {
    response = await env.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    throw unreachable(url, err);
  }
  if (!response.ok) throw new RegistryError(`${url} answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);
  try {
    return await response.text();
  } catch (err) {
    throw unreachable(url, err);
  }
}

export type RemoteIndex = { url: string; templates: TemplateIndexEntry[] };

export async function fetchIndex(registry: string, env: RegistryEnv): Promise<RemoteIndex> {
  const url = indexUrl(registry);
  const text = await fetchText(url, env);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new RegistryError(`${url} is not a template index: not valid JSON`);
  }
  const templates = (json as { templates?: unknown }).templates;
  const valid =
    Array.isArray(templates) &&
    templates.every((t) => typeof t === "object" && t !== null && typeof (t as TemplateIndexEntry).id === "string" && typeof (t as TemplateIndexEntry).file === "string");
  if (!valid) throw new RegistryError(`${url} is not a template index: it needs a "templates" list whose rows have an id and a file`);
  return { url, templates: templates as TemplateIndexEntry[] };
}

/** Fetch one template from a URL and check it is one. `expectId` guards an index row that points at the wrong file. */
export async function fetchTemplate(url: string, env: RegistryEnv, expectId?: string): Promise<Found> {
  const read = readTemplate(await fetchText(url, env));
  if ("reason" in read) throw new RegistryError(`${url} ${read.reason}`);
  if (expectId !== undefined && read.doc.id !== expectId) {
    throw new RegistryError(`${url} holds template "${read.doc.id}", but the index lists it as "${expectId}"`);
  }
  return { source: "remote", location: url, doc: read.doc, entry: templateIndexEntry(read.doc, url.slice(url.lastIndexOf("/") + 1)) };
}

/** Look a name up in remote registries, in order. */
export async function resolveRemote(name: string, registries: string[], env: RegistryEnv, known: string[] = []): Promise<Found> {
  const names = [...known];
  for (const registry of registries) {
    const index = await fetchIndex(registry, env);
    const entry = index.templates.find((t) => t.id === name);
    if (entry) return fetchTemplate(new URL(entry.file, index.url).href, env, name);
    names.push(...index.templates.map((t) => t.id));
  }
  throw notFound(name, registries.map(indexUrl), names);
}

function notFound(name: string, remotes: string[], names: string[]): RegistryError {
  const hit = closest(name, names);
  return new RegistryError(
    `no template "${name}" in .grooph/templates/, the user folder, the built-in library${
      remotes.length > 0 ? ` or ${remotes.join(", ")}` : ""
    }${hit === undefined ? "" : `; did you mean "${hit}"?`} (see grooph template list)`,
  );
}

/**
 * Resolve a template by name: project, user, built-in, then the remote
 * registries (the given ones, or the published library) only on a miss.
 */
export async function resolveTemplate(name: string, env: RegistryEnv, registries: string[] = []): Promise<Found> {
  const local = scanLocal(env).found;
  const hit = local.find((found) => found.doc.id === name);
  if (hit) return hit;
  const remotes = registries.length > 0 ? registries : [env.defaultRegistry];
  const known = local.map((found) => found.doc.id);
  try {
    return await resolveRemote(name, remotes, env, known);
  } catch (err) {
    if (!(err instanceof UnreachableError)) throw err;
    const near = closest(name, known);
    throw new RegistryError(
      `no template "${name}" in .grooph/templates/, the user folder or the built-in library${
        near === undefined ? "" : ` (did you mean "${near}"?)`
      }, and the remote registry ${err.url} could not be reached (${err.reason}). If you are offline, local templates still work: grooph template list`,
    );
  }
}

// ─── writing ──────────────────────────────────────────────────────────────

/** Rewrite a folder's `index.json` from the templates in it (docs/templates.md §3). */
export function writeIndex(dir: string): void {
  const { found } = scanFolder({ source: "project", dir });
  writeText(join(dir, "index.json"), `${JSON.stringify(templateIndex(found.map((f) => f.entry)), null, 2)}\n`);
}

/**
 * Write a template into a registry folder as `<id>.grooph.json` and refresh
 * its index. An existing file is replaced only with `force`; with `bump`, the
 * replacement's version is one past the file it replaces.
 */
export function saveToRegistry(dir: string, doc: Graph, options: { force?: boolean; bump?: boolean } = {}): { path: string; doc: Graph; replaced: boolean } {
  const path = join(dir, `${doc.id}.grooph.json`);
  let saved = doc;
  const replaced = existsSync(path);
  if (replaced) {
    if (options.force !== true) throw new RegistryError(`${path} already exists; pass --force to replace it`);
    if (options.bump === true) {
      const previous = parseGraphText(readFileSync(path, "utf8")).doc;
      saved = { ...doc, version: (previous?.version ?? 0) + 1 };
    }
  }
  mkdirSync(dir, { recursive: true });
  writeText(path, canonicalize(saved));
  writeIndex(dir);
  return { path, doc: saved, replaced };
}
