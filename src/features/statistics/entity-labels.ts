// src/features/statistics/entity-labels.ts
import type { NamespaceT } from "@/i18n";

/**
 * Фабрика человекочитаемых меток типов сущностей для статистики.
 *
 * Не статическая константа: метки берутся из i18n (`t("entityType.*")`),
 * поэтому переводы резолвятся в локали текущего запроса. Лукап по сырому
 * ключу бека (`byType` / `entity_type`); неизвестный тип отдаётся вызывающим
 * кодом как есть (фолбэк `?? type`).
 */
export function entityLabels(
  t: NamespaceT<"statistics">,
): Record<string, string> {
  return {
    lecture: t("entityType.lecture"),
    document: t("entityType.document"),
    trail: t("entityType.trail"),
    canvas: t("entityType.canvas"),
    form: t("entityType.form"),
    media: t("entityType.media"),
    annotation: t("entityType.annotation"),
    comment: t("entityType.comment"),
  };
}
