import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { cachedSocialJpeg, isLocalCover } from "@/lib/social/social-image";
import { isCurrentCoverVersion } from "@/lib/social/urls";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ siteId: string; articleId: string }> };

const notFound = () => new NextResponse("Not found", { status: 404 });

/** The cover of a PUBLISHED article as a JPEG Meta can fetch. Local covers only; anything else is 404. */
export async function GET(request: Request, context: RouteContext) {
  const { siteId, articleId } = await context.params;
  const article = await prisma.article.findFirst({
    where: { id: articleId, siteProjectId: siteId, status: "PUBLISHED" },
    select: { coverImageUrl: true }
  });
  if (!article || !isLocalCover(article.coverImageUrl)) return notFound();
  // Only the current cover version is rendered: a varying `v` cannot force new image work past the CDN cache.
  if (!isCurrentCoverVersion(article.coverImageUrl, new URL(request.url).searchParams.get("v"))) return notFound();

  let jpeg: Buffer | null;
  try {
    jpeg = await cachedSocialJpeg(article.coverImageUrl, articleId);
  } catch {
    return notFound();
  }
  if (!jpeg) return notFound();
  return new NextResponse(new Uint8Array(jpeg), {
    status: 200,
    headers: { "Content-Type": "image/jpeg", "Content-Length": String(jpeg.length), "Cache-Control": "public, max-age=86400" }
  });
}
