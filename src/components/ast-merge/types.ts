import type { AstBlock } from "@/components/ast-editor";

export type MergeStatus =
  | "unchanged"
  | "mine-only"
  | "server-only"
  | "conflict"
  | "added-mine"
  | "added-server"
  | "removed-mine"
  | "removed-server"
  | "structural-conflict";

/** Один блок в модели слияния. `base/mine/theirs` — null, если блока нет на
 *  соответствующей стороне. `key` уникален в пределах списка (id или mine-add#N). */
export interface MergeEntry {
  key: string;
  id: string;
  status: MergeStatus;
  base: AstBlock | null;
  mine: AstBlock | null;
  theirs: AstBlock | null;
}

/** Статусы, требующие выбора стороны пользователем (конфликт). Единая точка
 *  истины — чтобы UI и логика не расходились в наборе. */
export const CONFLICT_STATUSES: ReadonlySet<MergeStatus> = new Set([
  "conflict",
  "structural-conflict",
]);

/** true, если статус требует разрешения конфликта (выбора стороны). */
export function isConflict(s: MergeStatus): boolean {
  return CONFLICT_STATUSES.has(s);
}

/** true, если статус — чистое удаление блока одной из сторон. */
export function isRemoved(s: MergeStatus): boolean {
  return s === "removed-mine" || s === "removed-server";
}

/** Для conflict/structural-conflict: какую сторону выбрал пользователь. */
export type MergeChoice = "mine" | "theirs";

/** Map: MergeEntry.key → выбор. Заполнена только для конфликтных записей. */
export type MergeDecisions = Record<string, MergeChoice>;

/** Токен пословного diff: same — без изменений, add — добавлено стороной,
 *  del — было в base и удалено стороной. */
export type DiffToken =
  | { type: "same"; text: string }
  | { type: "add"; text: string }
  | { type: "del"; text: string };
