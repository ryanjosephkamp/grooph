// A first look: install, list a folder, fire the hook, run the readers. Prints what each command says.
import { S, g, hook, installed, made, watch, tree, read } from "./lib.mjs";
import { join } from "node:path";
const p = installed();
const proj = made("proj");
console.log(g(p.env, ["hooks", "install", "--user"]).all);
const store = watch(p, proj);
console.log(g(p.env, ["hooks", "watch", proj]).all);
const r = hook(p.hookFile, ["claude-code", "--user"], { hook_event_name: "SessionStart", session_id: "s1", cwd: proj }, { env: { CLAUDE_PROJECT_DIR: proj } });
console.log(JSON.stringify(r));
console.log([...tree(S)].map(([k, v]) => `${k}  ${v}`).join("\n"));
console.log(read(join(p.env.CLAUDE_CONFIG_DIR, "settings.json")));
console.log(read(p.list));
console.log(g(p.env, ["sessions"], { cwd: proj }).all);
console.log(g(p.env, ["hooks", "status"], { cwd: proj }).all);
console.log(g(p.env, ["hooks", "remove", "--user"]).all);
