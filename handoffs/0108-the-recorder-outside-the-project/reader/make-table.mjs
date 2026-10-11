// Turns the kept outputs (out-*.txt, the built head only) into one table of every attack: node make-table.mjs > table.md
import { readFileSync } from "node:fs";
const files = ["out-01-hook-user.txt", "out-02-settings.txt", "out-03-paths.txt", "out-04-list.txt", "out-05-readers.txt", "out-06-clean-project.txt", "out-07-project-layout.txt", "out-08-kill.txt", "out-09-home-collision.txt"];
const tally = { held: 0, broke: 0, limit: 0 };
let n = 0;
console.log("| # | Script | What | Tries | What happened | Verdict |\n|---|---|---|---|---|---|");
for (const file of files) {
  for (const line of readFileSync(new URL(file, import.meta.url), "utf8").split("\n")) {
    const m = /^\[(HELD|BROKE|LIMIT)\] (.*?) \| tries: (\d+) \| (.*)$/.exec(line);
    if (!m) continue;
    const verdict = m[1] === "HELD" ? "held" : m[1] === "BROKE" ? "**broke**" : "limit worth saying";
    tally[m[1] === "HELD" ? "held" : m[1] === "BROKE" ? "broke" : "limit"]++;
    const cell = (s, max) => (s.length > max ? `${s.slice(0, max)}…` : s).replaceAll("|", "\\|").replace(/[\u0000-\u001f]/g, " ");
    console.log(`| ${++n} | ${file.slice(4, 6)} | ${cell(m[2], 400)} | ${m[3]} | ${cell(m[4], 520)} | ${verdict} |`);
  }
}
console.log(`\n${n} rows: ${tally.held} held, ${tally.broke} broke, ${tally.limit} a limit worth saying (the races are in their own table).`);
