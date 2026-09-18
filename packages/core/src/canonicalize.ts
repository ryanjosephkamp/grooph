import { graphSchema } from "./schema/graph.js";
import type { Graph } from "./types.js";

/**
 * Canonical form (graph-ir §7): two-space indent, LF line endings, one trailing
 * newline, object keys in the order the types declare them (unknown keys last,
 * alphabetical), arrays in document order, `layout` last.
 *
 * Deterministic and idempotent: `canonicalize(parse(canonicalize(d))) === canonicalize(d)`.
 */
export function canonicalize(doc: Graph): string {
  return `${JSON.stringify(graphSchema.canon(doc), null, 2)}\n`;
}

/**
 * The canonical form the size lint measures: `layout` removed (graph-ir §7).
 * Layout is separable (amendment A-005), so it never counts against the
 * "small enough to rewrite in one pass" budget.
 */
export function canonicalizeWithoutLayout(doc: Graph): string {
  const { layout: _layout, ...rest } = doc;
  return canonicalize(rest as Graph);
}
