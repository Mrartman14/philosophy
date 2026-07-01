// src/features/comments/thread-scroll.ts
// DRY-точка для скролла к корневому комментарию в нижнем треде. Узел треда несёт
// id=comment-<id> (см. comment-tree.tsx). `commentNodeId` — ЧИСТАЯ (без
// "use client"): её зовёт и серверный comment-tree.tsx (присвоение id), и хук.
// `useScrollToCommentThread` — клиентский хук: уважает ось appearance motion
// (reduced → behavior:auto), иначе регрессия reduced-motion.
import { useCallback } from "react";

import { useReducedMotion } from "@/components/appearance";
import { commentNodeId } from "@/utils/comment-anchor";

// Ре-экспорт SOT DOM-контракта якоря из @/utils/comment-anchor (единый для
// comments и notifications — Guardrail-2 запрещает cross-feature импорт). Шов
// сохранён: существующие потребители (comment-tree.tsx, hash-scroll island)
// импортируют commentNodeId отсюда.
export { commentNodeId };

/**
 * Хук-фабрика скролла к треду комментария по id. Возвращает стабильный коллбэк
 * (мемоизирован по reduced). reduced-motion → behavior:"auto" (без анимации).
 */
export function useScrollToCommentThread(): (id: string) => void {
  const reduced = useReducedMotion();
  return useCallback(
    (id: string) => {
      document
        .getElementById(commentNodeId(id))
        ?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );
}
