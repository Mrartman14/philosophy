// src/services/offline/owner.ts
// Browser-only: маркер «владельца» офлайн-кеша (localStorage) + сверка личности.
import { OFFLINE_OWNER_KEY } from "./contract/storage";
import { wipeOfflineData } from "./wipe";

export function getOfflineOwner(): string | null {
  try {
    return localStorage.getItem(OFFLINE_OWNER_KEY);
  } catch {
    return null; // приватный режим / нет доступа к localStorage
  }
}

function setOfflineOwner(userId: string): void {
  try {
    localStorage.setItem(OFFLINE_OWNER_KEY, userId);
  } catch {
    // best-effort
  }
}

/**
 * Полностью убирает маркер владельца — используется при форс-логауте по бану,
 * чтобы локально не осталось следов прежней личности. Best-effort, не бросает.
 */
export function clearOfflineOwner(): void {
  try {
    localStorage.removeItem(OFFLINE_OWNER_KEY);
  } catch {
    // приватный режим / нет доступа к localStorage
  }
}

/**
 * Сверяет владельца офлайн-кеша с текущим пользователем и при расхождении
 * чистит кеш. Закрывает утечку при ПАССИВНОМ логауте (протухание/отзыв
 * токена): зачистка привязана к смене личности, а не только к клику «Выйти».
 *
 * - гость (null): не трогаем — токен мог протухнуть, владелец ещё вернётся;
 * - тот же владелец: не трогаем — библиотека переживает повторный вход;
 * - другой пользователь (или маркера ещё нет): чистим и фиксируем нового
 *   владельца, чтобы приватные данные не утекли следующему аккаунту.
 *
 * Случай «маркера нет, но данные есть» (доисторические данные до появления
 * маркера) трактуется как смена владельца → одноразовая зачистка.
 *
 * Маркер двигаем ТОЛЬКО при успешной зачистке: если `wipeOfflineData()` не
 * добил все подсистемы, оставляем старый маркер — расхождение личностей снова
 * сработает на следующем заходе и зачистка повторится. Иначе частично-стёртые
 * приватные данные навсегда осели бы под новым владельцем.
 */
export async function reconcileOfflineOwner(
  currentUserId: string | null,
): Promise<void> {
  if (currentUserId === null) return;
  if (getOfflineOwner() === currentUserId) return;
  const wiped = await wipeOfflineData();
  if (wiped) setOfflineOwner(currentUserId);
}
