// src/features/canvas/ui/editor-inspector.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import type { CanvasData, CanvasNode } from "../types";

import { EditorInspector } from "./editor-inspector";

function dataWith(node: CanvasNode): CanvasData {
  return { nodes: [node], edges: [] };
}

afterEach(cleanup);

describe("EditorInspector — текст выбранного узла", () => {
  it("для text-узла показывает поле текста и диспатчит setNodeText при вводе", () => {
    const dispatch = vi.fn();
    const node: CanvasNode = { id: "n1", type: "text", text: "старый", x: 0, y: 0, width: 100, height: 40 };
    render(
      <EditorInspector data={dataWith(node)} selectedNodeIds={["n1"]} selectedEdgeIds={[]} dispatch={dispatch} />,
    );

    const field = screen.getByLabelText("inspector.nodeTextLabel");
    expect(field).toHaveValue("старый");

    fireEvent.change(field, { target: { value: "новый" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "setNodeText", nodeId: "n1", text: "новый" });
  });

  it("для shape-узла поле текста тоже присутствует", () => {
    const node: CanvasNode = { id: "s1", type: "shape", shape_kind: "rect", text: "", x: 0, y: 0, width: 100, height: 40 };
    render(
      <EditorInspector data={dataWith(node)} selectedNodeIds={["s1"]} selectedEdgeIds={[]} dispatch={vi.fn()} />,
    );

    expect(screen.getByLabelText("inspector.nodeTextLabel")).toBeInTheDocument();
  });

  it("для entity_ref-узла поля текста нет", () => {
    const node: CanvasNode = { id: "e1", type: "entity_ref", entity_type: "document", entity_id: "doc-1", x: 0, y: 0, width: 100, height: 40 };
    render(
      <EditorInspector data={dataWith(node)} selectedNodeIds={["e1"]} selectedEdgeIds={[]} dispatch={vi.fn()} />,
    );

    expect(screen.queryByLabelText("inspector.nodeTextLabel")).not.toBeInTheDocument();
  });
});
