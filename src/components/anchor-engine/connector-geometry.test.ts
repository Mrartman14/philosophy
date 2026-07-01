// src/components/anchor-engine/connector-geometry.test.ts
import { describe, expect, it } from "vitest";

import { anchorAttachY, attachYs, connectorPath } from "./connector-geometry";

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

describe("attachYs", () => {
  it("диапазоны пересекаются, anchorY в пересечении → обе точки на высоте anchorY (горизонталь)", () => {
    // якорь [50,70], карточка [40,120] → пересечение [50,70], anchorY=60 внутри
    expect(attachYs(50, 70, 60, 40, 120)).toEqual({ y1: 60, y2: 60 });
  });

  it("пересекаются, но anchorY выше пересечения → обе точки у верха пересечения (горизонталь)", () => {
    // якорь [50,90], карточку увело: [70,200] → пересечение [70,90], anchorY=55<70
    expect(attachYs(50, 90, 55, 70, 200)).toEqual({ y1: 70, y2: 70 });
  });

  it("НЕТ пересечения, карточка ниже → текст на anchorY, карточка у верхнего края (локоть)", () => {
    // якорь [50,70], карточка [300,380] → не пересекаются
    expect(attachYs(50, 70, 60, 300, 380)).toEqual({ y1: 60, y2: 308 }); // 300 + edgePad(8)
  });

  it("НЕТ пересечения, карточка выше → карточка у нижнего края (локоть)", () => {
    // якорь [300,320], карточка [50,120] → не пересекаются
    expect(attachYs(300, 320, 310, 50, 120)).toEqual({ y1: 310, y2: 112 }); // 120 - edgePad(8)
  });
});

describe("anchorAttachY", () => {
  it("прямоугольник → центр bbox", () => {
    expect(anchorAttachY(0, 100, true)).toBe(50);
    expect(anchorAttachY(20, 40, true)).toBe(40);
  });

  it("линейный → центр первой строки (clamp 24)", () => {
    expect(anchorAttachY(0, 100, false)).toBe(12); // min(100,24)/2 = 12
    expect(anchorAttachY(0, 10, false)).toBe(5); // height < clamp → height/2
  });
});
