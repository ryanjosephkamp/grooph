import { describe, expect, it } from "vitest";

import { readPasted } from "../src/store/library.js";
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
