// src/app/me/layout.tsx
import type { ReactNode } from "react";

import { NavRail } from "@/components/shared/nav-rail";
import { getT } from "@/i18n";

// Под-навигация личного кабинета над каждой /me/* страницей.
// На десктопе — вертикальная колонка слева, sticky под шапкой (контент справа);
// на мобиле — обычная полоса над контентом, БЕЗ sticky и фона (просто скроллится
// вместе со страницей). Без фона: на мобиле ничего под навигацией не скроллится.
// Active-подсветка и разметка ссылок — в shared-компоненте NavRail.
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

  // Живём в общем 720-хребте (как весь контент) — сайдбар во флоу «вместе со
  // всеми», непрерывные бордеры хребта от хедера донизу. НЕ выходим в full-bleed:
  // иначе .col-bleed погасил бы бордер хребта (см. layout.css opt-out), и узкий
  // хедер повисал бы над широким неоформленным контентом.
  return (
    <div className="flex flex-col lg:flex-row">
      <aside className="border-b border-(--color-border) p-4 lg:w-56 lg:shrink-0 lg:self-start lg:sticky lg:top-(--header-height) lg:border-b-0 lg:border-e">
        <NavRail
          items={items}
          ariaLabel={t("meNavAriaLabel")}
          orientation="responsive"
        />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
