// The runner as a process of its own, for c2-signals.mjs to send signals to. It makes one run (runOne) in the temp
// place its parent made, with the stand-in harness, and prints what came back. Started only by c2-signals.mjs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REHEARSED, lib } from "./lib.mjs";

const { runOne } = await import(join(lib, "watching-second-look-paid.mjs"));
const given = JSON.parse(readFileSync(process.argv[2], "utf8"));
try {
  const done = await runOne({ ...given, profileCheck: () => [], gameOpen: [], firstCallGate: { ok: true, record: "record" }, rehearsal: () => REHEARSED });
  console.log(JSON.stringify({ run: done.run.name, notStarted: done.notStarted === true, ended_by: done.result.ended_by, why: done.result.why ?? null, not_started: done.result.not_started ?? null, problems: done.result.problems ?? [], kept: done.kept !== null }));
} catch (error) {
  console.log(JSON.stringify({ threw: error.message }));
}
