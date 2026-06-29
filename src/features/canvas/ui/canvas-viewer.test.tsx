// src/features/canvas/ui/canvas-viewer.test.tsx
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import type { RenderData } from "@/components/canvas-render";

import { CanvasViewer } from "./canvas-viewer";

type RoCb = (entries: { contentRect: { width: number; height: number } }[]) => void;

/** Стаб ResizeObserver, отдающий захваченный callback тесту. */
function stubResizeObserver(): { fire: (w: number, h: number) => void } {
  let cb: RoCb | null = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(c: RoCb) { cb = c; }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  return { fire: (w, h) => { act(() => { cb?.([{ contentRect: { width: w, height: h } }]); }); } };
}

const oneNode: RenderData = {
  nodes: [{ id: "a", type: "text", x: 0, y: 0, width: 100, height: 100, text: "x" }],
  edges: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CanvasViewer", () => {
  it("пустой граф → плашка emptyText, тулбара нет", () => {
    stubResizeObserver();
    render(<CanvasViewer data={{ nodes: [], edges: [] }} />);
    expect(screen.getByText("canvasRender.emptyGraph")).toBeInTheDocument();
    expect(screen.queryByLabelText("viewer.zoomIn")).not.toBeInTheDocument();
  });

  it("до замера контейнера — статичная ветка (viewBox по bbox+margin), без тулбара", () => {
    stubResizeObserver();
    const { container } = render(<CanvasViewer data={oneNode} />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- читаем атрибут viewBox у SVG, RTL-запросом не достать (прецедент: canvas-render relaxation block)
    const svg = container.querySelector("svg");
    // bbox {0,0,100,100} + margin 24 → "-24 -24 148 148"
    expect(svg?.getAttribute("viewBox")).toBe("-24 -24 148 148");
    expect(screen.queryByLabelText("viewer.zoomIn")).not.toBeInTheDocument();
  });

  it("после замера → интерактив: появляется тулбар, viewBox из вьюпорта", () => {
    const ro = stubResizeObserver();
    const { container } = render(<CanvasViewer data={oneNode} />);
    ro.fire(800, 600);
    expect(screen.getByLabelText("viewer.zoomIn")).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- читаем атрибут viewBox у SVG, RTL-запросом не достать (прецедент: canvas-render relaxation block)
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg not rendered");
    const vbAfterFit = svg.getAttribute("viewBox");
    // fit-вьюпорт даёт viewBox формата "x y w h" ≠ статичному
    expect(vbAfterFit).not.toBe("-24 -24 148 148");
  });

  it("кнопка зум-ин меняет viewBox (масштаб растёт → видимая область сужается)", () => {
    const ro = stubResizeObserver();
    const { container } = render(<CanvasViewer data={oneNode} />);
    ro.fire(800, 600);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- читаем атрибут viewBox у SVG, RTL-запросом не достать (прецедент: canvas-render relaxation block)
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("svg not rendered");
    const before = svg.getAttribute("viewBox");
    fireEvent.click(screen.getByLabelText("viewer.zoomIn"));
    expect(svg.getAttribute("viewBox")).not.toBe(before);
  });
});
