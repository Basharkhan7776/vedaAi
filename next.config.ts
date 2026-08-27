import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf-to-img", "@napi-rs/canvas"],
};

export default nextConfig;
