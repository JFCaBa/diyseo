import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export async function GET() {
  const sites = await prisma.siteProject.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  const appUrl = getAppUrl();
  const lines = ["User-agent: *", "Allow: /blog", "Allow: /blog/*"];

  if (appUrl) {
    for (const site of sites) {
      lines.push(`Sitemap: ${appUrl}/blog/${site.id}/sitemap.xml`);
    }
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
