import type { NextConfig } from "next";
// import pwa from "next-pwa";

const isProd = process.env.NODE_ENV === "production";

// const withPWA = pwa({
//   dest: "public",
//   register: true,
//   skipWaiting: true,
//   // disable: process.env.NODE_ENV === 'development',
//   // scope: '/app',
//   // sw: 'service-worker.js',
//   //...
// });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // GitHub Pages не поддерживает оптимизацию изображений Next.js
  },
  assetPrefix: isProd ? "/philosophy/" : "",
  basePath: isProd ? "/philosophy" : "",
  output: "export",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// module.exports = withPWA(nextConfig as any);

module.exports = nextConfig;
