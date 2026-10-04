import { STOP_KIND_WORDS, endName, type Graph, type Id, type OperationMap, type ReplayStep } from "@grooph/core";

/**
 * Core's picture is markup with `data-node`, `data-loop`, `data-session` and
 * `data-handoff` on its parts (docs/exports.md). Here those parts become
 * things a finger or a keyboard can reach, and, in a replay, carry the run's
 * state: `data-state` on each node (styled in embed.css), a pill with the
 * state in words, and each loop's round. State is never colour alone.
 */

const SVG = "http://www.w3.org/2000/svg";
const KIND: Record<string, string> = { agent: "Agent", "human-gate": "Human gate", check: "Check", merge: "Merge", stop: "Stop" };
/** Drawn by the replay, removed and drawn again at every step. */
const MARK = "gx-inj";

function reachable(el: Element, label: string): void {
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", label);
}

const num = (el: Element | null, attr: string): number => Number(el?.getAttribute(attr) ?? 0);

/** A pill of words in the picture, its right edge at `right` and its text's baseline at `y`. */
function pill(parent: Element, right: number, y: number, words: string, state: string): void {
  const g = document.createElementNS(SVG, "g");
  g.setAttribute("class", `${MARK} gx-pill`);
  g.setAttribute("data-state", state);
  g.setAttribute("aria-hidden", "true");
  const rect = document.createElementNS(SVG, "rect");
  const text = document.createElementNS(SVG, "text");
  text.setAttribute("font-size", "9.5");
  text.setAttribute("font-weight", "700");
  text.setAttribute("text-anchor", "end");
  text.setAttribute("x", String(right - 6));
  text.setAttribute("y", String(y));
  text.textContent = words;
  g.append(rect, text);
  parent.append(g);
  const width = (text.getComputedTextLength?.() || words.length * 5.6) + 12;
  rect.setAttribute("x", String(right - width));
  rect.setAttribute("y", String(y - 10));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", "13.5");
  rect.setAttribute("rx", "6.75");
}

const STATE_WORD: Record<string, string> = { running: "running", passed: "passed", failed: "failed", halted: "halted" };

export function decorateGraph(root: SVGSVGElement, doc: Graph, replay?: { step: ReplayStep; last: boolean }): void {
  for (const el of root.querySelectorAll(`.${MARK}`)) el.remove();
  const summary = replay?.step.summary;
  const focus = replay?.step.focus;

  for (const g of root.querySelectorAll<SVGGElement>("g[data-node]")) {
    const id = g.dataset["node"]!;
    const node = doc.nodes.find((n) => n.id === id);
    const run = summary?.nodes[id];
    const kind = node ? (KIND[node.kind] ?? node.kind) : "Node";
    reachable(g, `${kind} ${node?.name || id}${run && run.state !== "pending" ? `, ${run.state}` : run ? ", not reached yet" : ""}`);
    if (!run) {
      delete g.dataset["state"];
      delete g.dataset["focus"];
      continue;
    }
    g.dataset["state"] = run.state;
    if (focus && focus.kind === "node" && focus.id === id) g.dataset["focus"] = "";
    else delete g.dataset["focus"];
    const word = STATE_WORD[run.state];
    if (!word) continue;
    const card = g.querySelector("rect[data-card]");
    if (!card) continue;
    const loops = doc.loops.filter((l) => l.members.includes(id)).length;
    const right = num(card, "x") + num(card, "width") - 10 - loops * 10 - (loops > 0 ? 4 : 0);
    pill(g, right, num(card, "y") + 18, `${word}${run.runs > 1 ? ` ×${run.runs}` : ""}`, run.state);
  }

  const width = Number(root.getAttribute("width") ?? 400);
  for (const g of root.querySelectorAll<SVGGElement>("g[data-loop]")) {
    const id = g.dataset["loop"]!;
    const loop = doc.loops.find((l) => l.id === id);
    const run = summary?.loops[id];
    reachable(g, `Loop ${loop?.name || id}${run ? `, ${loopWords(run)}` : ""}`);
    if (focus && focus.kind === "loop" && focus.id === id) g.dataset["focus"] = "";
    else delete g.dataset["focus"];
    if (!run || run.round === null) continue;
    const first = g.querySelector("text");
    const fired = run.lastStop?.fired;
    pill(g, width - 12, num(first, "y"), loopWords(run), fired ? "stopped" : "round");
  }

  // The edge a note names was the one taken.
  for (const g of root.querySelectorAll<SVGGElement>("g[data-edge]")) {
    if (focus && focus.kind === "edge" && focus.id === g.dataset["edge"]) g.dataset["focus"] = "";
    else delete g.dataset["focus"];
  }
}

function loopWords(run: { round: number | null; lastStop?: { fired?: keyof typeof STOP_KIND_WORDS } }): string {
  if (run.round === null) return "not entered";
  return `round ${run.round}${run.lastStop?.fired ? ` · ${STOP_KIND_WORDS[run.lastStop.fired]}` : ""}`;
}

export function decorateMap(root: SVGSVGElement, map: OperationMap): void {
  const numberOf = (id: Id): number => map.handoffs.findIndex((h) => h.id === id) + 1;
  for (const el of root.querySelectorAll<SVGGElement>("[data-session]")) reachable(el, `Session ${endName(map, el.dataset["session"]!)}`);
  for (const el of root.querySelectorAll<SVGGElement>("[data-person]")) reachable(el, `Person ${endName(map, el.dataset["person"]!)}`);
  for (const el of root.querySelectorAll<SVGGElement>("[data-handoff-row]")) {
    const id = el.dataset["handoffRow"]!;
    const h = map.handoffs.find((x) => x.id === id);
    reachable(el, h ? `Handoff ${numberOf(id)}: ${endName(map, h.from)} to ${endName(map, h.to)}` : `Handoff ${id}`);
  }
}
