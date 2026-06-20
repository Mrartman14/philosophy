import type { Capability } from "@/api/types";
import { metrics, M } from "@/services/observability";

import type { MaybeMe } from "./me";

/**
 * Реестр capability фронта — ре-экспорт сгенерированного `rbac.Capability`
 * (источник истины: бэк philosophy-api `internal/rbac/capabilities.go`).
 * Узкий union ловит опечатки и дрейф в `tsc`. НЕ редактировать руками —
 * после изменения RBAC на бэке прогнать `npm run generate:api`.
 *
 * Ownership-проверки («свой ли это комментарий») сюда не входят — они живут в
 * доменных хелперах `src/features/{name}/permissions.ts`. Status-гейт
 * (`active` vs `suspended/banned`) — глобальный, в `can()` ниже.
 */
export type { Capability };

/**
 * Базовый capability-чек. Гость и не-active пользователь — всегда `false`.
 */
export function can(me: MaybeMe, cap: Capability): boolean {
  if (!me) return false;
  if (me.status !== "active") return false;
  return me.capabilities.includes(cap);
}

/**
 * Глобальный гейт «может ли пользователь вообще что-то мутировать».
 *
 * Используется в доменных хелперах для тех действий, которые доступны всем
 * залогиненным active-юзерам без специфической capability (пример: оставить
 * комментарий, поставить лайк, создать аннотацию).
 */
export function isMutationAllowed(me: MaybeMe): me is NonNullable<MaybeMe> {
  return me !== null && me.status === "active";
}

/**
 * Owner-aware предикат для доменных `canDeleteX` / `canEditX`: пользователь
 * active И (владелец ресурса ИЛИ есть `cap` и выполнен доп. предикат `extra`).
 *
 * `ownerId` передаётся ЗНАЧЕНИЕМ (`resource.owner_id` / `resource.user_id`) —
 * слайс сам решает, какое поле сравнивать, а тип ловит ошибку. `extra` —
 * доп. условие для cap-ветки (напр. `() => doc.visibility === "public"`).
 *
 * @example
 *   canDeleteDocument: ownerOrCap(me, doc.owner_id, "document.delete_any",
 *     () => doc.visibility === "public")
 */
export function ownerOrCap(
  me: MaybeMe,
  ownerId: string | undefined,
  cap: Capability,
  extra?: () => boolean,
): boolean {
  if (!isMutationAllowed(me)) return false;
  if (ownerId !== undefined && ownerId === me.id) return true;
  if (!can(me, cap)) return false;
  return extra ? extra() : true;
}

/**
 * Причина, по которой действие недоступно. Используется для выбора UX-паттерна
 * отказа в UI.
 *
 * - `guest`  — пользователь не залогинен.
 * - `role`   — не хватает capability по роли.
 * - `owner`  — не владелец ресурса (и не привилегированный модератор).
 * - `status` — пользователь suspended/banned.
 */
export type DenyReason = "guest" | "role" | "owner" | "status";

/**
 * Бросается из server actions, когда права не сошлись. Ловится в
 * `createAction` / `createFormAction`, превращается в
 * `ActionResult { success: false, code: "forbidden", error }`.
 */
export class ForbiddenError extends Error {
  readonly code = "forbidden" as const;
  constructor(public readonly reason: DenyReason, message?: string) {
    super(message ?? `Forbidden: ${reason}`);
    this.name = "ForbiddenError";
  }
}

/**
 * Бросается, когда бэк сообщил, что аккаунт ЗАБАНЕН (код `BANNED`). В отличие
 * от `ForbiddenError` (отказ в праве) это сигнал форс-логаута: ловится в
 * `createAction`/`createFormAction` и приводит к `redirect("/auth/forced-logout")`,
 * а не к `{ code: "forbidden" }`. `suspended` сюда НЕ относится — он остаётся
 * `ForbiddenError("status")`.
 */
export class BannedError extends Error {
  readonly code = "banned" as const;
  constructor(message = "Account banned") {
    super(message);
    this.name = "BannedError";
  }
}

/**
 * Хелпер для server actions: проверяет предикат `check(me)` и бросает
 * `ForbiddenError` с правильно вычисленным `DenyReason`. Используется в
 * `src/features/{name}/actions.ts` для defense-in-depth, чтобы не повторять
 * один и тот же if/throw блок в каждом action.
 *
 * После успешного вызова TypeScript сужает тип `me` до `NonNullable<MaybeMe>`
 * через `asserts`-сигнатуру.
 *
 * @example
 *   const me = await getMe();
 *   requireCapability(me, canDeleteLecture);
 *   // дальше — обычная логика action'а; me здесь уже Me, не MaybeMe
 */
export function requireCapability(
  me: MaybeMe,
  check: (me: MaybeMe) => boolean
): asserts me is NonNullable<MaybeMe> {
  if (check(me)) return;
  const reason = !me ? "guest" : me.status !== "active" ? "status" : "role";
  metrics.increment(M.rbacDenied, { reason });
  throw new ForbiddenError(reason);
}

/**
 * Гейт «нужен залогиненный active-пользователь, права решает бек». Бросает
 * `ForbiddenError("guest" | "status")`. Используется в server actions, где
 * специфической capability нет (создать комментарий, лайк, owner-only мутации
 * с проверкой владения на беке). Эквивалент `requireCapability(me,
 * isMutationAllowed)`, но читается как намерение и сужает тип `me` через
 * `asserts`.
 */
export function requireActive(
  me: MaybeMe
): asserts me is NonNullable<MaybeMe> {
  if (me?.status === "active") return;
  const reason = !me ? "guest" : "status";
  metrics.increment(M.rbacDenied, { reason });
  throw new ForbiddenError(reason);
}
