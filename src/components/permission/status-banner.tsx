import type { MaybeMe } from "@/utils/me";

interface StatusBannerProps {
  me: MaybeMe;
}

const STATUS_TEXT: Record<"suspended" | "banned", string> = {
  suspended:
    "Ваш аккаунт временно ограничен. Чтение доступно, новые действия — нет.",
  banned:
    "Ваш аккаунт заблокирован. Все действия запрещены.",
};

/**
 * Глобальный баннер для пользователей с не-active статусом. Не рендерит
 * ничего для гостей и для активных юзеров.
 */
export const StatusBanner: React.FC<StatusBannerProps> = ({ me }) => {
  if (!me) return null;
  if (me.status === "active") return null;

  return (
    <div
      role="status"
      className="w-full bg-amber-50 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 text-center"
    >
      {STATUS_TEXT[me.status]}
    </div>
  );
};
