// src/utils/comment-anchor.ts
// Единый источник истины (SOT) DOM-контракта «якорь комментария»: id узла,
// URL-фрагмент deep-link и обратный парсер. Общий для слайсов comments (скролл к
// треду, hash-scroll island) и notifications (deep-link comment.replied), чтобы
// схема `comment-<id>` не дрейфовала между потребителями в разных фичах.
// Guardrail-2 запрещает cross-feature импорт — поэтому контракт живёт в @/utils.
// Чистый модуль (без server-only) — безопасен и на клиенте, и на сервере.

/** Префикс DOM-id узла комментария. Менять схему якоря — ТОЛЬКО здесь. */
const COMMENT_NODE_PREFIX = "comment-";

/** DOM-id узла комментария (стабильный контракт для скролла/deep-link). */
export const commentNodeId = (id: string): string => `${COMMENT_NODE_PREFIX}${id}`;

/** URL-фрагмент deep-link к комментарию: `#comment-<id>`. */
export const commentHash = (id: string): string => `#${commentNodeId(id)}`;

/** Обратный разбор: id коммента из URL-фрагмента; null, если фрагмент не наш или пуст. */
export function commentIdFromHash(hash: string): string | null {
  const prefix = `#${COMMENT_NODE_PREFIX}`;
  if (!hash.startsWith(prefix)) return null;
  return hash.slice(prefix.length) || null;
}
