// src/features/_template/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
// import { can } from "@/utils/permissions";

/**
 * Доменные permission-хелперы. Каждая функция возвращает boolean.
 * Status-чек уже включён в can() — не дублируйте.
 *
 * Owner-aware-проверки делаются здесь, например:
 *   export function canDeleteX(me: MaybeMe, x: { user_id: string }): boolean {
 *     if (!me) return false;
 *     if (x.user_id === me.id) return can(me, "x.delete_own");
 *     return can(me, "x.delete_any");
 *   }
 */

export function canPlaceholder(_me: MaybeMe): boolean {
  return false;
}
