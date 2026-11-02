/**
 * A loop graph as the stairs' scene: its sheets with their cards, its edges as links in the order of
 * a first pass, and what the slider says at each. A loop is a sheet with its members standing on it; a node in a
 * loop inside a loop stands on the inner one. A subgrooph is a sheet. What is in neither stands on a sheet of its
 * own, first, because that is where a run begins and ends. So what repeats is seen as a place, and an edge that
 * leaves a sheet is an edge that enters or leaves a loop. The stairs themselves are `stairs.ts`.
 *
 * Behind a door of its own: the web app's switch between the picture and the views in three dimensions
 * (`apps/web/src/ui/canvas/graph-views.tsx`) builds the scene, and is a piece fetched once a canvas is drawn.
 */
import { layerNodes } from "../../layout.js";
import { replaySteps } from "../../replay.js";
import { describeStop, edgeWhen, edgeWhenLabel, roleName } from "../../semantics.js";
import type { Edge, Graph, Id, Node, RunNote } from "../../types.js";
import { esc } from "../../xml.js";
import { mapKit } from "../map-kit.js";
import type { Scene } from "./stairs.js";

/**
 * A graph's kinds of view in three dimensions, in the order the app offers them: each with its name and what it is,
 * in a sentence. The app's row of kinds says it (`apps/web/src/ui/canvas/graph-views.tsx`), and so does a still.
 */
export const KINDS_3D = [
  ["stairs", "Stairs", "Each loop is a floor with its own nodes standing on it; a loop inside it has a floor of its own."],
  ["panes", "Panes", "The picture as it is, with each loop and each subgrooph lifted toward you on a pane of its own."],
  ["spiral", "Spiral", "Each loop is a spiral: a round is one turn upward, and the brakes that count rounds are places on the way up, the lid where max iterations stops it."],
  ["rings", "Rings", "Each loop is a ring, with its own nodes standing around it; a loop inside another is a ring standing on the outer one."],
  ["columns", "Columns", "Every node where the picture has it, an agent as a column: taller for a higher tier (an order, not a model), and on a run a block for each dispatch, as tall as its own minutes."],
] as const;

/** A node that is not an agent, in a word, and the tone its card is drawn in. */
export const KIND: Record<Exclude<Node["kind"], "agent">, [string, "gate" | "check" | "merge" | "stop"]> = { "human-gate": ["Human gate", "gate"], check: ["Check", "check"], merge: ["Merge", "merge"], stop: ["Stop", "stop"] };

/** The edges of a first pass, in the order of the graph's layers, and then each loop's back edges: one turn of each. */
export function firstPass(doc: Graph): { edge: Edge; loop?: Graph["loops"][number] }[] {
  const rank = new Map(layerNodes(doc).flat().map((id, k) => [id, k]));
  const known = (e: Edge | undefined): e is Edge => !!e && rank.has(e.from) && rank.has(e.to);
  const back = new Map(doc.loops.flatMap((loop) => loop.back.map((id) => [id, loop] as const)));
  const forward = doc.edges.filter((e) => known(e) && !back.has(e.id)).sort((a, b) => rank.get(a.from)! - rank.get(b.from)! || rank.get(a.to)! - rank.get(b.to)!);
  const turns = [...back].map(([id, loop]) => ({ edge: doc.edges.find((e) => e.id === id), loop })).filter((t): t is { edge: Edge; loop: Graph["loops"][number] } => known(t.edge));
  return [...forward.map((edge) => ({ edge })), ...turns];
}

/**
 * A graph as a scene: its sheets with their cards, its edges as links in the order of a first pass, and what the
 * slider says at each. `card` is how wide a card is, which is the scene's to say.
 */
