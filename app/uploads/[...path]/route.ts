import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function resolveLocalUploadDir() {
  const configured = process.env.LOCAL_UPLOAD_DIR?.trim() || "public/uploads";
  return path.resolve(path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured));
}

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { path: segments } = await context.params;

  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  const baseDir = resolveLocalUploadDir();
  const requested = path.resolve(baseDir, ...segments);

  if (requested !== baseDir && !requested.startsWith(`${baseDir}${path.sep}`)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let fileStat;
  try {
    fileStat = await stat(requested);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!fileStat.isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const mimeType = MIME_TYPES[path.extname(requested).toLowerCase()] ?? "application/octet-stream";
  const stream = Readable.toWeb(createReadStream(requested)) as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
