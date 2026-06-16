// src/utils/blocks-json.test.ts
import { describe, expect, it } from "vitest";

import { blocksJsonField } from "./blocks-json";

const VALID_BLOCK = { type: "paragraph", content: [], id: "abc" };
const validJson = JSON.stringify([VALID_BLOCK]);
const emptyArrayJson = "[]";
const notArrayJson = JSON.stringify({ type: "paragraph" });
const badJson = "{not json";

describe("blocksJsonField — allowEmpty: false (умолчание)", () => {
  const schema = blocksJsonField();

  it("принимает непустой массив блоков", () => {
    const r = schema.safeParse(validJson);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Array.isArray(r.data)).toBe(true);
      expect(r.data).toHaveLength(1);
    }
  });

  it("отклоняет пустой массив", () => {
    const r = schema.safeParse(emptyArrayJson);
    expect(r.success).toBe(false);
  });

  it("отклоняет не-массив (объект)", () => {
    const r = schema.safeParse(notArrayJson);
    expect(r.success).toBe(false);
  });

  it("отклоняет битый JSON", () => {
    const r = schema.safeParse(badJson);
    expect(r.success).toBe(false);
  });

  it("отклоняет пустую строку (min 1)", () => {
    const r = schema.safeParse("");
    expect(r.success).toBe(false);
  });
});

describe("blocksJsonField — allowEmpty: true", () => {
  const schema = blocksJsonField({ allowEmpty: true });

  it("принимает непустой массив", () => {
    const r = schema.safeParse(validJson);
    expect(r.success).toBe(true);
  });

  it("принимает пустой массив", () => {
    const r = schema.safeParse(emptyArrayJson);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toHaveLength(0);
  });

  it("отклоняет не-массив", () => {
    const r = schema.safeParse(notArrayJson);
    expect(r.success).toBe(false);
  });

  it("отклоняет битый JSON", () => {
    const r = schema.safeParse(badJson);
    expect(r.success).toBe(false);
  });
});

describe("blocksJsonField — кастомные сообщения", () => {
  const schema = blocksJsonField({
    allowEmpty: false,
    messages: {
      minLength: "МИН",
      invalidJson: "БИТЫЙ",
      notArray: "НЕ МАССИВ",
      empty: "ПУСТОЙ",
    },
  });

  it("кастомное сообщение invalidJson", () => {
    const r = schema.safeParse(badJson);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("БИТЫЙ");
    }
  });

  it("кастомное сообщение notArray", () => {
    const r = schema.safeParse(notArrayJson);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("НЕ МАССИВ");
    }
  });

  it("кастомное сообщение empty", () => {
    const r = schema.safeParse(emptyArrayJson);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("ПУСТОЙ");
    }
  });

  it("кастомное сообщение minLength", () => {
    const r = schema.safeParse("");
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("МИН");
    }
  });
});
