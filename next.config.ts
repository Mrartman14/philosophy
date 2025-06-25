import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // GitHub Pages не поддерживает оптимизацию изображений Next.js
  },
  assetPrefix: isProd ? "/philosophy/" : "",
  basePath: isProd ? "/philosophy" : "",
  output: "export",
};

module.exports = nextConfig;
