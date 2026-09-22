import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderCard } from "../src/card.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "summary.json"), "utf8"));
mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(join(root, "out", "card.svg"), renderCard(data), "utf8");
console.log("wrote out/card.svg");
