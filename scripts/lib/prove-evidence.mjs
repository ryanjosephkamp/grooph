/**
 * Evidence for a pattern proving run (handoff 0009, criterion 1): what the
 * runner copies out of the scratch project into experiments/patterns/<id>/run/,
 * and the facts it derives from the harness's own records.
 *
 *   run/
 *     result.json              the numbers: run id, versions, cost, turns, rounds, ending, …
 *     runs/<run-id>/           the run folder as the lead left it: PROGRESS.md, notes.jsonl,
 *                              the working copy, the evidence the lead materialised
 *     package/                 the package the run was given: LEAD.md, KICKOFF.md, MAPPING.md,
 *                              graph.grooph.json (the source, as it stood after the run),
 *                              agents/*.md, skill/SKILL.md
 *     project.diff             every change to the project outside the run folder, against
 *                              the commit the run started from (new files included)
 *     transcript-digest.json   who called which tool on which file, and what the lead handed
 *                              each subagent, read from the session transcripts
 *     claude-output*.json      the harness's JSON result, one per invocation
 *     claude-stderr*.txt       only when not empty
 *     settings.json            the permissions passed with --settings
 *     prompts/                 the kickoff prompt and any scripted answer
 *     expect.json              what --check asserts for this template
 *
 * Nothing else from outside the scratch project is copied. The transcripts stay
 * where the harness wrote them; only the digest, built here, travels. The home
 * directory is replaced with `~` in every text file copied, and the count is
 * recorded in result.json.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

export const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

// ── transcripts ──────────────────────────────────────────────────────────

/** The transcript files of one session: the lead's, then each subagent's with its agent type. */
export function sessionTranscripts(claudeDir, sessionId) {
  const projects = join(claudeDir, "projects");
  const found = [];
  if (!sessionId || !existsSync(projects)) return found;
  for (const project of readdirSync(projects)) {
    const main = join(projects, project, `${sessionId}.jsonl`);
    if (!existsSync(main)) continue;
    found.push({ file: main, who: "lead", meta: {} });
    const subagents = join(projects, project, sessionId, "subagents");
    if (!existsSync(subagents)) continue;
    for (const name of readdirSync(subagents).filter((n) => n.endsWith(".jsonl")).sort()) {
      let meta = {};
      try {
        meta = JSON.parse(readFileSync(join(subagents, name.replace(/\.jsonl$/, ".meta.json")), "utf8"));
      } catch {}
      found.push({ file: join(subagents, name), who: meta.agentType ?? "subagent", meta });
    }
  }
  return found;
}

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const DISPATCH_TOOLS = new Set(["Agent", "Task"]);

/**
 * One entry per transcript: who, the models it ran on, and every tool use in
 * order. File paths are made relative to the scratch project; Bash commands
 * are kept whole (they are the evidence of what a critic actually ran), and
 * redirect targets are listed as writes.
 */
