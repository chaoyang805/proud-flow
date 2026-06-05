import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@proud-flow/api-client",
    "@proud-flow/api-contract",
    "@proud-flow/domain",
  ],
};

export default nextConfig;

initOpenNextCloudflareForDev();
