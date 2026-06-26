// src/features/canvas/engine/svg/svg-painter.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import type { Scene } from "../painter";

import { svgPainter } from "./svg-painter";

const scene: Scene = {
  data: {
    nodes: [{ id: "n", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" }],
    edges: [],
  },
  viewport: { x: 0, y: 0, zoom: 1 },
  resolveEntityRef: (t) => ({ href: null, typeLabel: t }),
  selectedNodeIds: new Set(),
  selectedEdgeIds: new Set(),
  handlesForNodeId: null,
  edgeTargetId: null,
  invalidNodeId: null,
  edgeDraft: null,
  marquee: null,
};

// renderToStaticMarkup (а не RTL render): проверяем строковый SVG-markup как строку.
const surfaceMarkup = (): string => {
  const Surface = svgPainter.Surface;
  return renderToStaticMarkup(<Surface scene={scene} size={{ width: 800, height: 600 }} />);
};

describe("svgPainter.Surface", () => {
  it("рендерит сцену в SVG с текстом узла", () => {
    expect(surfaceMarkup()).toContain("<svg");
    expect(surfaceMarkup()).toContain("Привет");
  });

  it("ставит pointer-events:none на корневой svg", () => {
    expect(surfaceMarkup()).toMatch(/pointer-events:\s*none/);
  });
});
