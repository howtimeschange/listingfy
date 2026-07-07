import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

test("local generated outputs are ignored by git", async () => {
  const gitignore = await readFile(path.join(PROJECT_ROOT, ".gitignore"), "utf8");
  assert.match(gitignore, /^outputs\/$/m);
});
