// Second reader: the build named by GROOPH_CLI runs, in a scratch folder. node smoke.mjs
import { g, person } from "../reader/lib.mjs";
const env = person("smoke");
const r = g(env, ["hooks", "install", "--user"]);
console.log(r.status, r.all.split("\n").slice(0, 2).join(" | "));
console.log(g(env, ["hooks", "status"]).all.split("\n").slice(0, 8).join("\n"));
