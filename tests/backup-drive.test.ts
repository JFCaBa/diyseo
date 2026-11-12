import assert from "node:assert/strict";
import { test } from "node:test";

import { deleteBackup, filesToPrune, listBackups, missingDriveSettings, readDriveConfig, uploadBackup, type DriveConfig, type DriveFile } from "@/lib/backup-drive";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-12T12:00:00Z");
const file = (id: string, daysAgo: number): DriveFile => ({ id, name: `${id}.gz`, createdTime: new Date(NOW - daysAgo * DAY).toISOString() });
const config: DriveConfig = { clientId: "c", clientSecret: "s", refreshToken: "r", folderId: "F" };

test("readDriveConfig needs all four values", () => {
  const full = { BACKUP_GOOGLE_CLIENT_ID: "a", BACKUP_GOOGLE_CLIENT_SECRET: "b", BACKUP_GOOGLE_REFRESH_TOKEN: "c", BACKUP_GOOGLE_DRIVE_FOLDER_ID: "d" } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(readDriveConfig(full), { clientId: "a", clientSecret: "b", refreshToken: "c", folderId: "d" });
  assert.equal(readDriveConfig({ ...full, BACKUP_GOOGLE_REFRESH_TOKEN: " " } as unknown as NodeJS.ProcessEnv), null);
  assert.equal(readDriveConfig({} as unknown as NodeJS.ProcessEnv), null);
});

test("filesToPrune drops only files older than the window", () => {
  const files = Array.from({ length: 10 }, (_, i) => file(`f${i}`, i * 20)); // 0,20,...,180 days
  // f0..f6 are the 7 newest (kept regardless); of the rest only >90 days go: f7 (140d), f8, f9.
  assert.deepEqual(filesToPrune(files, NOW).map((f) => f.id), ["f7", "f8", "f9"]);
  // Beyond keepMin, a recent file is never pruned.
  assert.deepEqual(filesToPrune([...files.slice(0, 3), file("recent", 5)], NOW), []);
});

test("filesToPrune always keeps the newest keepMin even when all are stale", () => {
  const files = Array.from({ length: 9 }, (_, i) => file(`f${i}`, 200 + i));
  assert.deepEqual(filesToPrune(files, NOW).map((f) => f.id), ["f7", "f8"]);
  assert.deepEqual(filesToPrune(files.slice(0, 5), NOW), []);
});

function fakeDrive() {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: unknown }[] = [];
  const doFetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body });
    if (u.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "tok" });
    if (u.includes("/upload/drive/v3/files")) return Response.json({ id: "new", name: "x.gz", createdTime: "2026-11-12T00:00:00Z" });
    if (u.includes("/drive/v3/files?")) return Response.json({ files: [file("a", 1)] });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  return { calls, doFetch };
}

test("uploadBackup refreshes the token, tags the file and puts it in the folder", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bk-"));
  const filePath = path.join(dir, "x.gz");
  await fs.writeFile(filePath, "GZDATA");
  const { calls, doFetch } = fakeDrive();
  const result = await uploadBackup(config, filePath, "x.gz", doFetch);
  assert.equal(result.id, "new");
  const upload = calls.find((c) => c.url.includes("/upload/"))!;
  assert.equal(upload.headers.Authorization, "Bearer tok");
  const body = Buffer.from(upload.body as Buffer).toString("utf8");
  assert.match(body, /"parents":\["F"\]/);
  assert.match(body, /"appProperties":\{"app":"diyseo-backup"\}/);
  assert.match(body, /GZDATA/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("listBackups only asks for this app's files in the folder", async () => {
  const { calls, doFetch } = fakeDrive();
  assert.equal((await listBackups(config, doFetch)).length, 1);
  const q = new URL(calls.find((c) => c.url.includes("/drive/v3/files?"))!.url).searchParams.get("q")!;
  assert.match(q, /'F' in parents/);
  assert.match(q, /value='diyseo-backup'/);
});

test("deleteBackup tolerates an already-deleted file but not other errors", async () => {
  const mk = (status: number) => (async (url: string | URL) => (String(url).includes("token") ? Response.json({ access_token: "t" }) : new Response(null, { status }))) as typeof fetch;
  await deleteBackup(config, "gone", mk(404));
  await assert.rejects(deleteBackup(config, "x", mk(403)), /Drive delete failed: 403/);
});

test("a failed token refresh surfaces without leaking the secret", async () => {
  const doFetch = (async () => Response.json({ error: "invalid_grant" }, { status: 400 })) as typeof fetch;
  await assert.rejects(listBackups({ ...config }, doFetch), (error: Error) => /invalid_grant/.test(error.message) && !/\bs\b.*secret/.test(error.message));
});

test("listBackups follows nextPageToken so old backups are still pruned", async () => {
  const urls: string[] = [];
  const doFetch = (async (url: string | URL) => {
    const u = String(url);
    urls.push(u);
    if (u.includes("token")) return Response.json({ access_token: "t" });
    const token = new URL(u).searchParams.get("pageToken");
    return Response.json(token ? { files: [file("old", 300)] } : { files: [file("new", 1)], nextPageToken: "P2" });
  }) as typeof fetch;
  const all = await listBackups({ ...config }, doFetch);
  assert.deepEqual(all.map((f) => f.id), ["new", "old"]);
  assert.match(decodeURIComponent(urls.at(-1)!), /pageToken=P2/);
});

test("one access token serves every Drive call of the run", async () => {
  let tokenCalls = 0;
  const doFetch = (async (url: string | URL) => {
    if (String(url).includes("token")) {
      tokenCalls += 1;
      return Response.json({ access_token: "t" });
    }
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const cfg = { ...config };
  await deleteBackup(cfg, "a", doFetch);
  await deleteBackup(cfg, "b", doFetch);
  await deleteBackup(cfg, "c", doFetch);
  assert.equal(tokenCalls, 1);
});

test("missingDriveSettings flags a half-configured setup but not an absent one", () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(missingDriveSettings(env({})), []);
  assert.deepEqual(missingDriveSettings(env({ BACKUP_GOOGLE_CLIENT_ID: "a", BACKUP_GOOGLE_CLIENT_SECRET: "b" })), ["BACKUP_GOOGLE_REFRESH_TOKEN", "BACKUP_GOOGLE_DRIVE_FOLDER_ID"]);
});
