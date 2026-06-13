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

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Короткий текст",
  long_text: "Длинный текст",
  single_choice: "Один из вариантов",
  multi_choice: "Несколько вариантов",
  number: "Число",
  date: "Дата",
};

/** Готовые опции для <Select> / <select> конструктора. */
export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] =
  FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }));

/** Choice-типы требуют непустой options (бек: FieldType.HasOptions). */
export function fieldTypeHasOptions(t: FieldType): boolean {
  return t === "single_choice" || t === "multi_choice";
}

/** Type guard: строка — валидный FieldType. */
export function isFieldType(v: string): v is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(v);
}
