// src/utils/anchor-json.ts
// Общий zod-field: hidden-input формы несёт JSON-строку якоря; парсим в объект
// или undefined (пустая строка / отсутствие). Структурную валидность под
// сущность проверяет бэк (422 ANCHOR_INVALID). Сообщения параметризованы, чтобы
// каждая фича подставила свой i18n-namespace (annotations / comments).
import { z } from "zod";

export function anchorJsonField(messages: {
  notObject: string;
  invalidJson: string;
}) {
  return z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s || s.trim() === "") return undefined;
      try {
        const parsed: unknown = JSON.parse(s);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          ctx.addIssue({ code: "custom", message: messages.notObject });
          return z.NEVER;
        }
        return parsed as Record<string, unknown>;
      } catch {
        ctx.addIssue({ code: "custom", message: messages.invalidJson });
        return z.NEVER;
      }
    });
}
