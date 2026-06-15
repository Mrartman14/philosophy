// src/services/offline/offline-identity-guard.tsx
"use client";
import { useEffect, useState } from "react";

import { closeIdentityGate, openIdentityGate } from "./identity-gate";
import { reconcileOfflineOwner } from "./owner";

interface OfflineIdentityGuardProps {
  /** id текущего пользователя из getMe() (server), либо null для гостя. */
  userId: string | null;
}

const UNSET = Symbol("unset");
type SeenUserId = string | null | typeof UNSET;

/**
 * Невидимый страж: на каждой загрузке сверяет владельца офлайн-кеша с текущим
 * пользователем. При входе ДРУГОГО аккаунта чистит приватные офлайн-данные
 * предыдущего — закрывает утечку при пассивном логауте (протухание/отзыв
 * токена), когда явный `logoutAction` не вызывался. Монтируется в root layout.
 *
 * Дополнительно держит барьер офлайн-чтений (identity-gate): закрывает его в
 * РЕНДЕРЕ при смене userId и открывает после сверки, чтобы read-эффекты
 * офлайн-страниц (`/saved`) не успели показать данные прежнего владельца до
 * зачистки. Рендер-фаза идёт целиком до эффектов, поэтому закрытие в рендере
 * опережает read-эффекты потомков (их эффекты выполняются раньше нашего).
 */
export function OfflineIdentityGuard({ userId }: OfflineIdentityGuardProps) {
  // Закрываем барьер чтений при СМЕНЕ userId прямо в рендере: рендер-фаза идёт
  // целиком до эффектов, иначе read-эффекты потомков (выполняясь раньше нашего
  // эффекта-предка) успели бы показать данные прежнего владельца. Сравнение с
  // предыдущим значением — паттерн «корректировка состояния в рендере» (react.dev).
  const [seenUserId, setSeenUserId] = useState<SeenUserId>(UNSET);
  if (seenUserId !== userId) {
    setSeenUserId(userId);
    closeIdentityGate();
  }

  useEffect(() => {
    void reconcileOfflineOwner(userId).finally(openIdentityGate);
  }, [userId]);

  return null;
}
