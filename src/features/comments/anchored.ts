// src/features/comments/anchored.ts
// Pure-выборка заякоренных корней под текущий документ. Заякоренный комментарий
// в v1 — корень треда (anchor на root). Фильтр: target=document текущего дока +
// валидный text-range (movement-якорь резолвится). replyCount = число потомков.
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import type { Anchor, Comment, RootSubtree } from "./types";

export interface AnchoredRoot {
  id: string;
  anchor: Anchor;
  root: Comment;
  replyCount: number;
}

export function selectAnchoredRoots(subtrees: RootSubtree[], documentId: string): AnchoredRoot[] {
  const out: AnchoredRoot[] = [];
  for (const st of subtrees) {
    const root = st.root;
    const anchor = root?.anchor;
    if (!root?.id || !anchor) continue;
    if (root.is_deleted) continue; // удалённый корень → пустое тело, не показываем превью
    if (anchor.target_entity_type !== "document" || anchor.target_entity_id !== documentId) continue;
    if (coordsToEngineAnchor(anchor) === null) continue; // не text-range / неполный
    out.push({
      id: root.id,
      anchor,
      root,
      replyCount: (st.descendants ?? []).length,
    });
  }
  return out;
}
// ВНИМАНИЕ (осознанный YAGNI v1): берём anchor ТОЛЬКО с корня треда. Бэк
// допускает anchor на любом comment (descendants[].anchor) — такие заякоренные
// ответы read-путём здесь НЕ подсвечиваются (живут только в нижнем треде). См.
// бэк-аск в Task 12 (инвариант anchor-only-on-root).
