import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: ".next-prod",
  turbopack: {
    root: process.cwd(),
  },
  reactStrictMode: true,
  // App Router `src/app/api/v1/[...path]/route.ts` owns `/api/v1/*` so POST/PUT/
  // PATCH/DELETE are forwarded. This rewrite remains a fallback for other `/api` paths.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
