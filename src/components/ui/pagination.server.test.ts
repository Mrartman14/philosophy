// src/components/ui/pagination.server.test.ts
// Регрессия на «common.pagination.range протекал в UI»: шаблон диапазона несёт
// ICU-плейсхолдеры {from}/{to}/{total}. В next-intl (use-intl) обычный t(...)
// ПЫТАЕТСЯ отформатировать ICU-сообщение и без значений падает в
// FORMATTING_ERROR, возвращая ключ-фоллбек `common.pagination.range` (это и
// текло в тулбар пагинации). getPaginationLabels ОБЯЗАН брать range через
// t.raw(...). Мок @/i18n ниже воспроизводит это поведение поверх НАСТОЯЩЕГО
// ru-каталога (поведение t()/t.raw() сверено с use-intl core: format-and-catch
// → getMessageFallback). Откат на t(...) уронит первый кейс.
import { describe, expect, it, vi } from "vitest";

import ru from "@/i18n/messages/ru";

vi.mock("@/i18n", () => {
  const common = ru.common as Record<string, unknown>;
  const resolve = (key: string): unknown =>
    key.split(".").reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      common,
    );
  const t = (key: string): string => {
    const v = resolve(key);
    // ICU-плейсхолдеры без значений → next-intl возвращает ключ-фоллбек.
    if (typeof v === "string" && /\{[a-z]+\}/i.test(v)) return `common.${key}`;
    return String(v);
  };
  t.raw = (key: string): unknown => resolve(key); // без ICU-форматирования
  return { getT: () => Promise.resolve(t) };
});

describe("getPaginationLabels", () => {
  it("range приходит ICU-шаблоном с плейсхолдерами, а не ключом", async () => {
    const { getPaginationLabels } = await import("./pagination.server");
    const labels = await getPaginationLabels();

    expect(labels.range).toContain("{from}");
    expect(labels.range).toContain("{to}");
    expect(labels.range).toContain("{total}");
    expect(labels.range).not.toContain("pagination.range");
  });

  it("остальные подписи резолвятся в человекочитаемый ru-текст", async () => {
    const { getPaginationLabels } = await import("./pagination.server");
    const labels = await getPaginationLabels();

    expect(labels.prev).toBe("Назад");
    expect(labels.next).toBe("Вперёд");
    expect(labels.rangeEmpty).toBe("0 из 0");
    expect(labels.ariaLabel).toBe("Пагинация");
  });
});
