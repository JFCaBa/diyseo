import { getAppOrigin } from "@/lib/app-origin";
import { landingSitemapXml } from "@/lib/landing/sitemap";

// Built once, like robots.txt: the content only depends on NEXT_PUBLIC_APP_URL.
export const dynamic = "force-static";

export function GET() {
  const appUrl = getAppOrigin();

  if (!appUrl) {
    return new Response("NEXT_PUBLIC_APP_URL is not configured", { status: 500 });
  }

  return new Response(landingSitemapXml(appUrl), {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}
