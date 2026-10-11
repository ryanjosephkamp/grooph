/**
 * Where this CLI's own files are, wherever it runs from. One module holds the
 * answer because a bundle is one file: a path worked out from `import.meta.url`
 * in a file under `commands/` would be a level off once that file is inlined.
 *
 * Every layout keeps the code one folder below `base`:
 *
 *   the clone         packages/cli/dist/src/paths.js      base = packages/cli/dist/
 *   the npm package   <package>/dist/bundle/grooph.js     base = <package>/dist/
 *   the chat skill    <skill>/scripts/grooph.mjs          base = <skill>/
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = (): string => fileURLToPath(new URL("../", import.meta.url));

/** The built-in pattern library, bundled beside the code at build time (docs/templates.md §3). */
export const patternsDir = (): string => join(base(), "patterns");

/**
 * The plan templates (plans/ in the repository), bundled beside the code like the pattern library and kept apart from
 * it: they are graphs a person follows, and no count or index of the built-in templates includes them.
 */
export const plansDir = (): string => join(base(), "plans");

/** A script under hooks/, as this CLI ships it: beside dist/ in the clone and in the npm package. The chat skill carries none. */
export const shippedHook = (name: string): string => resolve(base(), "..", "hooks", name);

/**
 * The built web app `grooph watch` serves, or undefined when there is none here: the copy the npm package
 * carries, else `apps/web/dist` when this is the clone. The clone's is taken only when `base` really is
 * `<clone>/packages/cli/dist`: three folders up from an installed package is somebody else's project.
 */
export function appDir(): string | undefined {
  // The packaged copy carries a mark the packaging script writes, so a folder that merely sits where it would is not served.
  const packaged = join(base(), "app");
  if (existsSync(join(packaged, "index.html")) && existsSync(join(packaged, "grooph-app.json"))) return packaged;
  const clone = resolve(base(), "..", "..", "..");
  if (resolve(clone, "packages", "cli", "dist") !== resolve(base())) return undefined;
  const built = join(clone, "apps", "web", "dist");
  return existsSync(join(built, "index.html")) ? built : undefined;
}

/**
 * A person's own places, outside any project: grooph's folder and each harness's user-level hook settings.
 * `GROOPH_HOME` names the first (default `.grooph` in their home; the user's templates are kept there too),
 * `CLAUDE_CONFIG_DIR` and `CODEX_HOME` the folders the two harnesses themselves read those names for. A test, or a
 * profile kept apart, points all three at folders of its own.
 */
export type UserPlaces = {
  /** grooph's own folder */
  home: string;
  /** the event hook, one copy for the machine */
  hook: string;
  /** the folders whose sessions are recorded: `grooph hooks watch` writes it and the hook reads it */
  list: string;
  /** the record: one folder per listed folder, one file per session */
  events: string;
  /** where each harness reads its user-level hooks */
  settings: { "claude-code": string; codex: string };
};

export function userPlaces(env: NodeJS.ProcessEnv = process.env): UserPlaces {
  const named = (name: string, fallback: string): string => resolve(env[name] || join(homedir(), fallback));
  const home = named("GROOPH_HOME", ".grooph");
  return {
    home,
    hook: join(home, "hooks", "grooph-event.mjs"),
    list: join(home, "watched.json"),
    events: join(home, "events"),
    settings: { "claude-code": join(named("CLAUDE_CONFIG_DIR", ".claude"), "settings.json"), codex: join(named("CODEX_HOME", ".codex"), "hooks.json") },
  };
}
