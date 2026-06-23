// src/app/me/layout.tsx
import type { ReactNode } from "react";

import { NavRail } from "@/components/shared/nav-rail";
import { getT } from "@/i18n";

// Под-навигация личного кабинета. Margin-nav раскладка: на ≥xl (1280) нав уходит
// в ЛЕВОЕ ПОЛЕ (margin-start, sticky), а контент занимает ВЕСЬ хребет (~720) —
// не делит его с сайдбаром. Ниже xl поле схлопывается → нав падает полосой сверху
// (border-b) в хребте, контент под ней. Оба — прямые потомки .page-grid (фрагмент),
// иначе именованные грид-линии не сработают. Active-подсветка ссылок — в NavRail.
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
    <>
      <aside className="border-b border-(--color-border) p-4 xl:border-b-0 xl:p-0 xl:self-start xl:sticky xl:top-(--header-height) xl:col-start-[margin-start] xl:col-end-[content-start]">
        <NavRail items={items} ariaLabel={t("meNavAriaLabel")} orientation="responsive" />
      </aside>
      <div className="min-w-0">{children}</div>
    </>
  );
}
