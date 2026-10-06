/**
 * Export: the package `compile()` emits, untouched, zipped at the paths the
 * target profile gives. Refusal carries the same issue list the CLI prints.
 *
 * The compiler is fetched when a person first exports (slice 0070). It is a seventh of core as the app carries
 * it, and no screen needs it to open; the refusal is the validator's and needs none of it.
 */
import { KNOWN_TARGETS, canonicalize, parseGraph, validate, type CompileResult, type CompileTarget, type Graph, type Issue } from "@grooph/core";
import { strToU8, zipSync, type Zippable } from "fflate";

import { piece } from "../piece.js";

export type ExportAttempt =
  | { ok: true; target: CompileTarget; result: CompileResult }
  | { ok: false; target: string; reason: "schema" | "rules"; issues: Issue[] }
  /** Not a rule of the document: its id is a folder grooph keeps under `.grooph/`, where its package would go. `said` is the compiler's sentence. */
  | { ok: false; target: string; reason: "id"; issues: Issue[]; said: string };

type Compiler = typeof import("@grooph/core/compile");
let compiler: Compiler | undefined;

/**
 * Fetch the compiler, once it has come. The editor asks for it soon after it opens, so the Export panel seldom
 * waits. A fetch that fails is tried again there and then (`piece.ts`), and the next call asks afresh.
 */
export function loadCompiler(): Promise<Compiler> {
  return piece("compile", () => import("@grooph/core/compile")).then((m) => (compiler = m));
}

/** Whether the compiler is here, so `attemptExport` can answer for a graph that validates. */
export const compilerHere = (): boolean => compiler !== undefined;

/**
 * A known harness compiles with its own profile; any other harness fails `E_NO_TARGET` in the validator.
 * `undefined` when the graph validates and the compiler has not arrived yet (`loadCompiler`).
 */
export function attemptExport(doc: Graph): ExportAttempt | undefined {
  const harness = doc.target?.harness;
  const target = (harness !== undefined && KNOWN_TARGETS.includes(harness) ? harness : "claude-code") as CompileTarget;
  const parsed = parseGraph(doc);
  if (!parsed.doc) return { ok: false, target: harness ?? "(none)", reason: "schema", issues: parsed.issues };
  // The same check the compiler opens with, so a refusal reads the same whether or not the compiler is here.
  const issues = validate(parsed.doc, { forExport: true });
  if (issues.some((issue) => issue.severity === "error")) return { ok: false, target: harness ?? "(none)", reason: "rules", issues };
  if (!compiler) return undefined;
  // The same refusal, in the same words, that `grooph export` and the grooph_export tool give (handoff 0078).
  const kept = compiler.keptFolder(parsed.doc.id);
  if (kept !== undefined) return { ok: false, target, reason: "id", issues: [], said: kept };
  const attempt = compiler.tryCompile(parsed.doc, target);
  return attempt.ok
    ? { ok: true, target, result: attempt.result }
    : { ok: false, target: harness ?? "(none)", reason: "rules", issues: attempt.issues };
}

/** The package as a zip, one entry per file, at the package's own paths. */
export function zipPackage(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const entries: Zippable = {};
  for (const [path, contents] of Object.entries(files)) entries[path] = strToU8(contents);
  return new Uint8Array(zipSync(entries, { level: 6 }));
}

/** The graph as a file, in canonical form (graph-ir §7) — also while it is still incomplete. */
export const graphFileText = (doc: Graph): string => canonicalize(doc);

export const graphFileName = (doc: Graph): string => `${doc.id || "graph"}.grooph.json`;
export const packageFileName = (doc: Graph, target: string): string => `${doc.id || "graph"}-${target}.zip`;

export function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Clipboard with a fallback for browsers that refuse the async API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
