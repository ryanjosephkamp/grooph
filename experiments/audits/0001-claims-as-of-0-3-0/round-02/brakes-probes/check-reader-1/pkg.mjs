import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCRATCH, core } from "../adopt-reader-1/lib.mjs";
for (const c of ["c1", "c3"]) {
  const doc = core.parseGraphText(readFileSync(join(SCRATCH, "check-reader-1/cli", c, "adopted.grooph.json"), "utf8")).doc;
  const pkg = core.compile(doc, "claude-code");
  const files = Array.isArray(pkg.files) ? pkg.files : Object.entries(pkg.files ?? pkg).map(([path, content]) => ({ path, content }));
  console.log(`\n== ${c}: ${files.length} files; keys ${Object.keys(pkg)}`);
  for (const file of files) { const text = typeof file.content === "string" ? file.content : JSON.stringify(file.content ?? file); for (const line of text.split("\n")) if (/bar[ -]|Builder says|CHANGES\.md says|zz-done|Done too|approval|fail/i.test(line)) console.log(`  ${file.path}: ${line.slice(0, 330)}`); }
}
