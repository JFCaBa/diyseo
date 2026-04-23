import { NextResponse } from "next/server";

function isBlockedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized === "0.0.0.0" || normalized === "::1" || normalized.endsWith(".local")) {
    return true;
  }

  if (/^127\.\d+\.\d+\.\d+$/.test(normalized)) {
    return true;
  }

  if (/^10\.\d+\.\d+\.\d+$/.test(normalized)) {
    return true;
  }

  if (/^192\.168\.\d+\.\d+$/.test(normalized)) {
    return true;
  }

  const private172 = normalized.match(/^172\.(\d+)\.\d+\.\d+$/);
  if (private172) {
    const secondOctet = Number(private172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

function normalizeImageUrl(url: string): string {
  // Google Drive share links (drive.google.com/file/d/{fileId}/view...) don't
  // serve the raw file — rewrite to the direct content URL.
  const driveMatch = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveMatch) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = normalizeImageUrl(searchParams.get("url")?.trim() ?? "");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing image URL." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol) || isBlockedHostname(parsed.hostname)) {
    return NextResponse.json({ error: "Image URL is not allowed." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "DIYSEO-ImageProxy/1.0"
      },
      redirect: "follow",
      cache: "force-cache"
    });
  } catch {
    return NextResponse.json({ error: "Unable to fetch image." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "Image request failed." }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "URL did not return an image." }, { status: 415 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Disposition": "inline"
    }
  });
}
