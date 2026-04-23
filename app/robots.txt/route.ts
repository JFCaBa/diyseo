export const dynamic = "force-static";

export async function GET() {
  const body = ["User-agent: *", "Disallow: /blog/", ""].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
