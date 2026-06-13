import type { MaybeMe } from "./me";
import type { Capability } from "@/api/types";

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
 * Причина, по которой действие недоступно. Используется для выбора UX-паттерна
 * в `<ActionTooltip>` / `<LoginCta>`.
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
  if (!me) throw new ForbiddenError("guest");
  if (me.status !== "active") throw new ForbiddenError("status");
  throw new ForbiddenError("role");
}
