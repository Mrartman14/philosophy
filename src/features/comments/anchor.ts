// src/features/comments/anchor.ts
// Билдер якоря комментария из движкового TextAnchor. Координаты переиспользуют
// общий конвертер; target-поля (target_entity_type/id) — доменная специфика
// комментария (см. docs/.../2026-06-26-anchored-comments-design.md): комментарий
// висит на lecture_id, anchor указывает на фрагмент под-сущности (v1 — document).
import type { TextAnchor } from "@/components/anchor-engine";
import { engineAnchorToCoords } from "@/utils/text-anchor";

import type { Anchor } from "./types";

/** v1: якорь только на инлайн-документ лекции. */
export function buildCommentTextAnchor(a: TextAnchor, documentId: string): Anchor {
  return {
    target_entity_type: "document",
    target_entity_id: documentId,
    ...engineAnchorToCoords(a),
  };
}
