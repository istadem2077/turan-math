import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Question-bank imports can be large.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
