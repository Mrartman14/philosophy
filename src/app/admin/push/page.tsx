import { PushSender } from "@/features/admin/push/push-sender";

export const metadata = { title: "Push — Админ" };

export default function AdminPushPage() {
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
