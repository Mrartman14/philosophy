import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // React Compiler (Next 16, режим infer). Next прогоняет babel-plugin-react-compiler
  // через SWC-оптимизацию только по релевантным файлам — Turbopack/SWC сохраняются
  // (.babelrc намеренно НЕ добавляем). Рантайм компилятора встроен в React 19.2.
  reactCompiler: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    // Включает forbidden() / unauthorized() из next/navigation.
    // Используется в src/app/admin/layout.tsx для гейта по canAccessAdmin.
    // По состоянию на Next 16.1.4 — всё ещё experimental.
    authInterrupts: true,
  },
};

export default withNextIntl(nextConfig);
