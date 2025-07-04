import type { NextConfig } from "next";

// const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // GitHub Pages не поддерживает оптимизацию изображений Next.js
    unoptimized: true,
  },
  assetPrefix: `${basePath}/`,
  // assetPrefix: isProd ? "/philosophy/" : "",
  basePath: basePath,
  output: "export",
};

module.exports = nextConfig;
