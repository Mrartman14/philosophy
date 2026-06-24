// src/app/me/layout.tsx
import type { ReactNode } from "react";

import { canAccessAdmin } from "@/app/admin/admin-access";
import { MarginSidebarLayout } from "@/components/shared/margin-sidebar-layout";
import { NavRail } from "@/components/shared/nav-rail";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

// Под-навигация личного кабинета в margin-nav раскладке (общий
// MarginSidebarLayout): на ≥xl нав в левом поле (sticky), контент на весь хребет;
// ниже xl — полоса сверху. Active-подсветка — NavRail.
// Гейт авторизации — на самих страницах (requireUserOrRedirect).

export default async function MeLayout({ children }: { children: ReactNode }) {
  const t = await getT("pages");
  const me = await getMe();
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
    // Вход в админку из личного кабинета — только при наличии админ-capability
    // (тот же гейт, что охраняет /admin layout). Обычным юзерам не виден.
    ...(canAccessAdmin(me) ? [{ href: "/admin", label: t("meNavAdmin") }] : []),
  ];

  return (
    <MarginSidebarLayout
      nav={<NavRail items={items} ariaLabel={t("meNavAriaLabel")} orientation="responsive" />}
    >
      {children}
    </MarginSidebarLayout>
  );
}
