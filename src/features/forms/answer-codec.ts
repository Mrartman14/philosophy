// src/features/forms/answer-codec.ts
import type { FieldType, FieldOption } from "./types";

/** Промежуточная (UI-side) форма значения по типу поля. */
export type AnswerInput =
  | { text: string }
  | { number: string }
  | { date: string }
  | { optionId: string }
  | { optionIds: string[] };

/** Шейп value, который понимает бек (validate.go validateAnswerValue). */
export type AnswerWire = Record<string, unknown>;

/** Пустое UI-значение по типу — стартовое состояние контрола. */
export function emptyAnswerValue(type: FieldType): AnswerInput {
  switch (type) {
    case "text":
    case "long_text":
      return { text: "" };
    case "number":
      return { number: "" };
    case "date":
      return { date: "" };
    case "single_choice":
      return { optionId: "" };
    case "multi_choice":
      return { optionIds: [] };
  }
}

/**
 * Кодирует UI-значение в wire-форму бека. Возвращает null, если значение
 * «пустое» (поле без ответа) — вызывающий пропускает такие ответы для
 * необязательных полей и помечает ошибку для обязательных.
 */
export function encodeAnswerValue(type: FieldType, v: AnswerInput): AnswerWire | null {
  switch (type) {
    case "text":
    case "long_text": {
      const text = "text" in v ? v.text : "";
      return text.trim() === "" ? null : { text };
    }
    case "number": {
      const raw = "number" in v ? v.number : "";
      if (raw.trim() === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? { number: n } : null;
    }
    case "date": {
      const date = "date" in v ? v.date : "";
      return date.trim() === "" ? null : { date };
    }
    case "single_choice": {
      const optionId = "optionId" in v ? v.optionId : "";
      return optionId === "" ? null : { option_id: optionId };
    }
    case "multi_choice": {
      const optionIds = "optionIds" in v ? v.optionIds : [];
      // Бек принимает {option_ids: []} (required → ошибка ловится на беке);
      // здесь возвращаем массив всегда, чтобы поле присутствовало.
      return { option_ids: optionIds };
    }
  }
}

/** Декодирует wire-value отклика в человекочитаемый текст для просмотра. */
export function decodeAnswerText(
  type: FieldType,
  value: unknown,
  options: FieldOption[],
): string {
  if (value === null || typeof value !== "object") return "";
  const v = value as Record<string, unknown>;
  const labelOf = (id: unknown): string =>
    options.find((o) => o.id === id)?.label ?? (typeof id === "string" || typeof id === "number" ? String(id) : "");
  switch (type) {
    case "text":
    case "long_text":
      return typeof v.text === "string" ? v.text : "";
    case "number":
      return typeof v.number === "number" ? String(v.number) : "";
    case "date":
      return typeof v.date === "string" ? v.date : "";
    case "single_choice":
      return labelOf(v.option_id);
    case "multi_choice":
      return Array.isArray(v.option_ids) ? v.option_ids.map(labelOf).join(", ") : "";
  }
}
