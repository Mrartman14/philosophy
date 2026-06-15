// src/services/offline/owner.ts
// Browser-only: маркер «владельца» офлайн-кеша (localStorage) + сверка личности.
import { wipeOfflineData } from "./wipe";

export const OFFLINE_OWNER_KEY = "flbz-offline-owner";

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
 */
export async function reconcileOfflineOwner(
  currentUserId: string | null,
): Promise<void> {
  if (currentUserId === null) return;
  if (getOfflineOwner() === currentUserId) return;
  await wipeOfflineData();
  setOfflineOwner(currentUserId);
}
