// src/services/offline/offline-identity-guard.tsx
"use client";
import { useEffect } from "react";

import { reconcileOfflineOwner } from "./owner";

interface OfflineIdentityGuardProps {
  /** id текущего пользователя из getMe() (server), либо null для гостя. */
  userId: string | null;
}

/**
 * Невидимый страж: на каждой загрузке сверяет владельца офлайн-кеша с текущим
 * пользователем. При входе ДРУГОГО аккаунта чистит приватные офлайн-данные
 * предыдущего — закрывает утечку при пассивном логауте (протухание/отзыв
 * токена), когда явный `logoutAction` не вызывался. Монтируется в root layout.
 */
export function OfflineIdentityGuard({ userId }: OfflineIdentityGuardProps) {
  useEffect(() => {
    void reconcileOfflineOwner(userId);
  }, [userId]);
  return null;
}
