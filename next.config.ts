import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["drizzle-orm"],
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler"],
};

export default nextConfig;
