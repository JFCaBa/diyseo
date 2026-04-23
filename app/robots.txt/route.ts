import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getConfiguredAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

async function getRequestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) {
    return null;
  }

  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function GET() {
  const sites = await prisma.siteProject.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  const origin = getConfiguredAppUrl() ?? (await getRequestOrigin());
  const lines = ["User-agent: *", "Allow: /", ""];

  if (origin) {
    for (const site of sites) {
      lines.push(`Sitemap: ${origin}/blog/${site.id}/sitemap.xml`);
    }
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
