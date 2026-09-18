import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up to the workspace root, so tests do not depend on the build layout. */
export const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

export const fixturesDir = join(repoRoot, "fixtures");

export const read = (path: string): string => readFileSync(path, "utf8");

export const listFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".grooph.json"))
        .sort()
    : [];

export const listDirs = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

/** Every file under `fixtures/valid`. */
export const validFixtures = (): { name: string; path: string }[] =>
  listFiles(join(fixturesDir, "valid")).map((name) => ({ name, path: join(fixturesDir, "valid", name) }));

/** Every file under `fixtures/invalid/<CODE>/`, with the code it must produce. */
export const invalidFixtures = (): { code: string; name: string; path: string }[] =>
  listDirs(join(fixturesDir, "invalid")).flatMap((code) =>
    listFiles(join(fixturesDir, "invalid", code)).map((name) => ({
      code,
      name,
      path: join(fixturesDir, "invalid", code, name),
    })),
  );
