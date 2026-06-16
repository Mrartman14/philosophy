// src/features/notifications/ui/subscriptions-section.tsx
import { getSubscriptions } from "../api";
import { SubscriptionRow } from "./subscription-row";

export async function SubscriptionsSection() {
  const { items } = await getSubscriptions();

  if (items.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">У вас нет активных подписок.</p>
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
