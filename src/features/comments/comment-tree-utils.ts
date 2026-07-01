// src/features/comments/comment-tree-utils.ts
// Чистая сборка дерева комментов из плоского списка (изоморфно).
import type { Comment, RootSubtree } from "./types";

/** map parent_id (или null для корней) → упорядоченный список детей. */
export function groupByParent(nodes: Comment[]): Map<string | null, Comment[]> {
  const map = new Map<string | null, Comment[]>();
  for (const n of nodes) {
    const key = n.parent_id ?? null;
    const arr = map.get(key) ?? [];
    arr.push(n);
    map.set(key, arr);
  }
  return map;
}

/**
 * Препенд deep-link треда (переход из инбокса к ответу) в начало ленты.
 * Дедуп по root.id: если корневой тред уже на первой странице — не дублируем и
 * не двигаем. null / focus без root → лента без изменений (та же ссылка).
 */
export function prependFocusThread(
  subtrees: RootSubtree[],
  focus: RootSubtree | null,
): RootSubtree[] {
  if (!focus?.root?.id) return subtrees;
  const focusRootId = focus.root.id;
  if (subtrees.some((st) => st.root?.id === focusRootId)) return subtrees;
  return [focus, ...subtrees];
}
