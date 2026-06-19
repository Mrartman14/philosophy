// src/features/forms/field-kinds.ts
import type { FieldType } from "./types";

/** Порядок типов полей соответствует internal/form/model.go (FieldType consts). */
export const FIELD_TYPES = [
  "text",
  "long_text",
  "single_choice",
  "multi_choice",
  "number",
  "date",
] as const satisfies readonly FieldType[];

/** Возвращает опции для <select> конструктора с локализованными метками.
 * Передай t = useT("forms") из клиентского компонента. */
export function makeFieldTypeOptions(
  t: (key: string) => string,
): { value: FieldType; label: string }[] {
  return FIELD_TYPES.map((type) => ({
    value: type,
    label: t(`fieldType.${type}`),
  }));
}

/** Choice-типы требуют непустой options (бек: FieldType.HasOptions). */
export function fieldTypeHasOptions(t: FieldType): boolean {
  return t === "single_choice" || t === "multi_choice";
}

/** Type guard: строка — валидный FieldType. */
export function isFieldType(v: string): v is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(v);
}
