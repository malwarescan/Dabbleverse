import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Disable static optimization to prevent build-time errors
  experimental: {
    isrMemoryCacheSize: 0,
  },
  
  // Force all pages to be dynamic (no static generation during build)
  output: 'standalone',
};

export default nextConfig;
