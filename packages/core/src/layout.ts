/**
 * Automatic layout for documents without `layout` (amendment A-005): what an
 * agent-built graph looks like when it first opens, and the shape the glyph
 * draws. Positions computed here are view state; they reach the document only
 * when a person moves a node or saves the layout.
 *
 * Top to bottom, because the phone is portrait. Loop back edges are known, so
 * they are left out of the ranking and the rest is a DAG in all but odd cases
 * (a cycle no loop covers), which a depth-first pass breaks. Deterministic:
 * document order breaks every tie, so the app, the CLI and a write-up agree.
 *
 * Moved here from the web app in slice 0015 so `glyph()` and the canvas share
 * one layout; the app imports it from core.
 */

import type { Graph, Id } from "./types.js";
import type { Position } from "./ops/edit.js";

/** The size of a laid-out node and the gaps between them. */
export type LayoutBox = { width: number; height: number; gapX: number; gapY: number };

/** The editor's node, which is what a saved `layout` is measured in. */
export const DEFAULT_LAYOUT_BOX: LayoutBox = { width: 200, height: 84, gapX: 36, gapY: 76 };

/**
 * The nodes in rank order: row 0 holds the entries, each later row the nodes
 * one forward edge further on (longest path), each row sorted to reduce
 * crossings with the row above. Every node appears exactly once.
 */
export function layerNodes(doc: Graph): Id[][] {
  const nodes = doc.nodes.map((n) => n.id);
  const known = new Set(nodes);
  const back = new Set(doc.loops.flatMap((l) => l.back));
  const forward = doc.edges.filter((e) => !back.has(e.id) && known.has(e.from) && known.has(e.to) && e.from !== e.to);
  const dag = breakCycles(nodes, forward.map((e) => [e.from, e.to] as const));

  // Longest-path ranking.
  const preds = new Map<Id, Id[]>(nodes.map((id) => [id, []]));
  for (const [from, to] of dag) preds.get(to)!.push(from);
  const rank = new Map<Id, number>();
  const rankOf = (id: Id, seen: Set<Id>): number => {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    seen.add(id);
    let r = 0;
    for (const p of preds.get(id)!) if (!seen.has(p)) r = Math.max(r, rankOf(p, seen) + 1);
    seen.delete(id);
    rank.set(id, r);
    return r;
  };
  for (const id of nodes) rankOf(id, new Set());

  const rows: Id[][] = [];
  for (const id of nodes) (rows[rank.get(id)!] ??= []).push(id);

  // Two barycenter sweeps to untangle crossings; document order breaks ties.
  const neighbours = new Map<Id, Id[]>(nodes.map((id) => [id, []]));
  for (const [from, to] of dag) {
    neighbours.get(from)!.push(to);
    neighbours.get(to)!.push(from);
  }
  const docOrder = new Map(nodes.map((id, i) => [id, i]));
  for (let sweep = 0; sweep < 2; sweep++) {
    const index = new Map<Id, number>();
    rows.forEach((row) => row?.forEach((id, i) => index.set(id, i)));
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const bary = (id: Id): number => {
        const above = neighbours.get(id)!.filter((n) => rank.get(n) === r - 1);
        return above.length === 0 ? index.get(id)! : above.reduce((sum, n) => sum + index.get(n)!, 0) / above.length;
      };
      row.sort((a, b) => bary(a) - bary(b) || docOrder.get(a)! - docOrder.get(b)!);
      row.forEach((id, i) => index.set(id, i));
    }
  }
  return rows.filter((row): row is Id[] => row !== undefined);
}

/**
 * A position for every node, whether or not the document carries one: the
 * ranks of `layerNodes` as rows, each centred on x = 0, a row wrapping after
 * `columns` nodes so a wide fan-out stays legible on a phone.
 */
export function autoLayout(doc: Graph, columns = 4, box: LayoutBox = DEFAULT_LAYOUT_BOX): Record<Id, Position> {
  const positions: Record<Id, Position> = {};
  let y = 0;
  for (const row of layerNodes(doc)) {
    for (let start = 0; start < row.length; start += columns) {
      const line = row.slice(start, start + columns);
      const width = line.length * box.width + (line.length - 1) * box.gapX;
      line.forEach((id, i) => {
        positions[id] = { x: Math.round(i * (box.width + box.gapX) - width / 2), y };
      });
      y += box.height + box.gapY;
    }
  }
  return positions;
}

/**
 * The position of every node on the canvas: the document's layout where it
 * has one; otherwise automatic. Nodes missing from a partial layout are laid
 * out automatically and set below what is already placed, so nothing overlaps.
 */
export function resolvePositions(doc: Graph, columns = 4, box: LayoutBox = DEFAULT_LAYOUT_BOX): { positions: Record<Id, Position>; unplaced: Id[] } {
  const layout = doc.layout ?? {};
  const unplaced = doc.nodes.map((n) => n.id).filter((id) => !(id in layout));
  if (unplaced.length === 0) {
    const positions: Record<Id, Position> = {};
    for (const n of doc.nodes) positions[n.id] = { x: layout[n.id]!.x, y: layout[n.id]!.y };
    return { positions, unplaced };
  }

  const auto = autoLayout(doc, columns, box);
  const placed = doc.nodes.filter((n) => n.id in layout);
  if (placed.length === 0) return { positions: auto, unplaced };

  const positions: Record<Id, Position> = {};
  for (const n of placed) positions[n.id] = { x: layout[n.id]!.x, y: layout[n.id]!.y };
  const minX = Math.min(...placed.map((n) => layout[n.id]!.x));
  const maxY = Math.max(...placed.map((n) => layout[n.id]!.y));
  const autoMinX = Math.min(...unplaced.map((id) => auto[id]!.x));
  const autoMinY = Math.min(...unplaced.map((id) => auto[id]!.y));
  for (const id of unplaced) {
    positions[id] = { x: minX + auto[id]!.x - autoMinX, y: maxY + box.height + box.gapY + auto[id]!.y - autoMinY };
  }
  return { positions, unplaced };
}

/** Drop the edges that close a cycle, found depth first in document order. */
function breakCycles(nodes: Id[], edges: (readonly [Id, Id])[]): (readonly [Id, Id])[] {
  const out = new Map<Id, (readonly [Id, Id])[]>(nodes.map((id) => [id, []]));
  for (const edge of edges) out.get(edge[0])!.push(edge);
  const state = new Map<Id, 1 | 2>();
  const kept: (readonly [Id, Id])[] = [];
  const visit = (id: Id): void => {
    state.set(id, 1);
    for (const edge of out.get(id)!) {
      const s = state.get(edge[1]);
      if (s === 1) continue; // closes a cycle
      kept.push(edge);
      if (s === undefined) visit(edge[1]);
    }
    state.set(id, 2);
  };
  for (const id of nodes) if (!state.has(id)) visit(id);
  return kept;
}
