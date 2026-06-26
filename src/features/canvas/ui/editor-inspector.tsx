"use client";
// src/features/canvas/ui/editor-inspector.tsx
import { Label, NumberField, Select, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { EditorCommand, Side } from "../editor";
import type { CanvasData } from "../types";

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
  const t = useT("canvas");

  const sideOptions = [
    { value: "", label: t("inspector.sideAuto") },
    { value: "top", label: t("inspector.sideTop") },
    { value: "right", label: t("inspector.sideRight") },
    { value: "bottom", label: t("inspector.sideBottom") },
    { value: "left", label: t("inspector.sideLeft") },
  ];

  const node = selectedNodeIds.length === 1 ? (data.nodes ?? []).find((n) => n.id === selectedNodeIds[0]) : undefined;
  const edge = selectedEdgeIds.length === 1 ? (data.edges ?? []).find((e) => e.id === selectedEdgeIds[0]) : undefined;

  if (!node && !edge) {
    return <p className="text-sm text-(--color-fg-muted)">{t("inspector.emptyHint")}</p>;
  }

  if (node) {
    const nodeId = node.id;
    if (!nodeId) return null;
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("inspector.nodeHeading", { type: node.type })}</h3>
        {node.type === "shape" && (
          <div className="flex flex-col gap-1 text-sm">
            {t("inspector.shapeLabel")}
            <Select
              name="shape_kind"
              aria-label={t("inspector.shapeAriaLabel")}
              value={node.shape_kind ?? "rect"}
              onValueChange={(v) => { dispatch({ type: "setShapeKind", nodeId, shapeKind: v as "rect" | "ellipse" | "diamond" }); }}
              options={[
                { value: "rect", label: t("inspector.shapeRect") },
                { value: "ellipse", label: t("inspector.shapeEllipse") },
                { value: "diamond", label: t("inspector.shapeDiamond") },
              ]}
            />
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="inspector-node-x">{t("inspector.xLabel")}</Label>
            <NumberField
              id="inspector-node-x"
              value={node.x ?? 0}
              onValueChange={(v) => { dispatch({ type: "setNodePosition", nodeId, x: v ?? 0, y: node.y ?? 0 }); }}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="inspector-node-y">{t("inspector.yLabel")}</Label>
            <NumberField
              id="inspector-node-y"
              value={node.y ?? 0}
              onValueChange={(v) => { dispatch({ type: "setNodePosition", nodeId, x: node.x ?? 0, y: v ?? 0 }); }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="inspector-node-width">{t("inspector.widthLabel")}</Label>
            <NumberField
              id="inspector-node-width"
              value={node.width ?? 0}
              onValueChange={(v) => { dispatch({ type: "setNodeSize", nodeId, width: v ?? 0, height: node.height ?? 0 }); }}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="inspector-node-height">{t("inspector.heightLabel")}</Label>
            <NumberField
              id="inspector-node-height"
              value={node.height ?? 0}
              onValueChange={(v) => { dispatch({ type: "setNodeSize", nodeId, width: node.width ?? 0, height: v ?? 0 }); }}
            />
          </div>
        </div>
        {node.type === "entity_ref" && (
          <p className="text-xs text-(--color-fg-muted)">
            {node.entity_type}: {node.entity_id}
          </p>
        )}
      </div>
    );
  }

  // We know edge is defined here: the !node && !edge guard above returned early.
  if (!edge) {
    return <p className="text-sm text-(--color-fg-muted)">{t("inspector.emptyHint")}</p>;
  }

  const edgeId = edge.id;
  if (!edgeId) return null;
  // edge
  const sideValue = (s: Side | undefined) => s ?? "";
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{t("inspector.edgeHeading")}</h3>
      <div className="flex flex-col gap-1">
        <Label htmlFor="inspector-edge-label">{t("inspector.edgeCaptionLabel")}</Label>
        <TextInput
          id="inspector-edge-label"
          value={edge.label ?? ""}
          maxLength={200}
          onChange={(e) => { dispatch({ type: "setEdgeLabel", edgeId, label: e.target.value }); }}
        />
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {t("inspector.edgeStyleLabel")}
        <Select
          name="style"
          aria-label={t("inspector.edgeStyleAriaLabel")}
          value={edge.style ?? "solid"}
          onValueChange={(v) => { dispatch({ type: "setEdgeStyle", edgeId, style: v as "solid" | "dashed" }); }}
          options={[{ value: "solid", label: t("inspector.edgeStyleSolid") }, { value: "dashed", label: t("inspector.edgeStyleDashed") }]}
        />
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {t("inspector.edgeEndLabel")}
        <Select
          name="end"
          aria-label={t("inspector.edgeEndAriaLabel")}
          value={edge.end ?? "arrow"}
          onValueChange={(v) => { dispatch({ type: "setEdgeEnd", edgeId, end: v as "none" | "arrow" }); }}
          options={[{ value: "arrow", label: t("inspector.edgeEndArrow") }, { value: "none", label: t("inspector.edgeEndNone") }]}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1 text-sm">
          {t("inspector.edgeFromSideLabel")}
          <Select
            name="from_side"
            aria-label={t("inspector.edgeFromSideAriaLabel")}
            value={sideValue(edge.from_side)}
            onValueChange={(v) => { dispatch(sidesCommand(edgeId, (v || undefined) as Side | undefined, edge.to_side)); }}
            options={sideOptions}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-sm">
          {t("inspector.edgeToSideLabel")}
          <Select
            name="to_side"
            aria-label={t("inspector.edgeToSideAriaLabel")}
            value={sideValue(edge.to_side)}
            onValueChange={(v) => { dispatch(sidesCommand(edgeId, edge.from_side, (v || undefined) as Side | undefined)); }}
            options={sideOptions}
          />
        </div>
      </div>
    </div>
  );
}
