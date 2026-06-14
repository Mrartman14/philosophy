// src/features/comments/comment-tree-utils.ts
// Чистая сборка дерева комментов из плоского списка (изоморфно).
import type { Comment } from "./types";

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
