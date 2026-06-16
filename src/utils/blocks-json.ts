import { z } from "zod";

import type { components } from "@/api/schema";

type AstBlock = components["schemas"]["ast.Block"];

export interface BlocksJsonMessages {
  /** Сообщение при пустой строке (min(1) validation). */
  minLength?: string;
  /** Сообщение при невалидном JSON. */
  invalidJson?: string;
  /** Сообщение если результат парсинга не является массивом. */
  notArray?: string;
  /** Сообщение если массив пустой (только при allowEmpty: false). */
  empty?: string;
}

export interface BlocksJsonOptions {
  /**
   * Если true — пустой массив [] валиден (banners, events, glossary).
   * Если false (по умолчанию) — пустой массив отклоняется (documents,
   * comments, annotations).
   */
  allowEmpty?: boolean;
  messages?: BlocksJsonMessages;
}

/**
 * Фабрика Zod-поля для скрытых JSON-полей форм с AST-блоками.
 *
 * Парсит JSON-строку → assert Array.isArray → (при allowEmpty: false) assert
 * length > 0 → возвращает AstBlock[].
 *
 * ⚠️ Не передаём явный path в addIssue: Zod 4 автоматически скопирует issue
 * на поле-потребитель (field-level transform). Хардкод path: ['blocks'] сломает
 * слайсы, которые переиспользуют поле под другим ключом.
 */
export function blocksJsonField(
  opts?: BlocksJsonOptions,
): z.ZodType<AstBlock[]> {
  const allowEmpty = opts?.allowEmpty ?? false;
  const msgs = opts?.messages ?? {};

  return z
    .string()
    .min(1, msgs.minLength ?? "Тело не может быть пустым")
    .transform((s, ctx): AstBlock[] => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(s);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: msgs.invalidJson ?? "Битый JSON в теле",
        });
        return z.NEVER;
      }
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: "custom",
          message: msgs.notArray ?? "Тело должно быть массивом блоков",
        });
        return z.NEVER;
      }
      if (!allowEmpty && parsed.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: msgs.empty ?? "Добавьте хотя бы один блок",
        });
        return z.NEVER;
      }
      return parsed as AstBlock[];
    });
}
