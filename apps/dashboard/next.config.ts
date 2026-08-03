import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@onepixel/protocol"],
  turbopack: {
    root: resolve(dashboardRoot, "../.."),
  },
};

export default nextConfig;
