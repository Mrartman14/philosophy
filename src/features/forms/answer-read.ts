// src/features/forms/answer-read.ts
import type { AnswerValue, FieldType } from "./types";

export type ReadValue =
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "date"; date: string }
  | { kind: "single"; optionId: string }
  | { kind: "multi"; optionIds: string[] }
  | { kind: "empty" };

/** Сужает opaque AnswerValue к варианту по типу поля. Пустое/несоответствующее → empty. */
export function readAnswerValue(type: FieldType, value: AnswerValue | undefined): ReadValue {
  const v = value ?? {};
  switch (type) {
    case "text":
    case "long_text":
      return v.text ? { kind: "text", text: v.text } : { kind: "empty" };
    case "number":
      return typeof v.number === "number" ? { kind: "number", number: v.number } : { kind: "empty" };
    case "date":
      return v.date ? { kind: "date", date: v.date } : { kind: "empty" };
    case "single_choice":
      return v.option_id ? { kind: "single", optionId: v.option_id } : { kind: "empty" };
    case "multi_choice":
      return v.option_ids && v.option_ids.length > 0
        ? { kind: "multi", optionIds: v.option_ids }
        : { kind: "empty" };
    default:
      return { kind: "empty" };
  }
}
