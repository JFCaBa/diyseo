import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  }
};

export default nextConfig;
