// src/features/forms/answer-codec.test.ts
import { describe, expect, it } from "vitest";
import {
  encodeAnswerValue,
  decodeAnswerText,
  emptyAnswerValue,
} from "./answer-codec";

describe("encodeAnswerValue", () => {
  it("text → {text}", () => {
    expect(encodeAnswerValue("text", { text: "привет" })).toEqual({ text: "привет" });
  });
  it("long_text → {text}", () => {
    expect(encodeAnswerValue("long_text", { text: "много\nстрок" })).toEqual({
      text: "много\nстрок",
    });
  });
  it("number → {number} как число", () => {
    expect(encodeAnswerValue("number", { number: "42" })).toEqual({ number: 42 });
  });
  it("number нечисло → null (пустой)", () => {
    expect(encodeAnswerValue("number", { number: "abc" })).toBeNull();
  });
  it("date → {date}", () => {
    expect(encodeAnswerValue("date", { date: "2026-07-01" })).toEqual({ date: "2026-07-01" });
  });
  it("single_choice → {option_id}", () => {
    expect(encodeAnswerValue("single_choice", { optionId: "o1" })).toEqual({ option_id: "o1" });
  });
  it("single_choice без выбора → null", () => {
    expect(encodeAnswerValue("single_choice", { optionId: "" })).toBeNull();
  });
  it("multi_choice → {option_ids}", () => {
    expect(encodeAnswerValue("multi_choice", { optionIds: ["a", "b"] })).toEqual({
      option_ids: ["a", "b"],
    });
  });
  it("multi_choice пусто → {option_ids: []}", () => {
    expect(encodeAnswerValue("multi_choice", { optionIds: [] })).toEqual({ option_ids: [] });
  });
});

describe("emptyAnswerValue", () => {
  it("multi_choice → пустой массив", () => {
    expect(emptyAnswerValue("multi_choice")).toEqual({ optionIds: [] });
  });
  it("text → пустая строка", () => {
    expect(emptyAnswerValue("text")).toEqual({ text: "" });
  });
});

describe("decodeAnswerText", () => {
  it("text-ответ → строка", () => {
    expect(decodeAnswerText("text", { text: "x" }, [])).toBe("x");
  });
  it("single_choice → label опции", () => {
    expect(
      decodeAnswerText("single_choice", { option_id: "o1" }, [{ id: "o1", label: "Да" }]),
    ).toBe("Да");
  });
  it("multi_choice → метки через запятую", () => {
    expect(
      decodeAnswerText(
        "multi_choice",
        { option_ids: ["o1", "o2"] },
        [
          { id: "o1", label: "Да" },
          { id: "o2", label: "Нет" },
        ],
      ),
    ).toBe("Да, Нет");
  });
  it("number → строка числа", () => {
    expect(decodeAnswerText("number", { number: 7 }, [])).toBe("7");
  });
  it("неизвестный/битый value → пустая строка", () => {
    expect(decodeAnswerText("text", null, [])).toBe("");
  });
});
