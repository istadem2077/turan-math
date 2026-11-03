import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
    // Question-bank imports can be large.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
