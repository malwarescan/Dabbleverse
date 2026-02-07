import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Force cache bust
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  
  // Disable static 404 generation - fixes Railway build
  skipTrailingSlashRedirect: true,
  
  // Ensure dynamic rendering
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
