import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const BACKUP_FILE_PATTERN = /^diyseo-full-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.sql$/;
export const BACKUP_RETENTION_COUNT = 7;

export type StoredBackupFile = {
  filename: string;
  absolutePath: string;
  size: number;
  createdAt: Date;
};

export function getBackupDirectoryPath() {
  return path.join(process.cwd(), "backups");
}

export function formatStoredBackupFilename(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0")
  ];

  return `diyseo-full-backup-${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}.sql`;
}

export function isValidStoredBackupFilename(filename: string) {
  return BACKUP_FILE_PATTERN.test(filename);
}

export async function ensureBackupDirectory() {
  const backupDirectory = getBackupDirectoryPath();
  await fs.mkdir(backupDirectory, { recursive: true });
  return backupDirectory;
}

export async function listStoredBackups() {
  const backupDirectory = await ensureBackupDirectory();
  const entries = await fs.readdir(backupDirectory, { withFileTypes: true });

  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isValidStoredBackupFilename(entry.name))
      .map(async (entry) => {
        const absolutePath = path.join(backupDirectory, entry.name);
        const stats = await fs.stat(absolutePath);

        return {
          filename: entry.name,
          absolutePath,
          size: stats.size,
          createdAt: stats.mtime
        } satisfies StoredBackupFile;
      })
  );

  return backups.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export async function createDatabaseBackup() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const backupDirectory = await ensureBackupDirectory();
  const filename = formatStoredBackupFilename();
  const absolutePath = path.join(backupDirectory, filename);

  const pgDump = spawn("pg_dump", ["--no-owner", "--no-privileges", databaseUrl], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stderrChunks: Buffer[] = [];
  pgDump.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(Buffer.from(chunk));
  });

  const fileStream = createWriteStream(absolutePath, { encoding: "utf8" });

  try {
    await pipeline(pgDump.stdout, fileStream);
  } catch {
    if (!pgDump.killed) {
      pgDump.kill("SIGTERM");
    }

    await fs.rm(absolutePath, { force: true });
    throw new Error("Failed to write database backup.");
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    pgDump.on("error", () => reject(new Error("pg_dump is not available on this server.")));
    pgDump.on("close", resolve);
  });

  if (exitCode !== 0) {
    await fs.rm(absolutePath, { force: true });
    const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
    throw new Error(stderr || "pg_dump failed.");
  }

  const backups = await listStoredBackups();
  const oldBackups = backups.slice(BACKUP_RETENTION_COUNT);

  await Promise.all(oldBackups.map((backup) => fs.rm(backup.absolutePath, { force: true })));

  const stats = await fs.stat(absolutePath);

  return {
    filename,
    absolutePath,
    size: stats.size,
    retainedBackups: Math.min(backups.length, BACKUP_RETENTION_COUNT)
  };
}

export async function restoreDatabaseFromSqlBuffer(sqlBuffer: Buffer) {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const psql = spawn("psql", ["-v", "ON_ERROR_STOP=1", databaseUrl], {
    env: process.env,
    stdio: ["pipe", "ignore", "pipe"]
  });

  const stderrChunks: Buffer[] = [];
  psql.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(Buffer.from(chunk));
  });

  const exitCodePromise = new Promise<number>((resolve, reject) => {
    psql.on("error", () => reject(new Error("psql is not available on this server.")));
    psql.on("close", resolve);
  });

  psql.stdin.end(sqlBuffer);

  const exitCode = await exitCodePromise;

  if (exitCode !== 0) {
    const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
    throw new Error(stderr || "psql restore failed.");
  }
}
