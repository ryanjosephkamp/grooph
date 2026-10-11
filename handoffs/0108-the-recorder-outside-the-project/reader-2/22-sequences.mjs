/**
 * Second reader, slice 0108, second look. Sequences the fuzz does not make: an entry that joins grooph's command
 * with somebody's (grooph's first, middle, last; two of grooph's; on one line; a "hooks" key twice in the entry),
 * and install, a change by hand, install.
 *
 *   node 22-sequences.mjs
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, person, row, summary, S } from "../reader/lib.mjs";

const short = (t, n = 200) => (t.length > n ? `${t.slice(0, n)}...` : t).replaceAll(S, "<S>").trim().replace(/\n/g, " / ");
let n = 0;
function someone() {
  const env = person(`q${(n += 1)}`);
  mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
  return { env, file: join(env.CLAUDE_CONFIG_DIR, "settings.json"), hook: join(env.GROOPH_HOME, "hooks", "grooph-event.mjs") };
}
const oursIn = (text) => (text.match(/grooph-event\.mjs\\" (?:claude-code|codex) --user/g) ?? []).length;
// Somebody's own command, written so that reading it into an object and writing it out again would show.
const MINE = '{"type": "command",  "command": "say \\/done\\/ \\u00e9", "timeout": 1e400, "timeout": 10.0, "id": 9007199254740993}';
const MINE2 = '{"command":"echo second","type":"command","10":1,"1":2}';
const OLD = (home, harness = "claude-code") => `{"type": "command", "command": "node \\"${home}/hooks/grooph-event.mjs\\" ${harness} --user", "timeout": 7}`;

// ─── Joined entries ───────────────────────────────────────────────────────────────────────────────────────────
{
  const lists = [
    ["grooph's first", (o) => [o, MINE]],
    ["grooph's last", (o) => [MINE, o]],
    ["grooph's in the middle", (o) => [MINE, o, MINE2]],
    ["two of grooph's and one of somebody's", (o) => [o, MINE, o.replace("claude-code", "codex")]],
    ["two of grooph's around two of somebody's", (o) => [o, MINE, MINE2, o]],
    ["two of grooph's first", (o) => [o, o, MINE]],
  ];
  const layouts = [
    ["one line", (cmds) => `{"model":"opus","hooks":{"Stop":[{"matcher":"Bash","hooks":[${cmds.join(",")}]}],"Notification":[{"hooks":[${MINE2}]}]},"theme":"dark"}`],
    ["one line, spaced", (cmds) => `{ "model": "opus", "hooks": { "Stop": [ { "matcher": "Bash", "hooks": [ ${cmds.join(" , ")} ] } ] }, "theme": "dark" }\n`],
    ["lines and tabs, CRLF", (cmds) => `{\r\n\t"hooks": {\r\n\t\t"Stop": [\r\n\t\t\t{\r\n\t\t\t\t"hooks": [\r\n\t\t\t\t\t${cmds.join(",\r\n\t\t\t\t\t")}\r\n\t\t\t\t],\r\n\t\t\t\t"matcher": "Bash"\r\n\t\t\t}\r\n\t\t]\r\n\t},\r\n\t"model": "opus"\r\n}\r\n`],
  ];
  let bad = 0;
  let tries = 0;
  const said = [];
  for (const [which, list] of lists) for (const [layout, lay] of layouts) for (const home of ["THIS", "/old/home/.grooph"]) {
    tries += 1;
    const u = someone();
    const cmds = list(OLD(home === "THIS" ? u.env.GROOPH_HOME : home));
    const start = lay(cmds);
    writeFileSync(u.file, start);
    const mine = cmds.filter((c) => c === MINE || c === MINE2);
    const problems = [];
    const check = (step, r, wantOurs) => {
      const now = readFileSync(u.file, "utf8");
      if (r.status !== 0) return problems.push(`${step}: exit ${r.status} "${short(r.all, 120)}"`);
      let j;
      try { j = JSON.parse(now); } catch { return problems.push(`${step}: does not parse`); }
      for (const m of mine) if (!now.includes(m)) problems.push(`${step}: somebody's command is not in the file as it was written`);
      if (oursIn(now) !== wantOurs) problems.push(`${step}: ${oursIn(now)} of grooph's commands, ${wantOurs} meant`);
      const joined = j.hooks?.Stop?.[0];
      if (joined?.matcher !== "Bash" || joined.hooks.length !== mine.length) problems.push(`${step}: the joined entry holds ${joined?.hooks?.length} commands, ${mine.length} of somebody's meant`);
      return now;
    };
    check("install", g(u.env, ["hooks", "install", "--user"]), 7);
    const one = readFileSync(u.file, "utf8");
    g(u.env, ["hooks", "install", "--user"]);
    if (readFileSync(u.file, "utf8") !== one) problems.push("install again: wrote the file again");
    check("install --tools", g(u.env, ["hooks", "install", "--user", "--tools"]), 7);
    check("remove", g(u.env, ["hooks", "remove", "--user"]), 0);
    if (problems.length > 0) {
      bad += 1;
      said.push(`[${which}; ${layout}; ${home === "THIS" ? "this install's folder" : "another folder"}] ${[...new Set(problems)].join("; ")}`);
    }
  }
  row("an entry that joins grooph's command with somebody's: install, install, install --tools, remove", tries, `cases with something wrong: ${bad} of ${tries}. ${said.slice(0, 6).join(" ||| ")}`, bad === 0 ? "held" : "broke");
}
{
  const u = someone();
  const start = `{"hooks":{"Stop":[{"hooks":[${MINE}],"hooks":[${MINE2},${OLD("/old/home/.grooph")}]}]},"model":"opus"}`;
  writeFileSync(u.file, start);
  const i = g(u.env, ["hooks", "install", "--user"]);
  const now = readFileSync(u.file, "utf8");
  row('a joined entry that writes its "hooks" key twice (a harness reads the second)', 1, `install exit ${i.status}${i.status !== 0 ? `: "${short(i.all, 200)}"; file unchanged: ${now === start}` : `; the first list is as it was: ${now.includes(`"hooks":[${MINE}]`)}; grooph's old command gone: ${!now.includes("/old/home")}; somebody's second still there: ${now.includes(MINE2)}`}`, i.status !== 0 ? (now === start ? "limit" : "broke") : now.includes(`"hooks":[${MINE}]`) && !now.includes("/old/home") && now.includes(MINE2) ? "held" : "broke");
}

// ─── install, a change by hand, install ───────────────────────────────────────────────────────────────────────
{
  const edits = [
    ["a key added after hooks", (j) => ({ ...j, model: "opus" })],
    ["hooks moved to the front, two keys after it", (j) => ({ hooks: j.hooks, a: 1, b: [1e3] })],
    ["the person's own entry added after grooph's in Stop and before it in SessionStart", (j) => ({ ...j, hooks: { ...j.hooks, Stop: [...j.hooks.Stop, { hooks: [{ type: "command", command: "say stop" }] }], SessionStart: [{ hooks: [{ type: "command", command: "say start" }] }, ...j.hooks.SessionStart] } })],
    ["grooph's entry in Stop written twice", (j) => ({ ...j, hooks: { ...j.hooks, Stop: [...j.hooks.Stop, ...j.hooks.Stop] } })],
    ["grooph's timeouts changed", (j) => JSON.parse(JSON.stringify(j).replaceAll('"timeout":10', '"timeout":99'))],
    ["an event of grooph's deleted, another emptied", (j) => { const h = { ...j.hooks, SubagentStop: [] }; delete h.SessionEnd; return { ...j, hooks: h, z: 1 }; }],
    ["the events put in another order", (j) => ({ ...j, hooks: Object.fromEntries(Object.entries(j.hooks).reverse()), z: 1 })],
    ["grooph's command joined by hand with the person's, in every event", (j) => ({ ...j, hooks: Object.fromEntries(Object.entries(j.hooks).map(([e, l]) => [e, [{ ...l[0], hooks: [{ type: "command", command: `say ${e}` }, ...l[0].hooks] }]])), z: 1 })],
  ];
  const writes = [["two spaces", (j) => `${JSON.stringify(j, null, 2)}\n`], ["one line", (j) => JSON.stringify(j)], ["tabs, CRLF", (j) => JSON.stringify(j, null, "\t").replaceAll("\n", "\r\n")]];
  let bad = 0;
  let tries = 0;
  const said = [];
  for (const [what, edit] of edits) for (const [layout, write] of writes) for (const tools of [false, true]) {
    tries += 1;
    const u = someone();
    writeFileSync(u.file, '{\n  "permissions": {"allow": []}\n}\n');
    g(u.env, ["hooks", "install", "--user"]);
    const edited = edit(JSON.parse(readFileSync(u.file, "utf8")));
    writeFileSync(u.file, write(edited));
    const persons = JSON.stringify(edited).match(/"say \w+"/g) ?? [];
    const problems = [];
    const r = g(u.env, ["hooks", "install", "--user", ...(tools ? ["--tools"] : [])]);
    const now = readFileSync(u.file, "utf8");
    if (r.status !== 0) problems.push(`install after the change: exit ${r.status} "${short(r.all, 110)}"`);
    else {
      const j = JSON.parse(now);
      const per = Object.fromEntries(Object.entries(j.hooks).map(([e, l]) => [e, oursIn(JSON.stringify(l))]));
      const want = ["SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "SubagentStart", "SubagentStop", "PostToolUse"];
      if (!want.every((e) => per[e] === 1) || Object.values(per).reduce((a, b) => a + b, 0) !== 7) problems.push(`grooph's commands by event: ${JSON.stringify(per)}`);
      for (const s of persons) if (!now.includes(s)) problems.push(`the person's ${s} is gone`);
      if (JSON.stringify(j.hooks.PostToolUse.at(-1).matcher) !== (tools ? undefined : '"Agent"')) problems.push("PostToolUse is not as the options say");
      for (const key of Object.keys(edited)) if (key !== "hooks" && JSON.stringify(j[key]) !== JSON.stringify(edited[key])) problems.push(`the key ${key} changed`);
      if (Object.keys(j).join() !== Object.keys(edited).join()) problems.push("the keys are in another order");
      g(u.env, ["hooks", "install", "--user", ...(tools ? ["--tools"] : [])]);
      if (readFileSync(u.file, "utf8") !== now) problems.push("the same install again wrote the file again");
      const rm = g(u.env, ["hooks", "remove", "--user"]);
      const end = readFileSync(u.file, "utf8");
      if (rm.status !== 0 || oursIn(end) !== 0) problems.push(`remove: exit ${rm.status}, ${oursIn(end)} of grooph's left`);
      for (const s of persons) if (!end.includes(s)) problems.push(`after remove the person's ${s} is gone`);
    }
    if (problems.length > 0) {
      bad += 1;
      said.push(`[${what}; ${layout}${tools ? "; --tools" : ""}] ${[...new Set(problems)].join("; ")}`);
    }
  }
  row("install --user, a change by hand, install --user (with and without --tools), the same again, remove", tries, `cases with something wrong: ${bad} of ${tries}. ${said.slice(0, 8).join(" ||| ")}`, bad === 0 ? "held" : "broke");
}
summary();
