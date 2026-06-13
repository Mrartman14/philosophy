// src/features/comments/reactions.ts
import type { CommentSchema, CommentType, ReactionAxis } from "./types";

/** Все оси в фиксированном порядке отображения. */
export const REACTION_AXES: ReactionAxis[] = ["agreement", "quality", "insight"];

/**
 * Допустима ли ось `axis` для типа `type` по матрице из GET /api/comments/schema.
 * Источник истины — бек (matrix.go AllowedReactions); UI лишь прячет недоступные
 * кнопки, бек всё равно вернёт 422 AXIS_NOT_ALLOWED при попытке.
 */
export function axisAllowedForType(
  schema: CommentSchema,
  type: CommentType,
  axis: ReactionAxis,
): boolean {
  const allowed = schema.allowed_reactions?.[type];
  return Array.isArray(allowed) && allowed.includes(axis);
}

const AXIS_LABELS: Record<ReactionAxis, string> = {
  agreement: "Согласие",
  quality: "Качество",
  insight: "Инсайт",
};

export function axisLabel(axis: ReactionAxis): string {
  return AXIS_LABELS[axis];
}

/**
 * Подпись значения для оси. insight — только +1 (минуса нет → null).
 * agreement/quality — ±1.
 */
export function axisValueLabel(axis: ReactionAxis, value: number): string | null {
  if (axis === "insight") return value === 1 ? "★" : null;
  return value === 1 ? "+" : value === -1 ? "−" : null;
}
