import { readdirSync } from "node:fs";
import { join } from "node:path";

import { extractTemplate, findSlots, insertFragment, instantiate, validate } from "@grooph/core";
import { describe, expect, test } from "vitest";

import { BUILT_IN_TEMPLATES, filledValues, graphIdFor, slotsOf, templateRefusal } from "../src/doc/templates.js";
import { repoRoot, reviewLoop } from "./helpers.js";

describe("the bundled pattern library (handoff 0007, criterion 2)", () => {
  test("every pattern in patterns/ is bundled, whole graphs before fragments", () => {
    const files = readdirSync(join(repoRoot, "patterns")).filter((f) => f.endsWith(".grooph.json"));
    expect(BUILT_IN_TEMPLATES.map((d) => `${d.id}.grooph.json`).sort()).toEqual(files.sort());
    const kinds = BUILT_IN_TEMPLATES.map((d) => d.template!.kind);
    expect(kinds.indexOf("fragment")).toBeGreaterThan(kinds.lastIndexOf("graph"));
  });

  test("each template lists its slots with the question and the example", () => {
    for (const doc of BUILT_IN_TEMPLATES) {
      const slots = slotsOf(doc);
      expect(slots.map((s) => s.key).sort()).toEqual([...new Set(findSlots(doc).map((u) => u.key))].sort());
      for (const slot of slots) expect(slot.ask.length).toBeGreaterThan(0);
    }
  });
});

describe("use and insert go through core (criteria 3 and 4)", () => {
  const grind = BUILT_IN_TEMPLATES.find((d) => d.id === "grind-loop")!;

  test("an empty answer is left as a slot, and E_UNFILLED_SLOT points at it", () => {
    const values = filledValues({ task: "  Add slugify.  ", "test-command": "   " });
    expect(values).toEqual({ task: "Add slugify." });
    const doc = instantiate(grind, { name: "Slugify", values, id: graphIdFor("Slugify", grind, new Set()) });
    expect(doc.lineage).toEqual({ pattern: "grind-loop", from: `grind-loop@${grind.version}` });
    const unfilled = validate(doc, { forExport: true }).filter((i) => i.code === "E_UNFILLED_SLOT");
    expect(unfilled).toHaveLength(1);
    expect(unfilled[0]!.message).toMatch(/test-command/);
    expect(unfilled[0]!.at.length).toBeGreaterThan(0);
  });

  test("the graph id is unique among the device's graphs and the template's own ids", () => {
    expect(graphIdFor("Slugify", grind, new Set(["slugify"]))).toBe("slugify-2");
    expect(graphIdFor("Builder", grind, new Set())).toBe("builder-2");
  });

  test("a fragment inserts with the ids that collide renamed", () => {
    const fragment = BUILT_IN_TEMPLATES.find((d) => d.template!.kind === "fragment")!;
    const host = reviewLoop();
    const { doc, ids } = insertFragment(host, fragment, { values: {} });
    expect(doc.nodes.length).toBe(host.nodes.length + fragment.nodes.length);
    if (host.nodes.some((n) => n.id === "done")) expect(ids["done"]).not.toBe("done");
  });
});

describe("Yours keeps only templates that validate (fix pass 1, criterion 1)", () => {
  const meta = { id: "build-and-review", title: "Build and review", summary: "A builder and its critic.", whenToUse: "Any change." };
  const fragment = (nodeIds: string[]) => extractTemplate(reviewLoop(), { kind: "fragment", nodeIds, meta });

  test("a fragment that leaves its loop behind is refused, with the CLI's hint", () => {
    const refusal = templateRefusal(fragment(["builder", "critic"]), reviewLoop());
    expect(refusal?.issues.some((i) => i.code === "E_CYCLE_NO_STOP" && i.severity === "error")).toBe(true);
    expect(refusal?.hints).toEqual([
      'loop "review-cycle" stayed behind: a loop comes along only with all its members; add merge-gate (Merge approval) to the selected nodes',
    ]);
  });

  test("the same file, imported without its source graph, is refused with no hint", () => {
    expect(templateRefusal(fragment(["builder", "critic"]))?.hints).toEqual([]);
  });

  test("bringing every member along, or the whole graph, is kept", () => {
    expect(templateRefusal(fragment(["builder", "critic", "merge-gate"]), reviewLoop())).toBeNull();
    expect(templateRefusal(extractTemplate(reviewLoop(), { kind: "graph", meta }), reviewLoop())).toBeNull();
  });

  test("every bundled pattern would be kept", () => {
    for (const doc of BUILT_IN_TEMPLATES) expect(templateRefusal(doc), doc.id).toBeNull();
  });
});
