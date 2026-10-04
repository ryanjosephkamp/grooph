import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderStatement } from "../src/statement.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "usage.json"), "utf8"));
mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(join(root, "out", "statement.txt"), renderStatement(data), "utf8");
console.log("wrote out/statement.txt");
