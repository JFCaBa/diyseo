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
