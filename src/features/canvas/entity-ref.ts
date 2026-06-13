// src/features/canvas/entity-ref.ts
import type { EntityRefView } from "@/components/canvas-render";

/** Сегмент app-роутера для типов с публичной detail-страницей. */
const SEGMENTS: Record<string, string> = {
  document: "documents",
  lecture: "lectures",
  media: "media",
  comment: "comments",
  glossary: "glossary",
  form: "forms",
  canvas: "canvases",
};

/** Человекочитаемые метки (ru) всех 10 типов entity_ref + fallback. */
const LABELS: Record<string, string> = {
  document: "Документ",
  lecture: "Лекция",
  media: "Медиа",
  comment: "Комментарий",
  glossary: "Глоссарий",
  form: "Форма",
  canvas: "Канвас",
  annotation: "Аннотация",
  banner: "Баннер",
  event: "Событие",
};

/**
 * Резолвит ссылку и метку для entity_ref-узла. Типы без публичной страницы
 * (annotation/banner/event) и неизвестные → href=null (плашка без ссылки).
 * Бек НЕ резолвит title цели — поэтому метка = только тип сущности.
 */
export function resolveEntityRefView(entityType: string, entityId: string): EntityRefView {
  const segment = SEGMENTS[entityType];
  const typeLabel = LABELS[entityType] ?? "Объект";
  return {
    href: segment ? `/${segment}/${encodeURIComponent(entityId)}` : null,
    typeLabel,
  };
}
