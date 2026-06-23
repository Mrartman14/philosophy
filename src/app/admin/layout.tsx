// src/app/admin/layout.tsx
import { forbidden } from "next/navigation";

import { ChevronIcon } from "@/assets/icons/chevron-icon";
import { NavRail } from "@/components/shared/nav-rail";
import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import { buildNavItems, canAccessAdmin } from "./admin-access";

export async function generateMetadata() {
  const t = await getT("admin");
  return { title: t("shellTitle") };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  if (!canAccessAdmin(me)) forbidden();

  const t = await getT("admin");
  const navItems = buildNavItems(me).map((item) => ({
    href: item.href,
    label: t(item.labelKey),
  }));

  // В общем 720-хребте (как весь контент): сайдбар во флоу, непрерывные бордеры
  // хребта от хедера. БЕЗ WideShell (иначе .col-bleed гасит бордер хребта).
  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] w-full">
      <aside className="w-56 shrink-0 border-e border-(--color-border) bg-(--color-surface-subtle) p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <RouterLink
            href="/"
            className="inline-flex items-center gap-1 text-xs text-(--color-fg-muted) hover:underline"
          >
            <ChevronIcon className="rtl-flip rotate-180" />
            {t("shellBackToSite")}
          </RouterLink>
          <h2 className="text-lg font-bold">{t("shellTitle")}</h2>
          {me && (
            <span className="text-xs text-(--color-fg-muted) break-all">
              {me.username}
            </span>
          )}
        </div>
        <NavRail
          items={navItems}
          ariaLabel={t("shellNavAriaLabel")}
          orientation="vertical"
        />
      </aside>
      <div className="flex-1 min-w-0 p-6">{children}</div>
    </div>
  );
}
