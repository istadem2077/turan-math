import type { NextConfig } from "next";

/**
 * Hosts whose `Origin` may differ from the request host on form submissions
 * (Next.js rejects Server Actions otherwise, as CSRF protection). Needed when
 * the app is reached through a tunnel or proxy that rewrites headers, e.g. VS
 * Code port forwarding / dev tunnels, which send `Origin: localhost:3000`.
 * Add more with SERVER_ACTIONS_ALLOWED_ORIGINS="a.example.com,b.example.com"
 * (read at build time).
 */
const allowedOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  experimental: {
    // Question-bank imports and homework uploads can be large.
    serverActions: { bodySizeLimit: "50mb", allowedOrigins },
  },
};

export default nextConfig;
