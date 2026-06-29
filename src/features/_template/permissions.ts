// src/features/_template/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
// import { can } from "@/utils/permissions";

/**
 * Доменные permission-хелперы. Каждая функция возвращает boolean.
 * Status-чек уже включён в can() — не дублируйте.
 *
 * Owner-aware-проверки делаются здесь, например:
 *   export function canDeleteX(me: MaybeMe, x: { owner?: { id?: string } }): boolean {
 *     if (!me) return false;
 *     if (x.owner?.id === me.id) return can(me, "x.delete_own");
 *     return can(me, "x.delete_any");
 *   }
 *
 * Идентичность владельца/автора — единый userref.Ref { id?, username? } (поле
 * owner/author/actor), читается как x.owner?.id; в UI — <UserView user={x.owner} />.
 */

export function canPlaceholder(me: MaybeMe): boolean {
  void me; // template placeholder — real implementations use me for capability checks
  return false;
}
