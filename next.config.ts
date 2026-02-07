import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force all pages to be dynamic (no static generation during build)
  output: 'standalone',
};

export default nextConfig;