export function graphScene(doc: Graph, per: number, card: number, notes?: readonly RunNote[]): Scene {
  // The kit's parts by name: imported as the list, they add no names to the file every address loads (`map-kit.ts`).
  const [, , , , , , , , , , , , , , , inkFor, , , , , , , rect, , , , text, , wrap] = mapKit;
  const ink = inkFor("auto");
  const nameOf = (id: Id): string => doc.nodes.find((n) => n.id === id)?.name || id;
  const order = layerNodes(doc).flat();
  const at = new Map(order.map((id, k) => [id, k]));

  // Where each node stands: its innermost loop, else its subgrooph, else the first sheet.
  const loops = doc.loops.map((loop, k) => ({ loop, k, members: new Set(loop.members) }));
  const units = (doc.groups ?? []).filter((g) => g.from);
  const home = (id: Id): string => {
    const inner = loops.filter((l) => l.members.has(id)).sort((a, b) => a.members.size - b.members.size)[0];
    if (inner) return `loop ${inner.loop.id}`;
    const unit = units.find((g) => g.members.includes(id));
    return unit ? `unit ${unit.id}` : "";
  };
  const standing = new Map<string, Node[]>();
  for (const id of order) {
    const node = doc.nodes.find((n) => n.id === id)!;
    (standing.get(home(id)) ?? standing.set(home(id), []).get(home(id))!).push(node);
  }
  const drawn = (node: Node): Scene["sheets"][number]["items"][number] => {
    // A person's step: "Person" before its role, in a gate's tone, and no tier, as in Panes.
    const persons = node.kind === "agent" && node.by === "person";
    const [under, tone] = node.kind === "agent" ? (persons ? [`Person · ${roleName(node)}`, "gate" as const] : [roleName(node), "accent" as const]) : KIND[node.kind];
    const tier = node.kind === "agent" && !persons && node.model ? node.model.tier : "";
    const lines = wrap(node.name || node.id, card - 16, 12.5, 3, "bold");
    const h = 7 + lines.length * 15 + 13 + (tier ? 11.5 : 0) + 6;
    return {
      id: node.id,
      h,
      svg: () => {
        // A gate keeps its heavy outline and a stop its square corners, as in the picture: shape before color.
        const frame = node.kind === "human-gate" ? { fill: ink("gate-soft"), stroke: ink("gate"), rx: 12, width: 1.8 } : { fill: ink("surface"), stroke: ink(node.kind === "agent" ? "line-strong" : tone), rx: node.kind === "stop" ? 2 : 8, width: node.kind === "agent" ? 1 : 1.4 };
        let y = 5;
        const words = lines.map((line) => text(8, (y += 15), line, { size: 12.5, fill: ink("ink"), weight: "bold" }));
        return `<g data-node="${esc(node.id)}" data-kind="${node.kind}">${rect(0.7, 0.7, card - 1.4, h - 1.4, { ...frame, mark: "card" })}${words.join("")}${text(8, (y += 13), wrap(under, card - 16, 9.5, 1, "bold")[0]!, { size: 9.5, fill: ink(tone), weight: "bold" })}${tier ? text(8, y + 11.5, tier, { size: 9, fill: ink("ink-3") }) : ""}</g>`;
      },
    };
  };
  // The first sheet, then each loop and subgrooph that has a node of its own, in the order a first pass meets them.
  const others = [...standing.keys()].filter((key) => key !== "").sort((a, b) => at.get(standing.get(a)![0]!.id)! - at.get(standing.get(b)![0]!.id)!);
  const sheets: Scene["sheets"] = [...(standing.has("") || others.length === 0 ? [""] : []), ...others].map((key, k) => {
    const items = (standing.get(key) ?? []).map(drawn);
    const found = loops.find((l) => `loop ${l.loop.id}` === key);
    const unit = units.find((g) => `unit ${g.id}` === key);
    if (found) {
      const outer = loops.filter((l) => l !== found && found.loop.members.every((id) => l.members.has(id))).sort((a, b) => a.members.size - b.members.size)[0];
      return { cls: "", mark: `data-loop="${esc(found.loop.id)}"`, name: found.loop.name || found.loop.id, place: "loop", sub: `${outer ? `inside ${outer.loop.name || outer.loop.id} · ` : ""}stops: ${found.loop.stops.map(describeStop).join("; ")}`, gap: k === 0 ? 0 : 1, items };
    }
    if (unit) return { cls: "", mark: `data-unit="${esc(unit.id)}"`, name: unit.name || unit.id, place: "subgrooph", sub: `from ${unit.from}`, gap: k === 0 ? 0 : 1, items };
    return { cls: " is-people", mark: 'data-outside=""', name: others.length ? "Outside any loop" : doc.name || doc.id, place: "", sub: others.length ? "what a run passes once" : "no loop", gap: 0, items };
  });

  const pass = firstPass(doc);
  const links: Scene["links"] = pass.map(({ edge, loop }, k) => ({ id: edge.id, n: k + 1, from: edge.from, to: edge.to, style: loop ? { color: `loop-${doc.loops.indexOf(loop) % 4}` as "loop-0", dash: "6 4", width: 2.2 } : { color: "ink-2", width: 1.6 } }));
  const total = pass.length;
  const stops: Scene["stops"] = [{ short: "all steps", says: total === 0 ? "This graph has no edges to step through." : total === 1 ? "The graph's one edge is lit." : `All ${total} steps are lit. Move the slider or press Play to follow a first pass, one edge at a time.` }];
  pass.forEach(({ edge, loop }, k) => {
    const when = edgeWhen(edge) === "always" ? "" : ` · when ${edgeWhenLabel(edge)}`;
    stops.push({ handoff: edge.id, short: `step ${k + 1} of ${total}`, says: `Step ${k + 1} of ${total}: ${edge.from === edge.to ? `${nameOf(edge.from)} to itself` : `${nameOf(edge.from)} to ${nameOf(edge.to)}`}${when}${loop ? ` · back into ${loop.name || loop.id}: another round, until ${loop.stops.map(describeStop).join("; ")}` : ""}` });
  });
  const words = { title: doc.name || doc.id, sheets, links, per, link: "edge", links_: "edges", none: " · no nodes", flat: ' The picture shows the same graph, flat. <button type="button" data-flat="picture">Picture</button>' };
  if (notes?.length) {
    // A run's notes, as its replay reads them. A note lights what it is about and leaves the rest as it is: the
    // order here is the run's, not the order the arcs are numbered in.
    const replay = replaySteps(notes, doc);
    const drawn = new Set(sheets.map((s) => s.mark));
    const lit = (focus: (typeof replay.steps)[number]["focus"]): Partial<Scene["stops"][number]> =>
      focus?.kind === "edge" ? { handoff: focus.id } : focus?.kind === "node" ? { ends: [focus.id] } : focus?.kind === "loop" ? (drawn.has(`data-loop="${esc(focus.id)}"`) ? { sheet: `data-loop="${esc(focus.id)}"` } : { ends: doc.loops.find((l) => l.id === focus.id)?.members ?? [] }) : {};
    return {
      ...words,
      stops: replay.steps.map((step, k) =>
        k === 0 ? { short: "before the run", says: `Before the run: ${notes.length} note${notes.length === 1 ? "" : "s"} to follow. Move the slider or press Play.` } : { short: `note ${k} of ${notes.length}`, says: `Note ${k} of ${notes.length}: ${step.caption}`, alone: true, ...lit(step.focus) },
      ),
      step: "note",
      range: "Note, in the order the run wrote them",
      note: `The run's own notes, in the order it wrote them. ${replay.end.line}`,
    };
  }
  return {
    ...words,
    stops,
    range: "Step, in the order a first pass takes them",
    note: "The edges a first pass takes, in order, and then one turn of each loop. An order, not a clock: a graph records no times.",
  };
}
