import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderChart } from "../src/chart.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "monthly.json"), "utf8"));
mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(join(root, "out", "chart.svg"), renderChart(data), "utf8");
console.log("wrote out/chart.svg");
