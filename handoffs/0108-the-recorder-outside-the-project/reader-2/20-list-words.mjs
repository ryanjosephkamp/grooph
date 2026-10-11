/**
 * Second reader, slice 0108. Two of the first reader's rows read standard output only, or look for words the
 * answer does not use: what `grooph sessions` says with a list it cannot read, and what is said of a hand-written
 * list in which two folders share one record name.
 *
 *   node 20-list-words.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { g, hook, installed, made, row, summary, watch, S } from "../reader/lib.mjs";

const short = (t) => t.replaceAll(S, "<S>").trim().replace(/\n/g, " / ");
{
  const p = installed("a");
  const proj = made("a-work", "project");
  watch(p, proj);
  hook(p.hookFile, ["claude-code", "--user"], { hook_event_name: "SessionStart", session_id: "held", cwd: proj }, { env: { CLAUDE_PROJECT_DIR: proj } });
  writeFileSync(p.list, "{ nope");
  const s = g(p.env, ["sessions"], { cwd: proj });
  row("grooph sessions in a listed folder whose list is not JSON, the record holding a session", 1, `exit ${s.status}; standard output: "${short(s.out)}"; standard error: "${short(s.err)}"`, /could not be read/.test(s.err) ? "limit" : "broke");
}
{
  const p = installed("b");
  const a = made("b-work", "a");
  const b = made("b-work", "b");
  watch(p, a);
  watch(p, b);
  const j = JSON.parse(readFileSync(p.list, "utf8"));
  j.folders[1].events = j.folders[0].events;
  writeFileSync(p.list, JSON.stringify(j));
  const st = g(p.env, ["hooks", "status"], { cwd: a });
  const s = g(p.env, ["sessions"], { cwd: a });
  const line = st.out.split("\n").find((l) => l.includes("one name")) ?? "";
  row("a list written by hand in which two folders keep their events under one name", 2, `status says: "${short(line)}"; sessions says on standard error: "${short(s.err)}"`, line !== "" ? "held" : "broke");
}
summary();
