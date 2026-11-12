import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createDatabaseBackup } from "@/lib/backup-utils";

// A pg_dump that exits the moment it has written: the child's "close" can fire
// while createDatabaseBackup is still awaiting the stream copy.
async function withFakePgDump<T>(script: string, run: (cwd: string) => Promise<T>): Promise<T> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pgdump-"));
  const bin = path.join(root, "bin");
  await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, "pg_dump"), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  const previous = { cwd: process.cwd(), path: process.env.PATH, url: process.env.DATABASE_URL };
  process.chdir(root);
  process.env.PATH = `${bin}:${previous.path}`;
  process.env.DATABASE_URL = "postgresql://u:p@localhost/db";
  try {
    return await run(root);
  } finally {
    process.chdir(previous.cwd);
    process.env.PATH = previous.path;
    if (previous.url === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.url;
    await fs.rm(root, { recursive: true, force: true });
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`still pending after ${ms} ms`)), ms))]);

test("createDatabaseBackup resolves even when pg_dump exits before the copy finishes", async () => {
  await withFakePgDump('echo "-- dump"; echo "SELECT 1;"', async () => {
    for (let i = 0; i < 20; i += 1) {
      const result = await withTimeout(createDatabaseBackup(), 5000);
      assert.ok(result.size > 0);
    }
  });
});

test("createDatabaseBackup rejects and leaves no file when pg_dump fails", async () => {
  await withFakePgDump('echo "boom" >&2; exit 3', async (root) => {
    await assert.rejects(withTimeout(createDatabaseBackup(), 5000), /boom/);
    const left = await fs.readdir(path.join(root, "backups"));
    assert.deepEqual(left, []);
  });
});
