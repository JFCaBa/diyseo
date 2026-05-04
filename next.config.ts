import type { NextConfig } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
// Customer domains proxy /blog/* to this app via Cloudflare Workers. Without an
// absolute prefix, Next emits /_next/... relative paths that the browser resolves
// against the customer's host and then 404. assetPrefix forces every static asset
// reference to the canonical origin so customer Workers can pass HTML through
// untouched.
const useAssetPrefix = Boolean(appUrl) && process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(useAssetPrefix ? { assetPrefix: appUrl } : {}),
  async rewrites() {
    return [
      {
        source: "/blog/api/public/:path*",
        destination: "/api/public/:path*"
      },
      {
        source: "/blog/api/public/sites/:siteId/config",
        destination: "/api/public/sites/:siteId/config"
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/api/public/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Accept" },
          { key: "Access-Control-Max-Age", value: "86400" }
        ]
      },
      {
        source: "/embed.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" }
        ]
      },
      {
        source: "/_next/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }]
      }
    ];
  }
};

export default nextConfig;
