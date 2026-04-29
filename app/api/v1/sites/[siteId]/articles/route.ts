import { handlePublishArticleRequest } from "@/lib/publish-article-api";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { siteId } = await context.params;
  return handlePublishArticleRequest(request, siteId);
}
