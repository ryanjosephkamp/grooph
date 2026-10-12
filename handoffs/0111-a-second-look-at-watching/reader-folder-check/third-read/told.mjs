// Reader's script: by ordinary reads only (no git, no write), makes the hook's, the tool's and the version's values for a checkout the way the runner's checkout() does, and asks pin3's notTold about them.
//   node told.mjs <pin3> <the checkout to read>
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const [pin, root] = process.argv.slice(2);
const { notTold } = await import(join(pin, "scripts/lib/watching-second-look-paid.mjs"));
const odd = [];
const filesUnder = (dir, base = dir) => (!existsSync(dir) ? [] : readdirSync(dir).sort().flatMap((name) => { const full = join(dir, name); const st = lstatSync(full); if (!st.isDirectory() && !st.isFile()) odd.push(full.slice(root.length + 1)); return st.isDirectory() ? filesUnder(full, base) : [full.slice(base.length + 1)]; }));
const sumOfAll = (paths) => { try { const hash = createHash("sha256"); let n = 0; for (const path of paths) { const full = join(root, path); const files = lstatSync(full).isDirectory() ? filesUnder(full).map((file) => join(path, file)) : [path]; for (const file of files) { hash.update(`${file}\0`).update(readFileSync(join(root, file))).update("\0"); n += 1; } } return [hash.digest("hex"), n]; } catch (error) { return [null, error.message]; } };
const TOOL = ["packages/cli/package.json", "packages/cli/bin", "packages/cli/dist", "packages/cli/hooks", "packages/core/dist"];
const FIVE = ["scripts/lib/watching-second-look-measures.mjs", "scripts/lib/watching-check-paid.mjs", "scripts/lib/study-three-paid.mjs", "scripts/lib/compare-profile.mjs", "experiments/comparisons/profile/settings.json"];
const [tool, toolFiles] = sumOfAll(TOOL);
const [five] = sumOfAll(FIVE);
let hook = null; try { hook = createHash("sha256").update(readFileSync(join(root, "packages/cli/hooks/grooph-event.mjs"))).digest("hex"); } catch {}
let version = null; try { version = JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).version ?? null; } catch {}
const [runnerNow] = sumOfAll(["scripts/lib/watching-second-look-paid.mjs", ...FIVE]);
console.log(`hook ${hook?.slice(0, 8)} | tool ${tool?.slice(0, 8)} (${toolFiles} files) | version ${version} | runner as it is there now ${runnerNow?.slice(0, 8)} | its five other files ${five?.slice(0, 8)}`);
console.log(`entries under the tool's folders that are neither file nor folder: ${odd.length ? odd.join(", ") : "none"}`);
console.log(`notTold: ${JSON.stringify(notTold({ hook_sha256: hook, tool_sha256: tool, grooph_version: version, runner_sha256: runnerNow }))}`);
