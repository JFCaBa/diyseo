import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";

import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatBackupFilename(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0")
  ];

  return `diyseo-full-backup-${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}.sql.gz`;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
  }

  const filename = formatBackupFilename();

  return new Promise<Response>((resolve) => {
    const pgDump = spawn("pg_dump", ["--no-owner", "--no-privileges", databaseUrl], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const gzip = createGzip();

    const stderrChunks: Buffer[] = [];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        gzip.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        pgDump.stdout.pipe(gzip);

        pgDump.stderr.on("data", (chunk: Buffer) => {
          stderrChunks.push(Buffer.from(chunk));
        });

        pgDump.on("error", () => {
          controller.error(new Error("pg_dump is not available on this server."));
        });

        gzip.on("error", () => {
          controller.error(new Error("gzip compression failed."));
        });

        pgDump.on("close", (code) => {
          if (code === 0) {
            gzip.end();
            return;
          }

          const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
          controller.error(new Error(stderr || "pg_dump failed."));
        });

        gzip.on("end", () => {
          controller.close();
        });
      },
      cancel() {
        if (!pgDump.killed) {
          pgDump.kill("SIGTERM");
        }

        gzip.destroy();
      }
    });

    resolve(
      new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store"
        }
      })
    );
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Database backup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  });
}
