// src/app/admin/layout.tsx
import { forbidden } from "next/navigation";

import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import { buildNavItems, canAccessAdmin } from "./admin-access";
import { AdminSidebar } from "./admin-sidebar";

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

  const navItems = buildNavItems(me);
  const t = await getT("admin");

  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] w-full">
      <aside className="w-56 shrink-0 border-r border-(--color-border) bg-(--color-surface-subtle) p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <RouterLink
            href="/"
            className="text-xs text-(--color-fg-muted) hover:underline"
          >
            {t("shellBackToSite")}
          </RouterLink>
          <h2 className="text-lg font-bold">{t("shellTitle")}</h2>
          {me && (
            <span className="text-xs text-(--color-fg-muted) break-all">
              {me.username}
            </span>
          )}
        </div>
        <AdminSidebar items={navItems} />
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
