// src/features/notifications/notification-content.ts
// Чистый client-safe рендерер уведомлений. Без server-зависимостей.
import type { AppNotification } from "./types";

export interface RenderedNotification {
  text: string;
  /** Куда вести по клику; null — некуда (рендерим без ссылки). */
  href: string | null;
}

/** Fallback-ссылка на сущность по target_type. */
function entityHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetId) return null;
  switch (targetType) {
    case "document":
      return `/documents/${targetId}`;
    case "lecture":
      return `/lectures/${targetId}`;
    case "annotation":
      return "/me/annotations"; // detail-страницы аннотации нет — ведём в список
    default:
      return null;
  }
}

/**
 * Provisional-реестр известных типов → текст.
 * TODO(backend-ask): сверить значения `type` с philosophy-api; пока значения —
 * правдоподобная заглушка, неизвестные типы деградируют через fallback ниже.
 */
const TEMPLATES: Record<string, (n: AppNotification) => string> = {
  "document.updated": () => "Документ, на который вы подписаны, обновлён",
  "comment.created": (n) =>
    n.groupCount > 1 ? `Новые комментарии (${n.groupCount})` : "Новый комментарий",
  "comment.reply": () => "Ответ на ваш комментарий",
  "annotation.created": () => "Новая аннотация",
  mention: () => "Вас упомянули",
};

export function renderNotification(n: AppNotification): RenderedNotification {
  const template = TEMPLATES[n.type];
  if (template) {
    return { text: template(n), href: entityHref(n.targetType, n.targetId) };
  }
  // fallback: текст из reason (или нейтральный) + суффикс группировки.
  const base = n.reason || "Новое уведомление";
  const text = n.groupCount > 1 ? `${base} (${n.groupCount})` : base;
  return { text, href: entityHref(n.targetType, n.targetId) };
}