export function digestTranscripts(transcripts, scratch) {
  const rel = (path) => {
    if (typeof path !== "string") return path;
    for (const base of [scratch, realpathSafe(scratch)]) {
      if (path === base) return ".";
      if (path.startsWith(`${base}/`)) return path.slice(base.length + 1);
    }
    return path;
  };
  const out = [];
  for (const { file, who, meta } of transcripts) {
    const entry = { who, transcript: basename(file), description: meta.description ?? null, models: [], started: null, ended: null, assistant_messages: 0, tool_uses: [] };
    const models = new Set();
    const records = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line));
      } catch {}
    }
    // A tool use whose result came back as an error (a permission denial, a failed command) did not do what it asked.
    const failed = new Map();
    for (const record of records) {
      if (record.type !== "user" || !Array.isArray(record.message?.content)) continue;
      for (const block of record.message.content) {
        if (block.type !== "tool_result" || block.is_error !== true) continue;
        const text = Array.isArray(block.content) ? block.content.map((c) => c.text ?? "").join(" ") : String(block.content ?? "");
        failed.set(block.tool_use_id, text.slice(0, 200));
      }
    }
    for (const record of records) {
      if (record.timestamp) {
        entry.started ??= record.timestamp;
        entry.ended = record.timestamp;
      }
      if (record.type !== "assistant") continue;
      entry.assistant_messages += 1;
      if (record.message?.model) models.add(record.message.model);
      for (const block of Array.isArray(record.message?.content) ? record.message.content : []) {
        if (block.type !== "tool_use") continue;
        const input = block.input ?? {};
        const use = { tool: block.name, at: record.timestamp ?? null };
        if (failed.has(block.id)) use.error = failed.get(block.id);
        if (typeof input.file_path === "string") use.file = rel(input.file_path);
        if (typeof input.path === "string") use.path = rel(input.path);
        if (typeof input.pattern === "string") use.pattern = input.pattern;
        if (block.name === "Bash" && typeof input.command === "string") {
          use.command = input.command;
          const targets = [...input.command.matchAll(/(?:(?<![=\-])>>?|\btee(?:\s+-a)?)\s*["']?([^\s"'|;&()]+)/g)]
            .map((m) => m[1])
            .filter((target) => !target.startsWith("$") && !target.startsWith("/dev/") && !/^&?\d$/.test(target))
            .map(rel);
          if (targets.length > 0) use.writes = targets;
        }
        if (DISPATCH_TOOLS.has(block.name)) {
          use.subagent_type = input.subagent_type ?? null;
          use.description = input.description ?? null;
          use.prompt = input.prompt ?? null;
        }
        entry.tool_uses.push(use);
      }
    }
    entry.models = [...models];
    out.push(entry);
  }
  return out;
}

/** Every write in a digest: { who, tool, file (relative), name (basename) }. */
export function writesOf(digest) {
  const writes = [];
  for (const entry of digest) {
    for (const use of entry.tool_uses) {
      if (use.error) continue;
      if (WRITE_TOOLS.has(use.tool) && use.file) writes.push({ who: entry.who, tool: use.tool, file: use.file, name: basename(use.file) });
      for (const target of use.writes ?? []) writes.push({ who: entry.who, tool: "Bash", file: target, name: basename(target) });
    }
  }
  return writes;
}

function realpathSafe(path) {
  try {
    return execFileSync("realpath", [path], { encoding: "utf8" }).trim();
  } catch {
    return path;
  }
}

// ── the project change ───────────────────────────────────────────────────

/** `git diff` of everything outside the run folders against `base`, new files included, without touching the project's index. */
export function projectDiff(scratch, base, excludes) {
  const temp = mkdtempSync(join(tmpdir(), "grooph-prove-index-"));
  const env = { ...process.env, GIT_INDEX_FILE: join(temp, "index") };
  try {
    execFileSync("git", ["-C", scratch, "read-tree", base], { env });
    execFileSync("git", ["-C", scratch, "add", "-A"], { env });
    const spec = [".", ...excludes.map((path) => `:(exclude)${path}`)];
    const diff = execFileSync("git", ["-C", scratch, "diff", "--cached", "--no-color", base, "--", ...spec], { env, encoding: "utf8", maxBuffer: 64 << 20 });
    const stat = execFileSync("git", ["-C", scratch, "diff", "--cached", "--name-status", base, "--", ...spec], { env, encoding: "utf8" });
    return { diff, files: stat.split("\n").filter(Boolean).map((line) => line.replace(/\t/g, " ")) };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

// ── notes ────────────────────────────────────────────────────────────────

export function readNotes(path) {
  const notes = [];
  let broken = 0;
  if (!existsSync(path)) return { notes, broken, lines: 0 };
  const lines = readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "");
  for (const line of lines) {
    try {
      notes.push(JSON.parse(line));
    } catch {
      broken += 1;
      notes.push(null);
    }
  }
  return { notes, broken, lines: lines.length };
}

/** The run folders under a runs/ directory, newest first by modification time. */
export function runFolders(runsDir) {
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((name) => statSync(join(runsDir, name)).isDirectory())
    .sort((a, b) => statSync(join(runsDir, b)).mtimeMs - statSync(join(runsDir, a)).mtimeMs);
}

// ── copying ──────────────────────────────────────────────────────────────

const TEXT = /\.(md|json|jsonl|txt|patch|diff|mjs|js|ts|log)$/i;

/** Replace the home directory with `~` in every text file under `dir`; returns how many replacements were made. */
export function redactHome(dir, home) {
  if (!home || home === "/") return 0;
  let count = 0;
  const walk = (path) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (TEXT.test(name) || !name.includes(".")) {
        const text = readFileSync(full, "utf8");
        const parts = text.split(home);
        if (parts.length > 1) {
          count += parts.length - 1;
          writeFileSync(full, parts.join("~"), "utf8");
        }
      }
    }
  };
  walk(dir);
  return count;
}

export function copyInto(from, to) {
  mkdirSync(join(to, ".."), { recursive: true });
  cpSync(from, to, { recursive: true });
}

export function relativeTo(base, path) {
  return relative(base, path) || ".";
}
