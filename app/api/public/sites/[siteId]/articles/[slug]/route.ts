import { NextResponse } from "next/server";

import { getPublishedArticleBySlug } from "@/lib/articles";

type RouteContext = {
  params: Promise<{ siteId: string; slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { siteId, slug } = await context.params;
  const article = await getPublishedArticleBySlug(siteId, slug);

  if (!article) {
    return NextResponse.json(
      {
        error: "Article not found."
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    siteId,
    article
  });
}
