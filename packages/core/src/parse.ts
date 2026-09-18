import { error, type Issue } from "./issues.js";
import { graphSchema } from "./schema/graph.js";
import type { Graph } from "./types.js";

export type ParseResult = { doc?: Graph; issues: Issue[] };

/**
 * Check an unknown JSON value against the graph document schema.
 *
 * A schema failure yields `E_SCHEMA` issues whose message names the JSON
 * Pointer path (graph-ir §3). `doc` is present only when there are none.
 */
export function parseGraph(json: unknown): ParseResult {
  const schemaIssues: { path: string; message: string }[] = [];
  graphSchema.check(json, "", schemaIssues);

  if (schemaIssues.length > 0) {
    return {
      issues: schemaIssues.map((issue) =>
        error("E_SCHEMA", `${issue.path === "" ? "/" : issue.path}: ${issue.message}`, nearestIds(json, issue.path)),
      ),
    };
  }
  return { doc: json as Graph, issues: [] };
}

/** Parse JSON text, reporting a syntax error as `E_SCHEMA` too. */
export function parseGraphText(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { issues: [error("E_SCHEMA", `/: not valid JSON: ${(err as Error).message}`)] };
  }
  return parseGraph(json);
}

/**
 * Best-effort `at` for a path-based issue (`E_SCHEMA`, `W_UNKNOWN_KEY`): the id of the nearest enclosing object
 * that has one, so a view can highlight the offending node or edge.
 */
export function nearestIds(root: unknown, path: string): string[] {
  const segments = path.split("/").filter((s) => s !== "");
  let cursor: unknown = root;
  let found: string | undefined;
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== "object") break;
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    cursor = (cursor as Record<string, unknown>)[key];
    if (cursor !== null && typeof cursor === "object" && !Array.isArray(cursor)) {
      const candidate = (cursor as Record<string, unknown>)["id"];
      if (typeof candidate === "string") found = candidate;
    }
  }
  return found === undefined ? [] : [found];
}
