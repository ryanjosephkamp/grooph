/**
 * What install --user writes back for values JavaScript cannot hold as written. Prints the person's line before and after.
 *   node 02b-numbers.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, person, read } from "./lib.mjs";

const cases = { "a number past 2^53": "12345678901234567890", "a number past 1e308": "1e400", "a negative one": "-1e400", "an id with 19 digits": "9007199254740993", "a decimal": "0.1000000000000000055511151231257827", "minus zero": "-0", "a repeated key": '"first", "k": "second"' };
let i = 0;
for (const [what, literal] of Object.entries(cases)) {
  const env = person(`n${++i}`);
  mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
  const file = join(env.CLAUDE_CONFIG_DIR, "settings.json");
  writeFileSync(file, `{\n  "k": ${literal}\n}\n`);
  const ran = g(env, ["hooks", "install", "--user"]);
  const now = read(file).split("\n").filter((l) => l.includes('"k"')).join(" ").trim();
  console.log(`${what}: was  "k": ${literal}   is  ${now}   (exit ${ran.status}${ran.err ? `, said: ${ran.err.trim()}` : ", no word of it"})`);
}
