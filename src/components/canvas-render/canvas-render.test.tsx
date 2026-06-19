// src/components/canvas-render/canvas-render.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Мок @/i18n: getT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n", async () => {
  const { default: common } = await import("@/i18n/messages/ru/common");
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = common;
        for (const part of parts) val = val?.[part];
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      }),
  };
});

import { CanvasRender } from "./canvas-render";
import type { RenderData, EntityRefResolver } from "./types";

const resolve: EntityRefResolver = (type, id) =>
  type === "document"
    ? { href: `/documents/${id}`, typeLabel: "Документ" }
    : { href: null, typeLabel: "Аннотация" };

describe("CanvasRender", () => {
  it("пустой граф → плашка emptyText", async () => {
    render(await CanvasRender({ data: { nodes: [], edges: [] }, resolveEntityRef: resolve }));
    expect(screen.getByText("Граф пуст.")).not.toBeNull();
  });

  it("рисует svg с узлами и ребром", async () => {
    const data: RenderData = {
      nodes: [
        { id: "a", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" },
        { id: "b", type: "shape", x: 200, y: 0, width: 80, height: 80, shapeKind: "ellipse" },
      ],
      edges: [{ id: "e1", fromNode: "a", toNode: "b", style: "dashed", end: "arrow" }],
    };
    const { container } = render(await CanvasRender({ data, resolveEntityRef: resolve }));
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("ellipse")).not.toBeNull();
    expect(container.querySelector("path[stroke-dasharray]")).not.toBeNull();
    expect(container.querySelector("path[marker-end]")).not.toBeNull();
  });

  it("entity_ref с известным типом → ссылка", async () => {
    const data: RenderData = {
      nodes: [{ id: "r", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entityType: "document", entityId: "d1" }],
      edges: [],
    };
    const { container } = render(await CanvasRender({ data, resolveEntityRef: resolve }));
    const a = container.querySelector('a[href="/documents/d1"]');
    expect(a).not.toBeNull();
  });

  it("entity_ref без публичной страницы → плашка без ссылки", async () => {
    const data: RenderData = {
      nodes: [{ id: "r", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entityType: "annotation", entityId: "an1" }],
      edges: [],
    };
    const { container } = render(await CanvasRender({ data, resolveEntityRef: resolve }));
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[data-entity-unlinked='annotation']")).not.toBeNull();
  });

  it("ребро на несуществующий узел не валит рендер", async () => {
    const data: RenderData = {
      nodes: [{ id: "a", type: "text", x: 0, y: 0, width: 100, height: 40, text: "x" }],
      edges: [{ id: "e1", fromNode: "a", toNode: "ghost" }],
    };
    const { container } = render(await CanvasRender({ data, resolveEntityRef: resolve }));
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
