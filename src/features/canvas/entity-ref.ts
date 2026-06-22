// src/features/canvas/entity-ref.ts
import type { EntityRefView } from "@/components/canvas-render";

/** Сегмент app-роутера для типов с публичной detail-страницей. */
const SEGMENTS: Record<string, string> = {
  document: "documents",
  media: "media",
  comment: "comments",
  glossary: "glossary",
  form: "forms",
  canvas: "canvases",
};

/**
 * Человекочитаемые метки (ru) всех 9 типов entity_ref + fallback. ru-дефолт
 * для изоморфного/офлайн-вызова без переводчика; онлайн-вызыватели передают метки
 * из каталога canvas.entityType.* (см. makeEntityRefResolver / резолверы ниже).
 */
const LABELS: Record<string, string> = {
  document: "Документ",
  media: "Медиа",
  comment: "Комментарий",
  glossary: "Глоссарий",
  form: "Форма",
  canvas: "Канвас",
  annotation: "Аннотация",
  banner: "Баннер",
  event: "Событие",
};

const FALLBACK_LABEL = "Объект";

/**
 * Резолвер метки типа сущности: тип → человекочитаемая метка. ru-дефолт читает
 * статичный LABELS; онлайн-вызыватель строит его из переводчика canvas.entityType.*
 * (через makeEntityRefResolver). Изоморфно — не тянет next-intl, безопасно офлайн.
 */
export type EntityTypeLabeler = (entityType: string) => string;

const defaultLabeler: EntityTypeLabeler = (entityType) =>
  LABELS[entityType] ?? FALLBACK_LABEL;

/**
 * Резолвит ссылку и метку для entity_ref-узла. Типы без публичной страницы
 * (annotation/banner/event) и неизвестные → href=null (плашка без ссылки).
 * Бек НЕ резолвит title цели — поэтому метка = только тип сущности.
 *
 * `labelFor` опционален: дефолт — ru-литералы (изоморфно/офлайн). Онлайн-контекст
 * передаёт локализованный лейблер (см. makeEntityRefResolver).
 */
export function resolveEntityRefView(
  entityType: string,
  entityId: string,
  labelFor: EntityTypeLabeler = defaultLabeler,
): EntityRefView {
  const segment = SEGMENTS[entityType];
  return {
    href: segment ? `/${segment}/${encodeURIComponent(entityId)}` : null,
    typeLabel: labelFor(entityType),
  };
}

const ENTITY_TYPES = [
  "document",
  "media",
  "comment",
  "glossary",
  "form",
  "canvas",
  "annotation",
  "banner",
  "event",
] as const;

/** Точный union ключей entityType.* (тип + fallback), которые читает резолвер. */
type EntityTypeKey = `entityType.${(typeof ENTITY_TYPES)[number] | "fallback"}`;

/**
 * Минимальный структурный тип переводчика namespace "canvas", достаточный для
 * резолва ключей entityType.*. Совместим и с getT("canvas") (server), и с
 * useT("canvas") (client) — обе формы суть (key) => string. Не импортирует
 * server-only NamespaceT, чтобы модуль оставался изоморфным. Параметр — ТОЧНЫЙ
 * union читаемых ключей (контравариантно совместим с union ключей каталога).
 */
export type CanvasEntityTypeT = (key: EntityTypeKey) => string;

/**
 * Строит локализованный EntityRefResolver из переводчика canvas (getT/useT).
 * Сигнатура результата совпадает с frozen EntityRefResolver
 * `(entityType, entityId) => EntityRefView` — frozen CanvasRender не трогаем,
 * локализация инъектируется в РЕЗОЛВЕР, который пропом передаётся в CanvasRender.
 */
export function makeEntityRefResolver(
  t: CanvasEntityTypeT,
): (entityType: string, entityId: string) => EntityRefView {
  const labels: Record<string, string> = {};
  for (const type of ENTITY_TYPES) labels[type] = t(`entityType.${type}`);
  const fallback = t("entityType.fallback");
  const labelFor: EntityTypeLabeler = (entityType) => labels[entityType] ?? fallback;
  return (entityType, entityId) =>
    resolveEntityRefView(entityType, entityId, labelFor);
}
