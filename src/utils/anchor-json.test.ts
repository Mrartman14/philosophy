import { describe, expect, it } from "vitest";
import { z } from "zod";

import { anchorJsonField } from "./anchor-json";

const schema = z.object({
  anchor: anchorJsonField({ notObject: "not-object", invalidJson: "bad-json" }),
});

describe("anchorJsonField", () => {
  it("пустая строка → undefined", () => {
    expect(schema.parse({ anchor: "" })).toEqual({ anchor: undefined });
  });

  it("отсутствие → undefined", () => {
    expect(schema.parse({})).toEqual({ anchor: undefined });
  });

  it("валидный JSON-объект → объект", () => {
    expect(schema.parse({ anchor: '{"start_block_id":"b1"}' })).toEqual({
      anchor: { start_block_id: "b1" },
    });
  });

  it("JSON-массив → ошибка not-object", () => {
    const r = schema.safeParse({ anchor: "[1,2]" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("not-object");
  });

  it("битый JSON → ошибка bad-json", () => {
    const r = schema.safeParse({ anchor: "{oops" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("bad-json");
  });
});
