// src/components/canvas-render/edge-shape.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { ArrowMarkerDefs, EdgeShapeRender } from "./edge-shape";
import type { RenderEdge, RenderNode } from "./types";

const nodeA: RenderNode = { id: "a", type: "shape", x: 0, y: 0, width: 100, height: 40 };
const nodeB: RenderNode = { id: "b", type: "shape", x: 200, y: 200, width: 100, height: 40 };
const nodesById = new Map<string, RenderNode>([
  ["a", nodeA],
  ["b", nodeB],
]);

function baseEdge(overrides: Partial<RenderEdge> = {}): RenderEdge {
  return { id: "e", fromNode: "a", toNode: "b", ...overrides };
}

// renderToStaticMarkup (не RTL render): проверяем строковый SVG-markup как строку
// — компоненты чистые, без DOM-интерактива. Хелперы зовём инлайн в expect, чтобы
// не нарушить eslint testing-library/render-result-naming-convention.
const edgeMarkup = (edge: RenderEdge, selected = false): string =>
  renderToStaticMarkup(<EdgeShapeRender edge={edge} nodesById={nodesById} selected={selected} />);

const markerMarkup = (withSelected: boolean): string =>
  renderToStaticMarkup(<ArrowMarkerDefs withSelected={withSelected} />);

describe("EdgeShapeRender", () => {
  it("обычное ребро: дефолтная стрелка, цвет/толщина по умолчанию", () => {
    expect(edgeMarkup(baseEdge())).toContain('marker-end="url(#cv-arrow)"');
    expect(edgeMarkup(baseEdge())).toContain('stroke="var(--color-fg-muted)"');
    expect(edgeMarkup(baseEdge())).toContain('stroke-width="1.5"');
    // Без явного style нет пунктира.
    expect(edgeMarkup(baseEdge())).not.toContain("stroke-dasharray");
  });

  it("style:dashed → пунктирный путь", () => {
    expect(edgeMarkup(baseEdge({ style: "dashed" }))).toContain('stroke-dasharray="6 4"');
  });

  it("рендерит короткую подпись как есть", () => {
    expect(edgeMarkup(baseEdge({ label: "связь" }))).toContain("связь");
    expect(edgeMarkup(baseEdge({ label: "связь" }))).toContain("<text");
  });

  it("усекает длинную (>40) подпись на … (39 символов + многоточие)", () => {
    const long = "x".repeat(50);
    expect(edgeMarkup(baseEdge({ label: long }))).toContain("x".repeat(39) + "…");
    // Полная строка не должна присутствовать.
    expect(edgeMarkup(baseEdge({ label: long }))).not.toContain("x".repeat(40));
  });

  it("selected=true → акцентный цвет, толще, акцентный маркер", () => {
    expect(edgeMarkup(baseEdge(), true)).toContain('marker-end="url(#cv-arrow-selected)"');
    expect(edgeMarkup(baseEdge(), true)).toContain('stroke="var(--color-accent)"');
    expect(edgeMarkup(baseEdge(), true)).toContain('stroke-width="2.5"');
  });

  it("end:none → нет marker-end", () => {
    expect(edgeMarkup(baseEdge({ end: "none" }))).not.toContain("marker-end");
  });

  it("битая ссылка (узла нет в nodesById) → пустой markup", () => {
    const orphan = baseEdge({ fromNode: "missing" });
    expect(edgeMarkup(orphan)).toBe("");
    expect(edgeMarkup(orphan)).not.toContain("<g");
    expect(edgeMarkup(orphan)).not.toContain("<path");
  });
});

describe("ArrowMarkerDefs", () => {
  it("без withSelected: только базовый маркер cv-arrow", () => {
    expect(markerMarkup(false)).toContain('id="cv-arrow"');
    expect(markerMarkup(false)).not.toContain("cv-arrow-selected");
  });

  it("withSelected: оба маркера", () => {
    expect(markerMarkup(true)).toContain('id="cv-arrow"');
    expect(markerMarkup(true)).toContain('id="cv-arrow-selected"');
  });

  it("маркеры в user-space units шириной 10.5 (стрелка не растёт со strokeWidth)", () => {
    expect(markerMarkup(true)).toContain('markerUnits="userSpaceOnUse"');
    expect(markerMarkup(true)).toContain('markerWidth="10.5"');
  });
});
