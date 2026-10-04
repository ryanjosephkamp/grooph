import { describe, expect, it } from "vitest";

import { readPasted } from "../src/ui/Import.js";
import { fixtureText } from "./helpers.js";

/** What a chat hands a person, and what the app makes of it (handoff 0078: wherever Import is offered, a document can be pasted). */
describe("reading what was pasted", () => {
  const doc = fixtureText();
  const same = (text: string): void => expect(JSON.parse(text)).toEqual(JSON.parse(doc));

  it("takes the document alone, with space around it", () => {
    const read = readPasted(`\n\n  ${doc}\n`);
    expect(read.kind).toBe("document");
    if (read.kind === "document") same(read.text);
  });

  it("takes it out of a code fence with a chat's sentences around it", () => {
    const read = readPasted(`Here is the graph. Paste it into grooph:\n\n\`\`\`json\n${doc}\`\`\`\n\nIt has one loop of at most four rounds {see the stops}.`);
    expect(read.kind).toBe("document");
    if (read.kind === "document") same(read.text);
  });

  it("skips a fence that is not the document and takes the one that is", () => {
    const read = readPasted(`Run this first:\n\`\`\`bash\ngrooph validate x.grooph.json\n\`\`\`\nThen the graph:\n\`\`\`\n${doc}\n\`\`\``);
    expect(read.kind).toBe("document");
    if (read.kind === "document") same(read.text);
  });

  it("finds it in prose with no fence, past a brace that is not JSON and braces inside its own strings", () => {
    const tricky = JSON.stringify({ grooph: 0, id: "t", name: 'A "quoted" } name with {braces}', version: 1, goal: "back\\slash }", nodes: [], edges: [], loops: [] });
    const read = readPasted(`The set {a, b} is not it. The graph is ${tricky} and that is all.`);
    expect(read).toEqual({ kind: "document", text: tricky });
  });

  it("takes the graph, not the first JSON in the reply: slot values, an example of operations and a tool's own wrapper come before it", () => {
    const ops = '[{"op":"addNode","kind":"agent","name":"Builder","set":{"role":"builder"}},{"op":"connect","from":"builder","to":"done"}]';
    for (const reply of [
      `I filled it with these values:\n\`\`\`json\n{ "task": "make the checkout test pass", "test-command": "pnpm test checkout" }\n\`\`\`\nand here is the graph:\n\`\`\`json\n${doc}\`\`\``,
      `next: grooph_apply with ops, for example ${ops}\n${doc}`,
      `The values were {"task": "t"} and the graph is ${doc}`,
      `{ oops, a stray brace. The graph: ${doc}`,
      `${"The template asks for {{task}} and {{test-command}}. ".repeat(6)}Filled:\n${doc}`,
    ]) {
      const read = readPasted(reply);
      expect(read.kind, reply.slice(0, 40)).toBe("document");
      if (read.kind === "document") same(read.text);
    }
    // A tool's reply copied whole: the lines, then the graph under "graph".
    const wrapped = readPasted(JSON.stringify({ text: "applied 1 operation", ok: true, graph: JSON.parse(doc) as unknown, issues: [] }));
    expect(wrapped.kind).toBe("document");
    if (wrapped.kind === "document") same(wrapped.text);
  });

  it("opens a link when the only JSON beside it is not a document", () => {
    expect(readPasted("Here {} is the link: https://ryanjosephkamp.github.io/grooph/#/open?d=AbC_1")).toEqual({ kind: "link", payload: "AbC_1" });
  });

  it("hands on a whole object that is not a grooph document, so the person is told what it lacks", () => {
    expect(readPasted('It is {"id": "x", "nodes": []} I think')).toEqual({ kind: "document", text: '{"id": "x", "nodes": []}' });
  });

  it("recognizes a grooph link, alone or in a sentence, as a link to open", () => {
    expect(readPasted("https://ryanjosephkamp.github.io/grooph/#/open?d=AbC-_123")).toEqual({ kind: "link", payload: "AbC-_123" });
    expect(readPasted("Open this on your phone: http://localhost:4362/grooph/#/open?d=xyz_9 (it is the lean one)")).toEqual({ kind: "link", payload: "xyz_9" });
    expect(readPasted("https://ryanjosephkamp.github.io/grooph/#/embed?theme=dark&d=Q1w2")).toEqual({ kind: "link", payload: "Q1w2" });
  });

  it("says there is nothing when there is nothing: no text, prose, a list, a document cut short", () => {
    for (const text of ["", "   \n ", "make me a graph please", "[1, 2, 3]", doc.slice(0, doc.length / 2), "https://example.com/#/about"]) {
      expect(readPasted(text), JSON.stringify(text.slice(0, 30))).toEqual({ kind: "nothing" });
    }
  });
});
