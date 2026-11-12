import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

// Off-site copy of the nightly dump to Google Drive. Plain REST + OAuth2
// refresh token (consumer Gmail), scope drive.file: the token can only see the
// files this app uploaded. No googleapis dependency.

export const DRIVE_APP_TAG = "diyseo-backup";
export const DRIVE_RETENTION_DAYS = 90;
export const DRIVE_KEEP_MIN = 7;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const REQUEST_TIMEOUT_MS = 120_000;
// The multipart upload holds the file in memory; fail loudly (alert) instead of an OOM kill.
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
};

export type DriveFile = { id: string; name: string; createdTime: string };

type Fetch = typeof fetch;

/** Returns null unless all four BACKUP_GOOGLE_* values are present. */
export function readDriveConfig(env: NodeJS.ProcessEnv = process.env): DriveConfig | null {
  const clientId = env.BACKUP_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.BACKUP_GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = env.BACKUP_GOOGLE_REFRESH_TOKEN?.trim();
  const folderId = env.BACKUP_GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!clientId || !clientSecret || !refreshToken || !folderId) return null;
  return { clientId, clientSecret, refreshToken, folderId };
}

/** Names of the BACKUP_GOOGLE_* values still unset when some, but not all, are set; [] when none or all are set. */
export function missingDriveSettings(env: NodeJS.ProcessEnv = process.env): string[] {
  const names = ["BACKUP_GOOGLE_CLIENT_ID", "BACKUP_GOOGLE_CLIENT_SECRET", "BACKUP_GOOGLE_REFRESH_TOKEN", "BACKUP_GOOGLE_DRIVE_FOLDER_ID"];
  const missing = names.filter((name) => !env[name]?.trim());
  return missing.length === names.length ? [] : missing;
}

/**
 * Which Drive files to delete: older than the retention window, but always keep
 * the `keepMin` newest regardless of age (a stalled job must never prune the
 * last good copies).
 */
export function filesToPrune(files: DriveFile[], nowMs: number, retentionDays = DRIVE_RETENTION_DAYS, keepMin = DRIVE_KEEP_MIN): DriveFile[] {
  const cutoff = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  const newestFirst = [...files].sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime));
  return newestFirst.slice(keepMin).filter((file) => Date.parse(file.createdTime) < cutoff);
}

export async function gzipFile(sourcePath: string): Promise<string> {
  const targetPath = `${sourcePath}.gz`;
  try {
    await pipeline(createReadStream(sourcePath), createGzip({ level: 9 }), createWriteStream(targetPath));
  } catch (error) {
    await fs.rm(targetPath, { force: true });
    throw error;
  }
  return targetPath;
}

// One token per config for the whole run: pruning would otherwise refresh it per file.
const tokenCache = new WeakMap<DriveConfig, Promise<string>>();

function accessToken(config: DriveConfig, doFetch: Fetch): Promise<string> {
  let token = tokenCache.get(config);
  if (!token) {
    token = requestAccessToken(config, doFetch);
    tokenCache.set(config, token);
    token.catch(() => tokenCache.delete(config));
  }
  return token;
}

async function requestAccessToken(config: DriveConfig, doFetch: Fetch): Promise<string> {
  const response = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`Drive token refresh failed: ${data.error ?? response.status}`);
  }
  return data.access_token;
}

export async function uploadBackup(config: DriveConfig, filePath: string, name: string, doFetch: Fetch = fetch): Promise<DriveFile> {
  const token = await accessToken(config, doFetch);
  const { size } = await fs.stat(filePath);
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(`Backup is ${size} bytes, over the ${MAX_UPLOAD_BYTES} byte limit of the in-memory upload: switch to a resumable upload.`);
  }
  const content = await fs.readFile(filePath);
  const boundary = `diyseo-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name, parents: [config.folderId], appProperties: { app: DRIVE_APP_TAG } });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const response = await doFetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,createdTime`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Drive upload failed: ${response.status}`);
  return (await response.json()) as DriveFile;
}

export async function listBackups(config: DriveConfig, doFetch: Fetch = fetch): Promise<DriveFile[]> {
  const token = await accessToken(config, doFetch);
  const query = `'${config.folderId}' in parents and trashed = false and appProperties has { key='app' and value='${DRIVE_APP_TAG}' }`;
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, fields: "nextPageToken,files(id,name,createdTime)", orderBy: "createdTime desc", pageSize: "1000" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await doFetch(`${DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`Drive list failed: ${response.status}`);
    const page = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

export async function deleteBackup(config: DriveConfig, fileId: string, doFetch: Fetch = fetch): Promise<void> {
  const token = await accessToken(config, doFetch);
  const response = await doFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok && response.status !== 404) throw new Error(`Drive delete failed: ${response.status}`);
}
