import {
  handleGetArticleRequest,
  handlePatchArticleRequest,
  handlePutArticleRequest
} from "@/lib/articles-api";

type RouteContext = {
  params: Promise<{ siteId: string; idOrSlug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { siteId, idOrSlug } = await context.params;
  return handleGetArticleRequest(request, siteId, idOrSlug);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { siteId, idOrSlug } = await context.params;
  return handlePatchArticleRequest(request, siteId, idOrSlug);
}

export async function PUT(request: Request, context: RouteContext) {
  const { siteId, idOrSlug } = await context.params;
  return handlePutArticleRequest(request, siteId, idOrSlug);
}
