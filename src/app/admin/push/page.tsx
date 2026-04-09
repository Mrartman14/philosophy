import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { canSendPush } from "@/features/admin/permissions";
import { PushSender } from "@/features/admin/push/push-sender";

export const metadata = { title: "Push — Админ" };

export default async function AdminPushPage() {
  const me = await getMe();
  if (!canSendPush(me)) forbidden();
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Отправка push</h1>
      <p className="text-sm text-(--color-description)">
        Уведомление получат все подписанные устройства.
      </p>
      <PushSender />
    </div>
  );
}
