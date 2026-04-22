import { NextResponse } from "next/server";

import { getPublishedArticles } from "@/lib/articles";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { siteId } = await context.params;
  const articles = await getPublishedArticles(siteId);

  return NextResponse.json({
    siteId,
    articles
  });
}
