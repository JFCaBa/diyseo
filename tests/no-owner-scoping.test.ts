import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

const root = join(__dirname, "..");
// Workspace.ownerId is the primary owner (a mirror of one OWNER member; co-owners are other OWNER rows); only these files may read or write it.
const allowed = new Set(["lib/workspace-provisioning.ts", "lib/teams.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx)$/.test(name) ? [path] : [];
  });
}

test("no admin code scopes by ownerId", () => {
  const offenders = ["app", "lib"]
    .flatMap((dir) => sourceFiles(join(root, dir)))
    .map((path) => relative(root, path).split(sep).join("/"))
    .filter((path) => !allowed.has(path) && readFileSync(join(root, path), "utf8").includes("ownerId"));

  assert.deepEqual(offenders, []);
});

test("every admin page under app/[siteId] checks the site itself", () => {
  const missing = sourceFiles(join(root, "app", "[siteId]"))
    .filter((path) => path.endsWith(`${sep}page.tsx`))
    .filter((path) => !/await requireSitePage\(siteId\)/.test(readFileSync(path, "utf8")))
    .map((path) => relative(root, path).split(sep).join("/"));

  assert.deepEqual(missing, []);
});
