import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const filename of [".env.local", ".env"]) {
  const filepath = resolve(process.cwd(), filename);

  if (!existsSync(filepath)) {
    continue;
  }

  for (const line of readFileSync(filepath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");

    if (eqIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const raw = trimmed.slice(eqIndex + 1).trim();
    const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

import { promises as fs } from "node:fs";

import { sendBackupAlert } from "@/lib/backup-alert";
import {
  deleteBackup,
  filesToPrune,
  gzipFile,
  listBackups,
  missingDriveSettings,
  readDriveConfig,
  uploadBackup
} from "@/lib/backup-drive";
import { createDatabaseBackup } from "@/lib/backup-utils";

function log(...args: unknown[]) {
  console.log(`[backup ${new Date().toISOString()}]`, ...args);
}

async function main() {
  // 1. Local dump (critical): without it there is no backup at all.
  let local: Awaited<ReturnType<typeof createDatabaseBackup>>;
  try {
    local = await createDatabaseBackup();
    log(`Created backup ${local.filename} (${local.size} bytes)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database backup failed.";
    log("LOCAL BACKUP FAILED:", message);
    await sendBackupAlert("local backup FAILED", message);
    process.exitCode = 1;
    return;
  }

  // 2. Off-site copy to Drive.
  const drive = readDriveConfig();
  const partial = missingDriveSettings();
  if (partial.length) log(`WARNING: Drive settings incomplete, missing ${partial.join(", ")}`);
  if (!drive) {
    if (process.env.BACKUP_OFFSITE_REQUIRED === "true") {
      log("offsite required but BACKUP_GOOGLE_* credentials are missing");
      await sendBackupAlert("offsite NOT configured", "BACKUP_GOOGLE_* credentials missing while BACKUP_OFFSITE_REQUIRED=true.");
      process.exitCode = 1;
    } else {
      log("Drive not configured; local-only backup");
    }
    return;
  }

  let gzPath: string | null = null;
  try {
    gzPath = await gzipFile(local.absolutePath);
    const uploaded = await uploadBackup(drive, gzPath, `${local.filename}.gz`);
    log("uploaded to Drive:", uploaded.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("DRIVE UPLOAD FAILED (local OK):", message);
    await sendBackupAlert("Drive upload failed (local copy OK)", message);
    if (process.env.BACKUP_OFFSITE_REQUIRED === "true") process.exitCode = 1;
    return;
  } finally {
    if (gzPath) await fs.rm(gzPath, { force: true });
  }

  // 3. Drive retention. The copy is already safe, so a failure here is only a warning.
  try {
    const stale = filesToPrune(await listBackups(drive), Date.now());
    for (const file of stale) await deleteBackup(drive, file.id);
    if (stale.length) log(`pruned ${stale.length} Drive backups`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("Drive prune failed (non-fatal):", message);
    await sendBackupAlert("Drive prune failed (copy uploaded)", message);
  }
}

main().catch((error: unknown) => {
  log("UNEXPECTED FAILURE:", error);
  process.exitCode = 1;
});
