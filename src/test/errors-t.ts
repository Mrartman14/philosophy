/**
 * Test factory for an `ErrorsT` translator (namespace "errors").
 *
 * Резолвит ключи из РЕАЛЬНОГО ru-каталога `errors` с подстановкой `{var}`-плейсхолдеров,
 * так что юнит-тесты branded-seam (action-message / action-toast) проверяют реальный
 * ru-текст без поднятия next-intl провайдера.
 */
import type { ErrorsT } from "@/i18n/client";
import errors from "@/i18n/messages/ru/errors";

type ErrorKey = keyof typeof errors;

export function makeErrorsT(): ErrorsT {
  const t = (key: ErrorKey, params?: Record<string, string | number>): string => {
    const template = errors[key];
    if (typeof template !== "string") return key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k: string) =>
      k in params ? String(params[k]) : `{${k}}`,
    );
  };
  return t as unknown as ErrorsT;
}
