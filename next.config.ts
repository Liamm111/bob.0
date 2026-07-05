import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Wallet signing (node-forge) and googleapis run server-side only.
  serverExternalPackages: ["node-forge"],
  experimental: {
    // Server Actions body size for image-free payloads is fine at default.
  },
};

export default nextConfig;
