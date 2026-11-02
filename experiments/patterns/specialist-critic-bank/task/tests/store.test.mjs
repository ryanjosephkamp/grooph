import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { listFiles, readUserFile, writeUserFile } from "../src/store.mjs";

const fresh = () => join(mkdtempSync(join(tmpdir(), "userfiles-")), "root");

test("write, read and list", () => {
  const root = fresh();
  writeUserFile(root, "b.txt", "bee");
  writeUserFile(root, "a.txt", "ay");
  assert.equal(readUserFile(root, "a.txt"), "ay");
  assert.deepEqual(listFiles(root), [
    { name: "a.txt", size: 2 },
    { name: "b.txt", size: 3 },
  ]);
});

test("sizes are in bytes, not characters", () => {
  const root = fresh();
  writeUserFile(root, "u.txt", "héllo");
  assert.deepEqual(listFiles(root), [{ name: "u.txt", size: 6 }]);
});
