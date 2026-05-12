export const dynamic = "force-static";

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export async function GET() {
  const appUrl = getAppUrl();
  const lines = ["User-agent: *", "Disallow: /blog/"];

  if (appUrl) {
    lines.push(`Sitemap: ${appUrl}/sitemap.xml`);
  }

  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
