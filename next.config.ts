import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Скрины игры весят 2-10 МБ. Дефолт Next.js — 1 МБ.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
