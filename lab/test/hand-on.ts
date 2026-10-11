/**
 * A program for one test (command.test.ts): it calls the lab's `run()` with each of the product's arguments and
 * prints what came of it as one line of JSON.
 *
 * It is a process of its own because of what a failure looks like. Were `run()` to drop the reader it was given, the
 * product would read the real standard input, and a test must not sit waiting on that: the test starts this with
 * standard input closed, so the product reads nothing and says so. And what stands in for the environment is chosen
 * so that dropping it does nothing but read: the product would list its own templates, where a stand-in that opens
 * a browser, dropped, would open a real one.
 */

import { run } from "../src/index.js";

const [graph, empty] = process.argv.slice(2);
if (graph === undefined || empty === undefined) throw new Error("usage: hand-on.js <graph file> <an empty folder>");

const stdout: string[] = [];
const stderr: string[] = [];
const io = { out: (line: string) => void stdout.push(line), err: (line: string) => void stderr.push(line) };

// Where the output goes.
const validated = await run(["validate", graph], io);

// Standard input: the ops are read from the reader it was given.
let read = 0;
const applied = await run(["apply", graph, "--ops", "-"], io, () => {
  read += 1;
  return JSON.stringify([{ op: "setTarget", harness: "codex" }]);
});

// What a run may reach: the templates it lists are the ones in the folders it was given, which hold none.
let fetched = 0;
const nowhere = { cwd: empty, userDir: empty, builtinDir: empty, plansDir: empty, defaultRegistry: "http://127.0.0.1:9/unreachable/index.json" };
const listed = await run(["template", "list"], io, () => "", {
  ...nowhere,
  fetch: async () => {
    fetched += 1;
    throw new Error("a test asks no network for anything");
  },
});

process.stdout.write(`${JSON.stringify({ validated, applied, read, listed, fetched, stdout, stderr })}\n`);
