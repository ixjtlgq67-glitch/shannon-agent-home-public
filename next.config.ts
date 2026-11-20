import type { NextConfig } from "next";

const publicHost = (() => {
  try {
    return process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : "";
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  allowedDevOrigins: publicHost ? [publicHost] : [],
  serverExternalPackages: ["@openai/agents", "@openai/agents-core", "@openai/agents-openai", "openai"],
  async rewrites() {
    return [{ source: "/shannon-extension.zip", destination: "/api/extension-zip" }];
  },
};

export default nextConfig;
