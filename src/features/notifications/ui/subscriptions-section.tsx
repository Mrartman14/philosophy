// src/features/notifications/ui/subscriptions-section.tsx
import { getT } from "@/i18n";

import { getSubscriptions } from "../api";

import { SubscriptionRow } from "./subscription-row";

export async function SubscriptionsSection() {
  const t = await getT("notifications");
  let result;
  try {
    result = await getSubscriptions();
  } catch {
    return (
      <p className="text-sm text-(--color-fg-muted)">{t("subscriptionsError")}</p>
    );
  }
  const { items } = result;

  if (items.length === 0) {
    return (
      <p className="text-sm text-(--color-fg-muted)">{t("subscriptionsEmpty")}</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {items.map((s) => (
        <SubscriptionRow key={s.id} subscription={s} />
      ))}
    </ul>
  );
}
