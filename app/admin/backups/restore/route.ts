import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createDatabaseBackup, restoreDatabaseFromSqlBuffer } from "@/lib/backup-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildRedirectUrl(search: Record<string, string>) {
  const params = new URLSearchParams(search);
  return `/admin/backups?${params.toString()}`;
}

function toSafeRestoreErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Database restore failed.";

  if (
    message === "DATABASE_URL is not configured." ||
    message === "pg_dump is not available on this server." ||
    message === "psql is not available on this server."
  ) {
    return message;
  }

  if (message === "Failed to write database backup.") {
    return message;
  }

  if (message === "pg_dump failed." || message === "psql restore failed.") {
    return message;
  }

  return "Database restore failed.";
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const formData = await request.formData();
  const confirmRestore = typeof formData.get("confirmRestore") === "string" ? formData.get("confirmRestore")!.toString().trim() : "";
  const backupFile = formData.get("backupFile");

  if (confirmRestore !== "RESTORE") {
    return NextResponse.redirect(new URL(buildRedirectUrl({ restore: "error", message: "Type RESTORE to confirm." }), request.url));
  }

  if (!(backupFile instanceof File) || backupFile.size === 0) {
    return NextResponse.redirect(new URL(buildRedirectUrl({ restore: "error", message: "Upload a .sql backup file." }), request.url));
  }

  if (!backupFile.name.toLowerCase().endsWith(".sql")) {
    return NextResponse.redirect(new URL(buildRedirectUrl({ restore: "error", message: "Only .sql backup files are supported." }), request.url));
  }

  try {
    const preRestoreBackup = await createDatabaseBackup();
    const sqlBuffer = Buffer.from(await backupFile.arrayBuffer());

    await restoreDatabaseFromSqlBuffer(sqlBuffer);

    return NextResponse.redirect(
      new URL(
        buildRedirectUrl({
          restore: "success",
          backup: preRestoreBackup.filename
        }),
        request.url
      )
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        buildRedirectUrl({
          restore: "error",
          message: toSafeRestoreErrorMessage(error)
        }),
        request.url
      )
    );
  }
}
