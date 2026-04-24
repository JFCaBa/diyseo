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

import { createDatabaseBackup } from "@/lib/backup-utils";

createDatabaseBackup()
  .then((result) => {
    console.log(`Created backup ${result.filename} (${result.size} bytes)`);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Database backup failed.";
    console.error(message);
    process.exitCode = 1;
  });
