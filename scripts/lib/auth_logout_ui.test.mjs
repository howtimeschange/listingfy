import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

function file(relativePath) {
  return readFile(path.join(PROJECT_ROOT, relativePath), "utf8");
}

test("logout clears frontend auth state even when the server session is already gone", async () => {
  const authProvider = await file("web/src/lib/auth.tsx");
  const header = await file("web/src/components/layout/app-header.tsx");

  assert.match(authProvider, /catch \(error\)/);
  assert.match(authProvider, /error instanceof ApiError && error\.status === 401/);
  assert.match(authProvider, /queryClient\.setQueryData<AuthResponse>\(\["auth", "me"\], \{ user: null \}\)/);
  assert.match(authProvider, /queryClient\.removeQueries\(\{[\s\S]+predicate:/);
  assert.doesNotMatch(authProvider, /queryClient\.clear\(\)/);
  assert.doesNotMatch(authProvider, /queryClient\.removeQueries\(\{ queryKey: \["auth"\] \}\)/);

  assert.match(header, /await logout\(\)/);
  assert.match(header, /catch \{/);
  assert.match(header, /finally \{[\s\S]+navigate\("\/login", \{ replace: true \}\)/);
});
