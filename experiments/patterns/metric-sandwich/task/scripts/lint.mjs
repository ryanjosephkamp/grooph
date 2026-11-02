// The project's lint: cheap rules a machine can check. Exits 1 on any finding.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const findings = [];
for (const dir of ["src", "tests"]) {
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
    const file = join(dir, name);
    const text = readFileSync(file, "utf8");
    if (!text.endsWith("\n")) findings.push(`${file}: no newline at end of file`);
    text.split("\n").forEach((line, i) => {
      const at = `${file}:${i + 1}`;
      if (line.length > 100) findings.push(`${at}: line longer than 100 characters`);
      if (/\s$/.test(line)) findings.push(`${at}: trailing whitespace`);
      if (/\bvar\s/.test(line)) findings.push(`${at}: use let or const, not var`);
      if (dir === "src" && /console\.log/.test(line)) findings.push(`${at}: console.log in src/`);
    });
    if (dir === "src") {
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (!/^export function /.test(line)) return;
        let j = i - 1;
        while (j >= 0 && lines[j].trim() === "") j -= 1;
        if (j < 0 || !lines[j].trim().endsWith("*/")) findings.push(`${file}:${i + 1}: exported function without a doc comment`);
      });
    }
  }
}
if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("lint: clean");
