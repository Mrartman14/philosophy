// src/features/tokens/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Управлять своими PAT (список / создание / отзыв) может любой залогиненный
 * active-пользователь. Отдельной capability на беке НЕТ — токены self-service
 * и жёстко скоупятся к актору на сервере. isMutationAllowed покрывает гостя и
 * suspended/banned (status !== "active").
 */
export function canManageTokens(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
