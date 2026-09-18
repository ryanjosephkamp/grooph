/**
 * Export: the package `compile()` emits, untouched, zipped at the paths the
 * target profile gives. Refusal carries the same issue list the CLI prints.
 */
import {
  KNOWN_TARGETS,
  canonicalize,
  parseGraph,
  tryCompile,
  type CompileResult,
  type CompileTarget,
  type Graph,
  type Issue,
} from "@grooph/core";
import { strToU8, zipSync, type Zippable } from "fflate";

export type ExportAttempt =
  | { ok: true; target: CompileTarget; result: CompileResult }
  | { ok: false; target: string; reason: "schema" | "rules"; issues: Issue[] };

/** `claude-code` is the only compile target today; any other harness fails `E_NO_TARGET` in the validator. */
export function attemptExport(doc: Graph): ExportAttempt {
  const harness = doc.target?.harness;
  const target = (harness !== undefined && KNOWN_TARGETS.includes(harness) ? harness : "claude-code") as CompileTarget;
  const parsed = parseGraph(doc);
  if (!parsed.doc) return { ok: false, target: harness ?? "(none)", reason: "schema", issues: parsed.issues };
  const attempt = tryCompile(parsed.doc, target);
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
