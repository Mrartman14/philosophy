// src/app/me/layout.tsx
import type { ReactNode } from "react";

import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

// Под-навигация личного кабинета. Рендерится поверх каждой /me/* страницы,
// чтобы переход между разделами был возможен из любой подстраницы, а не
// только с /me. Гейт авторизации — на самих страницах (requireUserOrRedirect).

export default async function MeLayout({ children }: { children: ReactNode }) {
  const t = await getT("pages");
  const sections = [
    { href: "/me/notifications", title: t("meNavNotifications") },
    { href: "/me/documents", title: t("meNavDocuments") },
    { href: "/me/media", title: t("meNavMedia") },
    { href: "/me/annotations", title: t("meNavAnnotations") },
    { href: "/me/forms", title: t("meNavForms") },
    { href: "/me/submissions", title: t("meNavSubmissions") },
    { href: "/me/stats", title: t("meNavStats") },
    { href: "/me/settings", title: t("meNavSettings") },
  ];

  return (
    <>
      <nav className="border-b border-(--color-border)">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-2 px-6 py-4">
          {sections.map((section) => (
            <RouterLink
              key={section.href}
              href={section.href}
              className="rounded border border-(--color-border) px-3 py-1.5 text-sm hover:border-(--color-accent) hover:text-(--color-accent)"
            >
              {section.title}
            </RouterLink>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
