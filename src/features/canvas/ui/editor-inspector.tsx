"use client";
// src/features/canvas/ui/editor-inspector.tsx
import { Select, TextInput } from "@/components/ui";

import type { EditorCommand, Side } from "../editor";
import type { CanvasData } from "../types";

const SIDE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "авто" },
  { value: "top", label: "сверху" },
  { value: "right", label: "справа" },
  { value: "bottom", label: "снизу" },
  { value: "left", label: "слева" },
];

interface Props {
  data: CanvasData;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  dispatch: (c: EditorCommand) => void;
}

/** Команда setEdgeSides без undefined-значений (exactOptionalPropertyTypes). */
function sidesCommand(edgeId: string, fromSide: Side | undefined, toSide: Side | undefined): EditorCommand {
  return {
    type: "setEdgeSides",
    edgeId,
    ...(fromSide ? { fromSide } : {}),
    ...(toSide ? { toSide } : {}),
  };
}

/**
 * Инспектор: свойства одиночно выбранного узла или ребра. Для shape — выбор
 * фигуры; для всех — размеры (через setNodeSize). Для ребра — label/style/end/
 * стороны. При множественном/пустом выделении показывает подсказку.
 */
export function EditorInspector({ data, selectedNodeIds, selectedEdgeIds, dispatch }: Props) {
  const node = selectedNodeIds.length === 1 ? (data.nodes ?? []).find((n) => n.id === selectedNodeIds[0]) : undefined;
  const edge = selectedEdgeIds.length === 1 ? (data.edges ?? []).find((e) => e.id === selectedEdgeIds[0]) : undefined;

  if (!node && !edge) {
    return <p className="text-sm text-(--color-description)">Выберите узел или ребро.</p>;
  }

  if (node) {
    const nodeId = node.id;
    if (!nodeId) return null;
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Узел: {node.type}</h3>
        {node.type === "shape" && (
          <div className="flex flex-col gap-1 text-sm">
            Фигура
            <Select
              name="shape_kind"
              aria-label="Фигура"
              value={node.shape_kind ?? "rect"}
              onValueChange={(v) => { dispatch({ type: "setShapeKind", nodeId, shapeKind: v as "rect" | "ellipse" | "diamond" }); }}
              options={[
                { value: "rect", label: "Прямоугольник" },
                { value: "ellipse", label: "Эллипс" },
                { value: "diamond", label: "Ромб" },
              ]}
            />
          </div>
        )}
        <div className="flex gap-2">
          <label htmlFor="inspector-node-width" className="flex flex-1 flex-col gap-1 text-sm">
            Ширина
            <TextInput
              id="inspector-node-width"
              type="number"
              value={String(node.width ?? 0)}
              onChange={(e) => { dispatch({ type: "setNodeSize", nodeId, width: Number(e.target.value), height: node.height ?? 0 }); }}
            />
          </label>
          <label htmlFor="inspector-node-height" className="flex flex-1 flex-col gap-1 text-sm">
            Высота
            <TextInput
              id="inspector-node-height"
              type="number"
              value={String(node.height ?? 0)}
              onChange={(e) => { dispatch({ type: "setNodeSize", nodeId, width: node.width ?? 0, height: Number(e.target.value) }); }}
            />
          </label>
        </div>
        {node.type === "entity_ref" && (
          <p className="text-xs text-(--color-description)">
            {node.entity_type}: {node.entity_id}
          </p>
        )}
      </div>
    );
  }

  // We know edge is defined here: the !node && !edge guard above returned early.
  if (!edge) {
    return <p className="text-sm text-(--color-description)">Выберите узел или ребро.</p>;
  }

  const edgeId = edge.id;
  if (!edgeId) return null;
  // edge
  const sideValue = (s: Side | undefined) => s ?? "";
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Ребро</h3>
      <label htmlFor="inspector-edge-label" className="flex flex-col gap-1 text-sm">
        Подпись
        <TextInput
          id="inspector-edge-label"
          value={edge.label ?? ""}
          maxLength={200}
          onChange={(e) => { dispatch({ type: "setEdgeLabel", edgeId, label: e.target.value }); }}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        Стиль
        <Select
          name="style"
          aria-label="Стиль"
          value={edge.style ?? "solid"}
          onValueChange={(v) => { dispatch({ type: "setEdgeStyle", edgeId, style: v as "solid" | "dashed" }); }}
          options={[{ value: "solid", label: "Сплошная" }, { value: "dashed", label: "Пунктир" }]}
        />
      </div>
      <div className="flex flex-col gap-1 text-sm">
        Конец
        <Select
          name="end"
          aria-label="Конец"
          value={edge.end ?? "arrow"}
          onValueChange={(v) => { dispatch({ type: "setEdgeEnd", edgeId, end: v as "none" | "arrow" }); }}
          options={[{ value: "arrow", label: "Стрелка" }, { value: "none", label: "Без стрелки" }]}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1 text-sm">
          От стороны
          <Select
            name="from_side"
            aria-label="От стороны"
            value={sideValue(edge.from_side)}
            onValueChange={(v) => { dispatch(sidesCommand(edgeId, (v || undefined) as Side | undefined, edge.to_side)); }}
            options={SIDE_OPTIONS}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-sm">
          К стороне
          <Select
            name="to_side"
            aria-label="К стороне"
            value={sideValue(edge.to_side)}
            onValueChange={(v) => { dispatch(sidesCommand(edgeId, edge.from_side, (v || undefined) as Side | undefined)); }}
            options={SIDE_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}
