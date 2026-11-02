/**
 * A person's own places, for a test: grooph's folder and the two harnesses' settings folders, each a folder made
 * for this test file and removed when it ends.
 *
 * `grooph hooks` reads and writes those places (`grooph hooks install --user`, the list of watched folders), and
 * `grooph hooks status`, `grooph sessions` and `grooph watch` look in them. No test may reach the real ones on the
 * machine it runs on: importing this module names all three in the process's environment before any command runs,
 * and `scratchEnv` is the same three names for a test that hands a command an environment of its own.
 */

import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// realpath: on macOS the temp folder is a link, and the hook compares real paths.
const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph-test-home-")));

/** The three names, each a folder under one scratch folder. Nothing is made until a command makes it. */
export const scratchPlaces = (under: string): { GROOPH_HOME: string; CLAUDE_CONFIG_DIR: string; CODEX_HOME: string } => ({
  GROOPH_HOME: join(under, "grooph"),
  CLAUDE_CONFIG_DIR: join(under, "claude"),
  CODEX_HOME: join(under, "codex"),
});

export const scratchEnv = scratchPlaces(root);
Object.assign(process.env, scratchEnv);
process.on("exit", () => rmSync(root, { recursive: true, force: true }));
