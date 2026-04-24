import type { NextConfig } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";

const nextConfig: NextConfig = {
  assetPrefix: appUrl || undefined,
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
      }
    ];
  }
};

export default nextConfig;
