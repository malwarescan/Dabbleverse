import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Force all pages to be dynamic (no static generation during build)
  output: 'standalone',
  
  // Skip static page optimization
  experimental: {
    optimizePackageImports: ['@/components'],
  },
};

export default nextConfig;
