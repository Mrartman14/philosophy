// src/components/anchor-engine/connector-geometry.test.ts
import { describe, expect, it } from "vitest";

import { cardAttachY, connectorPath } from "./connector-geometry";

describe("connectorPath", () => {
  it("правая сторона (карточка правее текста): вертикаль у края текста", () => {
    expect(connectorPath({ x1: 100, y1: 50, x2: 300, y2: 200 })).toBe(
      "M 100 50 L 112 50 L 112 200 L 300 200",
    );
  });

  it("левая сторона (карточка левее текста): ус идёт влево", () => {
    expect(connectorPath({ x1: 300, y1: 50, x2: 100, y2: 200 })).toBe(
      "M 300 50 L 288 50 L 288 200 L 100 200",
    );
  });

  it("узкий жёлоб: stub зажимается до ширины жёлоба (vx не выходит за карточку)", () => {
    expect(connectorPath({ x1: 100, y1: 10, x2: 106, y2: 80, stub: 12 })).toBe(
      "M 100 10 L 106 10 L 106 80 L 106 80",
    );
  });

  it("на одной высоте (y1===y2): строго горизонтальная прямая, без локтя и диагонали", () => {
    expect(connectorPath({ x1: 100, y1: 50, x2: 300, y2: 50 })).toBe("M 100 50 L 300 50");
  });

  it("инвариант: все x пути лежат в [min(x1,x2), max(x1,x2)] (текст не пересекается)", () => {
    const d = connectorPath({ x1: 120, y1: 0, x2: 420, y2: 999 });
    const xs = [...d.matchAll(/[ML] (-?\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(120);
      expect(x).toBeLessThanOrEqual(420);
    }
  });
});

describe("cardAttachY", () => {
  it("якорь в пределах карточки → крепление ровно на высоте якоря (горизонталь)", () => {
    expect(cardAttachY(60, 40, 120)).toBe(60);
  });

  it("карточку увело ниже якоря → крепление у верха карточки (даёт локоть)", () => {
    expect(cardAttachY(60, 200, 320)).toBe(214); // 200 + pad(14)
  });

  it("карточка выше якоря → крепление у низа карточки", () => {
    expect(cardAttachY(600, 200, 320)).toBe(306); // 320 - pad(14)
  });

  it("вырожденно-короткая карточка (диапазон схлопнут) → верхний край", () => {
    expect(cardAttachY(60, 100, 110, 14)).toBe(114); // lo=114, hi=max(114,96)=114
  });
});
