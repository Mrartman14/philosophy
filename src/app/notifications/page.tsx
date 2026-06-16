// src/app/notifications/page.tsx
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui";
import {
  getNotifications,
  NotificationItem,
  NotificationListActions,
} from "@/features/notifications";
import { getMe } from "@/utils/me";

export const metadata = { title: "Уведомления" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!me) redirect("/login?next=/notifications");

  const { offset: offsetParam } = await searchParams;
  const limit = 20;
  const offset = Math.max(0, Number.parseInt(offsetParam ?? "0", 10) || 0);
  const { items, total } = await getNotifications(offset, limit);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        <NotificationListActions />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">Пока нет уведомлений.</p>
      ) : (
        <div className="flex flex-col divide-y divide-(--color-border)">
          {items.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}

      {total > 0 && (
        <Pagination basePath="/notifications" offset={offset} limit={limit} total={total} />
      )}
    </div>
  );
}
