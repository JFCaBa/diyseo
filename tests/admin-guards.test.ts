import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

const root = join(__dirname, "..");
const adminDir = join(root, "app", "admin");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const rel = (path: string) => relative(root, path).split(sep).join("/");

/** Names of exported async functions whose first `await` is not `await requireAdminAction(`. */
export function unguardedActions(source: string): string[] {
  const headers = [...source.matchAll(/^export\s+async\s+function\s+(\w+)/gm)];
  return headers
    .filter((match, i) => {
      const start = (match.index ?? 0) + match[0].length;
      const next = source.slice(start).search(/^export\s/m);
      const chunk = next === -1 ? source.slice(start) : source.slice(start, start + next);
      const firstAwait = /\bawait\s+([\w.]+)\s*\(/.exec(chunk);
      return !firstAwait || firstAwait[1] !== "requireAdminAction";
    })
    .map((match) => match[1]);
}

export function lacks(source: string, call: string): boolean {
  return !source.includes(call);
}

test("helpers detect a missing guard (synthetic sources)", () => {
  const good = `export async function a(x: string) {\n  await requireAdminAction();\n  await other();\n}\n`;
  const noGuard = `export async function a() {\n  await prisma.x();\n}\n`;
  const late = `export async function a() {\n  await prisma.x();\n  await requireAdminAction();\n}\n`;
  const none = `export async function a() {\n  return 1;\n}\n`;
  const mixed = `${good}\nexport async function b() {\n  await prisma.y();\n}\n`;
  assert.deepEqual(unguardedActions(good), []);
  assert.deepEqual(unguardedActions(noGuard), ["a"]);
  assert.deepEqual(unguardedActions(late), ["a"]);
  assert.deepEqual(unguardedActions(none), ["a"]);
  assert.deepEqual(unguardedActions(mixed), ["b"]);
  assert.equal(lacks("const a = await requireAdmin();", "requireAdmin("), false);
  assert.equal(lacks("const a = 1;", "requireAdmin("), true);
  assert.equal(lacks("const a = 1;", "adminRouteGuard("), true);
});

test("every admin page and the layout call requireAdmin(", () => {
  const offenders = filesUnder(adminDir)
    .filter((path) => /[\\/](page|layout)\.tsx$/.test(path))
    .filter((path) => lacks(readFileSync(path, "utf8"), "requireAdmin("))
    .map(rel);
  assert.deepEqual(offenders, []);
  assert.ok(filesUnder(adminDir).some((path) => path.endsWith(`${sep}layout.tsx`)));
});

test("every admin route handler calls adminRouteGuard(", () => {
  const routes = filesUnder(adminDir).filter((path) => /[\\/]route\.ts$/.test(path));
  assert.ok(routes.length > 0);
  const offenders = routes.filter((path) => lacks(readFileSync(path, "utf8"), "adminRouteGuard(")).map(rel);
  assert.deepEqual(offenders, []);
});

test("every exported admin server action awaits requireAdminAction() first", () => {
  const path = join(adminDir, "actions.ts");
  const names = unguardedActions(readFileSync(path, "utf8"));
  assert.deepEqual(names.map((name) => `${rel(path)}: ${name}`), []);
});
