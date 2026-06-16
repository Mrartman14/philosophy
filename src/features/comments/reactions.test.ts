// src/features/comments/reactions.test.ts
import { describe, it, expect } from "vitest";

import {
  axisAllowedForType,
  REACTION_AXES,
  axisLabel,
  axisValueLabel,
  axisValueAriaLabel,
} from "./reactions";
import type { CommentSchema } from "./types";

const schema: CommentSchema = {
  types: ["claim", "question", "offtop"],
  allowed_roots: ["claim", "question"],
  allowed_children: { claim: ["grounds"], question: ["answer"], offtop: [] },
  max_depth: 32,
  allowed_reactions: {
    claim: ["agreement", "quality", "insight"],
    question: ["quality"],
    offtop: [],
  },
  allowed_markdown: ["paragraph"],
};

describe("axisAllowedForType", () => {
  it("claim допускает agreement", () =>
    { expect(axisAllowedForType(schema, "claim", "agreement")).toBe(true); });
  it("question НЕ допускает agreement", () =>
    { expect(axisAllowedForType(schema, "question", "agreement")).toBe(false); });
  it("question допускает quality", () =>
    { expect(axisAllowedForType(schema, "question", "quality")).toBe(true); });
  it("offtop не допускает никаких осей", () =>
    { expect(axisAllowedForType(schema, "offtop", "insight")).toBe(false); });
  it("неизвестный тип → false (без падения)", () =>
    { expect(axisAllowedForType(schema, "summary", "quality")).toBe(false); });
});

describe("REACTION_AXES", () => {
  it("содержит три оси в фиксированном порядке", () =>
    { expect(REACTION_AXES).toEqual(["agreement", "quality", "insight"]); });
});

describe("axisLabel / axisValueLabel", () => {
  it("даёт русские подписи осей", () => {
    expect(axisLabel("agreement")).toBe("Согласие");
    expect(axisLabel("quality")).toBe("Качество");
    expect(axisLabel("insight")).toBe("Инсайт");
  });
  it("insight не имеет минуса", () =>
    { expect(axisValueLabel("insight", -1)).toBeNull(); });
  it("agreement: +1 и -1 имеют подписи", () => {
    expect(axisValueLabel("agreement", 1)).toBe("+");
    expect(axisValueLabel("agreement", -1)).toBe("−");
  });
});

describe("axisValueAriaLabel", () => {
  it("agreement +1 → «согласен»", () =>
    { expect(axisValueAriaLabel("agreement", 1)).toBe("согласен"); });
  it("agreement -1 → «не согласен»", () =>
    { expect(axisValueAriaLabel("agreement", -1)).toBe("не согласен"); });
  it("quality +1 → «высокое качество»", () =>
    { expect(axisValueAriaLabel("quality", 1)).toBe("высокое качество"); });
  it("quality -1 → «низкое качество»", () =>
    { expect(axisValueAriaLabel("quality", -1)).toBe("низкое качество"); });
  it("insight +1 → «отметить как инсайт»", () =>
    { expect(axisValueAriaLabel("insight", 1)).toBe("отметить как инсайт"); });
  it("составной aria-label согласен", () =>
    { expect(`${axisLabel("agreement")}: ${axisValueAriaLabel("agreement", 1)}`).toBe("Согласие: согласен"); });
  it("составной aria-label не согласен", () =>
    { expect(`${axisLabel("agreement")}: ${axisValueAriaLabel("agreement", -1)}`).toBe("Согласие: не согласен"); });
  it("составной aria-label качество высокое", () =>
    { expect(`${axisLabel("quality")}: ${axisValueAriaLabel("quality", 1)}`).toBe("Качество: высокое качество"); });
  it("составной aria-label качество низкое", () =>
    { expect(`${axisLabel("quality")}: ${axisValueAriaLabel("quality", -1)}`).toBe("Качество: низкое качество"); });
  it("составной aria-label инсайт", () =>
    { expect(`${axisLabel("insight")}: ${axisValueAriaLabel("insight", 1)}`).toBe("Инсайт: отметить как инсайт"); });
});
