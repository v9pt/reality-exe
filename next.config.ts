import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the root so a lockfile in a parent folder is never picked up.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  reactStrictMode: true,
  // No floating Next.js badge in development; errors still show in the overlay.
  devIndicators: false,
};

export default nextConfig;
