// src/app/admin/layout.tsx
import { forbidden } from "next/navigation";

import { ChevronIcon } from "@/assets/icons/chevron-icon";
import { MarginSidebarLayout } from "@/components/shared/margin-sidebar-layout";
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

  // Сайдбар админки — тот же margin-nav паттерн, что и /me: на ≥xl нав уходит в
  // ЛЕВОЕ ПОЛЕ (sticky под шапкой), контент занимает весь хребет; ниже xl нав
  // падает полосой сверху. В слот nav — шапка секции (назад/тайтл/юзер) + NavRail.
  // Контент со своим p-6.
  return (
    <MarginSidebarLayout
      nav={
        <div className="flex flex-col gap-4">
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
            orientation="responsive"
          />
        </div>
      }
    >
      <div className="p-6">{children}</div>
    </MarginSidebarLayout>
  );
}
