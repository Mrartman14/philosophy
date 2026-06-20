// src/app/robots.ts
// robots.txt отдаёт Next (nginx этот путь не перехватывает — см. docs/ops/edge.md).
// sitemap.xml — НЕ наш: его отдаёт бэкенд (nginx exact-match → Go), здесь только ссылка.
import type { MetadataRoute } from "next";

import { siteUrl } from "@/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/me",
        "/api",
        "/dev",
        "/canvases",
        "/documents",
        "/forms",
        "/comments",
        "/annotations",
        "/saved",
        "/share-links",
        "/submissions",
        "/media",
        "/calendar",
        "/auth",
        "/login",
        "/register",
        "/search",
        "/push",
        "/offline",
        "/_offline",
        "/trails/my",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
