export function getAppOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export function buildAdminArticleUrl(siteId: string, articleId: string) {
  const origin = getAppOrigin();
  const path = `/${siteId}/articles/${articleId}`;
  return origin ? `${origin}${path}` : path;
}

export function buildPublicArticleUrl(siteId: string, slug: string) {
  const origin = getAppOrigin();
  const path = `/blog/${siteId}/${slug}`;
  return origin ? `${origin}${path}` : path;
}

export function buildPublishingApiUrl(siteId: string) {
  const origin = getAppOrigin();
  const path = `/api/v1/sites/${siteId}/articles`;
  return origin ? `${origin}${path}` : path;
}
