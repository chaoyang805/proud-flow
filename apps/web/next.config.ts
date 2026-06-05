import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@proud-flow/api-client",
    "@proud-flow/api-contract",
    "@proud-flow/domain",
  ],
};

export default nextConfig;

