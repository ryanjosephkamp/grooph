import { describe, expect, it } from "vitest";

import { PASTE_LIMIT, openPasted, readPasted, type ImportHost } from "../src/ui/Import.js";
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

/** What the driver's fourth reader found in the reader (handoff 0078). */
describe("what a paste may not do", () => {
  const doc = fixtureText();
  /** A host that only listens: what was said, and whether the box was shut. */
  const listening = (): { host: ImportHost; said: string[] } => {
    const said: string[] = [];
    return { said, host: { open: () => undefined, route: () => "", problem: (p) => void (p && said.push(p.what ?? p.issues.map((i) => i.message).join("; "))), offer: () => undefined, close: () => undefined } };
  };

  it("takes the first document by where it stands, fenced or not", () => {
    const first = JSON.stringify({ ...(JSON.parse(doc) as object), id: "the-first" });
    const second = JSON.stringify({ ...(JSON.parse(doc) as object), id: "the-second" });
    for (const text of [
      `The one to open: ${first}\nAn older one, for comparison:\n\`\`\`json\n${second}\n\`\`\``,
      `\`\`\`json\n${first}\n\`\`\`\nand unfenced, later: ${second}`,
      `${first}\n${second}`,
    ]) {
      const read = readPasted(text);
      expect(read.kind).toBe("document");
      if (read.kind === "document") expect((JSON.parse(read.text) as { id: string }).id).toBe("the-first");
    }
  });

  it("looks through no more than a megabyte, and says so in a plain sentence", async () => {
    const began = performance.now();
    const braces = "{".repeat(32 * 1024 * 1024);
    expect(readPasted(braces)).toEqual({ kind: "nothing" });
    const { host, said } = listening();
    expect(await openPasted(braces, host)).toBe(false);
    expect(said).toEqual(["It is over a megabyte, and a grooph document is a few kilobytes. Paste the document alone."]);
    // On the screen itself, with no box open, nothing is said.
    const quiet = listening();
    expect(await openPasted(braces, quiet.host, true)).toBe(false);
    expect(quiet.said).toEqual([]);
    expect(performance.now() - began).toBeLessThan(1000);
    // Just under the limit, braces that never close are walked a few times and no more.
    const under = performance.now();
    expect(readPasted("{".repeat(PASTE_LIMIT - 1))).toEqual({ kind: "nothing" });
    expect(readPasted(`${"{ ".repeat(PASTE_LIMIT / 4)}${doc}`)).toEqual({ kind: "nothing" });
    // A few stray braces before a document are a sentence someone wrote, and the document is still found.
    expect(readPasted(`set {a, {b and {c:\n${doc}`).kind).toBe("document");
    expect(performance.now() - under).toBeLessThan(1000);
  });

  it("says that a document nested ten thousand deep could not be read, and throws nothing", async () => {
    const deep = `${"[".repeat(10_000)}${"]".repeat(10_000)}`;
    const wrapped = `{"graph": {"grooph": 0, "id": "deep", "name": "Deep", "version": 1, "nodes": ${deep}, "edges": [], "loops": []}}`;
    for (const text of [wrapped, `{"grooph": 0, "id": "deep", "name": "Deep", "version": 1, "nodes": ${deep}, "edges": [], "loops": []}`]) {
      const { host, said } = listening();
      expect(await openPasted(text, host)).toBe(false);
      expect(said.length).toBe(1);
    }
  });
});
