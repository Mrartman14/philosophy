// src/app/admin/push/page.tsx
import { forbidden } from "next/navigation";

import { PushSendForm, canSendPush } from "@/features/preferences";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export const metadata = { title: "Push-уведомления — админ" };

export default async function AdminPushPage() {
  const me = await getMe();
  if (!canSendPush(me)) forbidden();

  const t = await getT("admin");

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("pushTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("pushDescription")}
        </p>
      </header>
      <PushSendForm />
    </section>
  );
}
