import type { MaybeMe } from "@/utils/me";

interface StatusBannerProps {
  me: MaybeMe;
}

/**
 * Глобальный баннер для suspended-пользователей (чтение доступно, новые
 * действия — нет). Для гостей и активных — ничего.
 *
 * Отдельной `banned`-ветки нет намеренно: забаненный сюда не доходит — бэк
 * отдаёт 403 на `/api/me`, поэтому `getMe()` возвращает `null`, а root layout
 * вдобавок форс-логаутит его (см. `getBanSignal` → `/auth/forced-logout`).
 */
export const StatusBanner: React.FC<StatusBannerProps> = ({ me }) => {
  if (me?.status !== "suspended") return null;

  return (
    <div
      role="status"
      className="w-full bg-amber-50 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 text-center"
    >
      Ваш аккаунт временно ограничен. Чтение доступно, новые действия — нет.
    </div>
  );
};
