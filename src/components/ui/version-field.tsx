"use client";
// src/components/ui/version-field.tsx
interface Props {
  /**
   * Текущая версия сущности для optimistic concurrency (If-Match / 412).
   * `undefined` → пустое значение (создание / версия ещё не известна).
   */
  version: number | undefined;
}

/**
 * Скрытое поле версии сущности для мутирующей формы. Бэк сверяет его при записи
 * и при расхождении отвечает 412 (см. AST-conflict merge). Поместить ВНУТРЬ
 * `<Form>` рядом с прочими hidden-полями. Унифицирует прежний разнобой
 * `String(x.version ?? "")` vs `x.version ?? ""`.
 */
export function VersionField({ version }: Props) {
  return <input type="hidden" name="version" value={version ?? ""} readOnly />;
}
