import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip ESLint during build (eslint-config-next + ESLint 9 flat config can trigger "Plugin \"\" not found")
  eslint: { ignoreDuringBuilds: true },
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
