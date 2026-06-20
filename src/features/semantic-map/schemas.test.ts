import { describe, it, expect } from "vitest";

import { parseMapResponse } from "./schemas";

const ok = {
  layout_version: "v7",
  dims: 3,
  bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  clusters: [{ id: 0, label: "A", color: "#5B8FF9", size: 2 }],
  points: [{ type: "document", id: "x", coords: [0, 0, 0], cluster: 0 }],
};

describe("parseMapResponse", () => {
  it("парсит валидный ответ", () => {
    const r = parseMapResponse(ok);
    expect(r.layout_version).toBe("v7");
    expect(r.points).toHaveLength(1);
  });

  it("игнорирует незнакомые additive-поля", () => {
    const r = parseMapResponse({ ...ok, future_field: 42, points: [{ ...ok.points[0], extra: 1 }] });
    expect(r.points[0]?.id).toBe("x");
  });

  it("пропускает неизвестный type как строку", () => {
    const r = parseMapResponse({ ...ok, points: [{ ...ok.points[0], type: "podcast" }] });
    expect(r.points[0]?.type).toBe("podcast");
  });

  it("отклоняет структурно битый ответ", () => {
    expect(() => parseMapResponse({ dims: 3 })).toThrow();
  });
});
