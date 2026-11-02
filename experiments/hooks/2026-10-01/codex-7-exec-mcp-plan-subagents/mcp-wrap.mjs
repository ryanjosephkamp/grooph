#!/usr/bin/env node
// Record which CODEX_* variables Codex hands an MCP server (names, and values only for ids), then become grooph's server.
import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const names = Object.keys(process.env).filter((k) => /CODEX|THREAD|SESSION/i.test(k)).sort();
writeFileSync("<local path>", JSON.stringify({ cwd: process.cwd(), names, ids: Object.fromEntries(names.filter((k) => /SESSION_ID|THREAD_ID/i.test(k)).map((k) => [k, process.env[k]])) }, null, 2) + "\n");
const child = spawn(process.execPath, ["<local path>", "mcp", "--dir", "<local path>", "--harness", "codex"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
