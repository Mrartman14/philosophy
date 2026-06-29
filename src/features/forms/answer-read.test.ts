import { describe, it, expect } from "vitest";

import { readAnswerValue } from "./answer-read";

describe("readAnswerValue", () => {
  it("text/long_text → kind text", () => {
    expect(readAnswerValue("text", { text: "hi" })).toEqual({ kind: "text", text: "hi" });
    expect(readAnswerValue("long_text", { text: "x" })).toEqual({ kind: "text", text: "x" });
  });
  it("number → kind number", () => {
    expect(readAnswerValue("number", { number: 42 })).toEqual({ kind: "number", number: 42 });
  });
  it("date → kind date", () => {
    expect(readAnswerValue("date", { date: "2026-06-29" })).toEqual({ kind: "date", date: "2026-06-29" });
  });
  it("single_choice → kind single", () => {
    expect(readAnswerValue("single_choice", { option_id: "o1" })).toEqual({ kind: "single", optionId: "o1" });
  });
  it("multi_choice → kind multi", () => {
    expect(readAnswerValue("multi_choice", { option_ids: ["a", "b"] })).toEqual({ kind: "multi", optionIds: ["a", "b"] });
  });
  it("отсутствующее значение → kind empty", () => {
    expect(readAnswerValue("text", undefined)).toEqual({ kind: "empty" });
    expect(readAnswerValue("number", {})).toEqual({ kind: "empty" });
    expect(readAnswerValue("multi_choice", { option_ids: [] })).toEqual({ kind: "empty" });
  });
});
