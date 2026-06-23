// src/app/me/layout.tsx
import type { ReactNode } from "react";

import { NavRail } from "@/components/shared/nav-rail";
import { SidebarLayout } from "@/components/shared/sidebar-layout";
import { getT } from "@/i18n";

// Под-навигация личного кабинета над каждой /me/* страницей. Вид сайдбара
// (responsive, sticky-десктоп, без фона) — в общем SidebarLayout (один паттерн
// на всё приложение). Active-подсветка ссылок — в NavRail.
// Гейт авторизации — на самих страницах (requireUserOrRedirect).

export default async function MeLayout({ children }: { children: ReactNode }) {
  const t = await getT("pages");
  const items = [
    { href: "/me/notifications", label: t("meNavNotifications") },
    { href: "/me/documents", label: t("meNavDocuments") },
    { href: "/me/media", label: t("meNavMedia") },
    { href: "/me/annotations", label: t("meNavAnnotations") },
    { href: "/me/forms", label: t("meNavForms") },
    { href: "/me/submissions", label: t("meNavSubmissions") },
    { href: "/me/stats", label: t("meNavStats") },
    { href: "/me/settings", label: t("meNavSettings") },
    { href: "/me/tokens", label: t("meNavTokens") },
  ];

  return (
    <SidebarLayout
      nav={<NavRail items={items} ariaLabel={t("meNavAriaLabel")} orientation="responsive" />}
    >
      {children}
    </SidebarLayout>
  );
}
