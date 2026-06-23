/**
 * Namespace-aware mock-фабрика клиентского i18n-фасада `@/i18n/client` для юнит-тестов.
 *
 * Резолвит dotted-ключи из РЕАЛЬНЫХ ru-каталогов соответствующего namespace
 * (на промах возвращает сам ключ), без поднятия next-intl-провайдера. Нужна там,
 * где тест монтирует kit-компонент, тянущий `useT` внутри (например `FormField` →
 * `useT("common")` для локализации native `required`-сообщения).
 *
 * Использование в начале тест-файла:
 *   vi.mock("@/i18n/client", async () =>
 *     (await import("@/test/i18n-client-mock")).i18nClientMock());
 */
import ru from "@/i18n/messages/ru";

type Catalog = (typeof ru)[keyof typeof ru];

function resolve(catalog: Catalog, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
      catalog,
    );
  return typeof value === "string" ? value : key;
}

export function i18nClientMock() {
  const useT = (ns: keyof typeof ru) => {
    const catalog = ru[ns];
    return (key: string, params?: Record<string, string | number>): string => {
      const template = resolve(catalog, key);
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (_, k: string) =>
        k in params ? String(params[k]) : `{${k}}`,
      );
    };
  };
  return { useT };
}
