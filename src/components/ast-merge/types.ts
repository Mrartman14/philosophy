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
