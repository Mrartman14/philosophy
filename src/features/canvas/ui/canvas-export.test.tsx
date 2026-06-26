// src/features/canvas/ui/canvas-export.test.tsx
import { describe, it, expect } from "vitest";

import type { EntityRefResolver, RenderData } from "@/components/canvas-render";

import { buildExportSvg } from "./canvas-export";

const resolve: EntityRefResolver = (type) => ({ href: null, typeLabel: type });

const data: RenderData = {
  nodes: [
    { id: "t", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" },
    { id: "s", type: "shape", x: 200, y: 0, width: 80, height: 80, shapeKind: "rect" },
  ],
  edges: [{ id: "e", fromNode: "t", toNode: "s" }],
};

describe("buildExportSvg", () => {
  it("строит самодостаточный SVG: текст узла отрендерен переиспользуемым рендером", () => {
    const { svg } = buildExportSvg(data, resolve, document.documentElement);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Привет"); // тот же NodeShapeRender, без дублирования отрисовки
  });

  it("вшивает цвета темы: в строке не остаётся var(--color-*)", () => {
    const { svg } = buildExportSvg(data, resolve, document.documentElement);
    expect(svg).not.toMatch(/var\(--color-/);
  });

  it("размер = bounding box графа + поля с обеих сторон", () => {
    const { width, height } = buildExportSvg(data, resolve, document.documentElement);
    // bbox: x 0..280, y 0..80; MARGIN=24 с каждой стороны.
    expect(width).toBe(280 + 48);
    expect(height).toBe(80 + 48);
  });
});
