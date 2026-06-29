// src/components/canvas-render/canvas-scene.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CanvasScene } from "./canvas-scene";
import type { EntityRefResolver, RenderData } from "./types";

const resolve: EntityRefResolver = (type, id) =>
  type === "document" ? { href: `/documents/${id}`, typeLabel: "Документ" } : { href: null, typeLabel: "Объект" };

afterEach(cleanup);

describe("CanvasScene", () => {
  it("рендерит svg с переданным viewBox, узлами и ребром-стрелкой", () => {
    const data: RenderData = {
      nodes: [
        { id: "a", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" },
        { id: "b", type: "shape", x: 200, y: 0, width: 80, height: 80, shapeKind: "ellipse" },
      ],
      edges: [{ id: "e1", fromNode: "a", toNode: "b", end: "arrow" }],
    };
    const { container } = render(
      <CanvasScene data={data} resolveEntityRef={resolve} viewBox="0 0 300 100" width="100%" height="100%" ariaLabel="граф" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 300 100");
    expect(svg?.getAttribute("aria-label")).toBe("граф");
    expect(container.querySelector("ellipse")).not.toBeNull();
    expect(container.querySelector("path[marker-end]")).not.toBeNull();
  });

  it("entity_ref известного типа → ссылка", () => {
    const data: RenderData = {
      nodes: [{ id: "r", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entityType: "document", entityId: "d1" }],
      edges: [],
    };
    const { container } = render(
      <CanvasScene data={data} resolveEntityRef={resolve} viewBox="0 0 120 60" width="100%" height="100%" ariaLabel="граф" />,
    );
    expect(container.querySelector('a[href="/documents/d1"]')).not.toBeNull();
  });
});
