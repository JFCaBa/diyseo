import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getBackupDirectoryPath, isValidStoredBackupFilename } from "@/lib/backup-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { filename } = await context.params;

  if (!isValidStoredBackupFilename(filename)) {
    return NextResponse.json({ error: "Backup file not found." }, { status: 404 });
  }

  const backupPath = `${getBackupDirectoryPath()}/${filename}`;

  try {
    const stats = await fs.stat(backupPath);
    const stream = Readable.toWeb(createReadStream(backupPath));

    return new Response(stream as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(stats.size),
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Backup file not found." }, { status: 404 });
  }
}
