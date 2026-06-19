// src/app/me/layout.tsx
import type { ReactNode } from "react";

import { RouterLink } from "@/components/ui";

// Под-навигация личного кабинета. Рендерится поверх каждой /me/* страницы,
// чтобы переход между разделами был возможен из любой подстраницы, а не
// только с /me. Гейт авторизации — на самих страницах (requireUserOrRedirect).
const SECTIONS = [
  { href: "/me/notifications", title: "Уведомления" },
  { href: "/me/documents", title: "Мои документы" },
  { href: "/me/media", title: "Мои медиа" },
  { href: "/me/annotations", title: "Мои аннотации" },
  { href: "/me/forms", title: "Мои формы" },
  { href: "/me/submissions", title: "Мои отклики" },
  { href: "/me/stats", title: "Моя статистика" },
  { href: "/me/settings", title: "Настройки" },
] as const;

export default function MeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="border-b border-(--color-border)">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-2 px-6 py-4">
          {SECTIONS.map((section) => (
            <RouterLink
              key={section.href}
              href={section.href}
              className="rounded border border-(--color-border) px-3 py-1.5 text-sm hover:border-(--color-primary) hover:text-(--color-primary)"
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
