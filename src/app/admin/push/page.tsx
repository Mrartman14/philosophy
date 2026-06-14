// src/app/admin/push/page.tsx
import { forbidden } from "next/navigation";

import { PushSendForm, canSendPush } from "@/features/preferences";
import { getMe } from "@/utils/me";

export const metadata = { title: "Push-уведомления — админ" };

export default async function AdminPushPage() {
  const me = await getMe();
  if (!canSendPush(me)) forbidden();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Push-уведомления</h1>
        <p className="text-sm text-(--color-description)">
          Рассылка уходит всем подписанным пользователям. Отправка асинхронная —
          доставка занимает время.
        </p>
      </header>
      <PushSendForm />
    </section>
  );
}
