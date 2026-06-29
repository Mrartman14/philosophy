// src/app/me/notifications/page.tsx
import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  getNotificationCounts,
  getNotifications,
  NotificationItem,
  NotificationListActions,
} from "@/features/notifications";
import { getT } from "@/i18n";
import { requireUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("notificationsTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  await requireUserOrRedirect("/me/notifications");

  const { offset: offsetParam } = await searchParams;
  const limit = 20;
  const offset = parseNonNegativeInt(offsetParam, 0);
  const [{ items, total }, { unread, unseen }] = await Promise.all([
    getNotifications(offset, limit),
    getNotificationCounts(),
  ]);
  const t = await getT("pages");

  const paginationLabels = await getPaginationLabels();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("notificationsHeading")}</h1>
        <NotificationListActions hasUnread={unread > 0} hasUnseen={unseen > 0} />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("notificationsEmpty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-(--color-border)">
          {items.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}

      {total > 0 && (
        <Pagination basePath="/me/notifications" offset={offset} limit={limit} total={total} labels={paginationLabels} />
      )}
    </div>
  );
}
