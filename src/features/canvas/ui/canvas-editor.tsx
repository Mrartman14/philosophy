"use client";
// src/features/canvas/ui/canvas-editor.tsx
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { Point, RenderNode, Side } from "@/components/canvas-render";
import { FormField, MarginNote, Select, TextInput, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createCanvas, updateCanvas } from "../actions";
import {
  canvasReducer, initEditorState, canvasDataToRenderData,
  screenToWorld, applyZoomAtPoint, snapPoint, validateGraph, hitTestNode, marqueeHits, newId, GRID_SIZE,
} from "../editor";
import type { EditorCommand, ResizeHandle } from "../editor";
import { makeEntityRefResolver } from "../entity-ref";
import type { Canvas, CanvasRefEntityType, Visibility } from "../types";

import { CanvasEditForm } from "./canvas-edit-form";
import { downloadCanvasSvg, downloadCanvasPng } from "./canvas-export";
import { EditorEdgeLayer } from "./editor-edge-layer";
import { EditorInspector } from "./editor-inspector";
import { EditorNodeLayer } from "./editor-node-layer";
import { EditorTextOverlay } from "./editor-text-overlay";
import { EditorToolbar } from "./editor-toolbar";
import { EntityRefDialog } from "./entity-ref-dialog";

interface Props {
  /** Существующий канвас (edit). В create-режиме отсутствует. */
  canvas?: Canvas;
  /** If-Match версия из GET (edit). В create-режиме не нужна. */
  etag?: string | null;
  /** "edit" (default) — PUT существующего; "create" — POST нового за один сейв. */
  mode?: "create" | "edit";
}

/** Тип активного drag-жеста. */
type Drag =
  | { kind: "pan"; startScreen: Point; startVp: { x: number; y: number } }
  | { kind: "move"; lastWorld: Point }
  | { kind: "resize"; nodeId: string; handle: ResizeHandle; lastWorld: Point }
  | { kind: "marquee"; startWorld: Point; currentWorld: Point }
  | { kind: "edge"; fromNode: string; fromSide: Side; currentWorld: Point }
  | null;

const INITIAL_SAVE_STATE: ActionResult<Canvas | null> = { success: true, data: null };

/**
 * Клиентский визуальный редактор графа канваса. Тонкий interaction-слой над
 * чистым ядром (canvasReducer): pointer/keyboard → команды. Рендер через
 * переиспользуемые canvas-render примитивы.
 *
 * Два режима:
 *  - "edit"   — сохранение через updateCanvas (PUT, If-Match по etag).
 *  - "create" — title+visibility вводятся в шапке, первый сейв шлёт createCanvas
 *    (POST, без etag) и редиректит в /canvases/{id}/edit. Бек принимает граф при
 *    создании и возвращает ETag — отдельный «черновой id» не нужен.
 *
 * Тестами НЕ покрывается (конвенция ast-editor).
 */
export function CanvasEditor({ canvas, etag = null, mode = "edit" }: Props) {
  const isCreate = mode === "create";
  const router = useRouter();
  const toast = useToast();
  const t = useT("canvas");
  const tErrors = useT("errors");
  const [state, rawDispatch] = useReducer(canvasReducer, canvas?.data ?? { nodes: [], edges: [] }, initEditorState);
  const dispatch = useCallback((c: EditorCommand) => { rawDispatch(c); }, []);

  // create-режим: title + visibility вводятся в шапке (в edit правятся через JSON-форму).
  const [title, setTitle] = useState(canvas?.title ?? "");
  const [visibility, setVisibility] = useState<Visibility>(canvas?.visibility ?? "private");

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  // id узла, который только что создан кнопкой «Текст» и ещё не подтверждён
  // непустым текстом: если останется пустым (Enter/blur/Esc) — узел удаляем.
  const [newNodeId, setNewNodeId] = useState<string | null>(null);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invalidNodeId, setInvalidNodeId] = useState<string | undefined>(undefined);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [edgePreview, setEdgePreview] = useState<{ from: Point; to: Point } | null>(null);
  // узел-кандидат под курсором во время протягивания нового ребра — подсвечивается
  const [edgeTargetId, setEdgeTargetId] = useState<string | null>(null);

  // dirty-guard: beforeunload при несохранённых изменениях
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.dirty) {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- TODO(foundation/eslint-strict): e.returnValue kept for Chrome <119 compat; remove when baseline supports only e.preventDefault()
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => { window.removeEventListener("beforeunload", handler); };
  }, [state.dirty]);

  // измеряем контейнер для viewBox
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, []);

  const renderData = useMemo(() => canvasDataToRenderData(state.data), [state.data]);
  const resolveEntityRef = useMemo(() => makeEntityRefResolver(t), [t]);
  const nodesById = useMemo(() => new Map<string, RenderNode>(renderData.nodes.map((n) => [n.id, n])), [renderData.nodes]);
  const selectedNodeIds = useMemo(() => new Set(state.selection.nodeIds), [state.selection.nodeIds]);
  const selectedEdgeIds = useMemo(() => new Set(state.selection.edgeIds), [state.selection.edgeIds]);

  const vp = state.viewport;
  // viewBox: мировые координаты видимой области = viewport.{x,y} + размер/zoom
  const viewBox = `${vp.x} ${vp.y} ${size.width / vp.zoom} ${size.height / vp.zoom}`;

  /** Экранные координаты события (относительно SVG) → мировые. */
  const eventWorld = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);
    return screenToWorld({ x: sx, y: sy }, state.viewport);
  }, [state.viewport]);

  /** Мировая точка стороны узла (для preview ребра). */
  const sideWorld = useCallback((nodeId: string, side: Side): Point => {
    const n = nodesById.get(nodeId);
    if (!n) return { x: 0, y: 0 };
    switch (side) {
      case "top": return { x: n.x + n.width / 2, y: n.y };
      case "right": return { x: n.x + n.width, y: n.y + n.height / 2 };
      case "bottom": return { x: n.x + n.width / 2, y: n.y + n.height };
      case "left": return { x: n.x, y: n.y + n.height / 2 };
    }
  }, [nodesById]);

  // ---- pointer handlers ----
  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return; // клик именно по фону
    const world = eventWorld(e);
    if (e.shiftKey) {
      dragRef.current = { kind: "marquee", startWorld: world, currentWorld: world };
    } else {
      dispatch({ type: "clearSelection" });
      dragRef.current = { kind: "pan", startScreen: { x: e.clientX, y: e.clientY }, startVp: { x: vp.x, y: vp.y } };
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onNodePointerDown = (nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selectedNodeIds.has(nodeId)) {
      dispatch({ type: "selectNode", nodeId, additive: e.shiftKey });
    } else if (e.shiftKey) {
      dispatch({ type: "selectNode", nodeId, additive: true });
    }
    dragRef.current = { kind: "move", lastWorld: eventWorld(e) };
    // Захват ставим на сам <g> узла, а НЕ на корневой <svg>: по спеке Pointer
    // Events синтетический click/dblclick уводится в элемент с захватом. Захват
    // на <svg> ретаргетил dblclick на корень → onDoubleClick на <g> не срабатывал
    // (даблклик «не открывал» редактирование текста). Drag сохраняется: события
    // всплывают с <g> к <svg>, где висят onPointerMove/onPointerUp.
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onResizeHandleDown = (nodeId: string, handle: ResizeHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: "resize", nodeId, handle, lastWorld: eventWorld(e) };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onSideHandleDown = (nodeId: string, side: Side, e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: "edge", fromNode: nodeId, fromSide: side, currentWorld: eventWorld(e) };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onEdgePointerDown = (edgeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    dispatch({ type: "selectEdge", edgeId, additive: e.shiftKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const world = eventWorld(e);
    switch (drag.kind) {
      case "pan": {
        const dxScreen = e.clientX - drag.startScreen.x;
        const dyScreen = e.clientY - drag.startScreen.y;
        dispatch({ type: "setViewport", viewport: { ...vp, x: drag.startVp.x - dxScreen / vp.zoom, y: drag.startVp.y - dyScreen / vp.zoom } });
        break;
      }
      case "move": {
        dispatch({ type: "moveSelection", dx: world.x - drag.lastWorld.x, dy: world.y - drag.lastWorld.y });
        drag.lastWorld = world;
        break;
      }
      case "resize": {
        dispatch({ type: "resizeNode", nodeId: drag.nodeId, handle: drag.handle, dx: world.x - drag.lastWorld.x, dy: world.y - drag.lastWorld.y });
        drag.lastWorld = world;
        break;
      }
      case "marquee":
        drag.currentWorld = world;
        setMarquee({ x: Math.min(drag.startWorld.x, world.x), y: Math.min(drag.startWorld.y, world.y), width: Math.abs(world.x - drag.startWorld.x), height: Math.abs(world.y - drag.startWorld.y) });
        break;
      case "edge": {
        drag.currentWorld = world;
        setEdgePreview({ from: sideWorld(drag.fromNode, drag.fromSide), to: world });
        // подсветка валидной цели: узел под курсором, кроме исходного (self-loop запрещён)
        const hovered = hitTestNode(world, renderData.nodes);
        setEdgeTargetId(hovered && hovered.id !== drag.fromNode ? hovered.id : null);
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === "marquee") {
      const world = eventWorld(e);
      const rect = { x: Math.min(drag.startWorld.x, world.x), y: Math.min(drag.startWorld.y, world.y), width: Math.abs(world.x - drag.startWorld.x), height: Math.abs(world.y - drag.startWorld.y) };
      const ids = marqueeHits(rect, renderData.nodes);
      dispatch({ type: "selectMany", nodeIds: ids, edgeIds: [] });
      setMarquee(null);
    } else if (drag.kind === "edge") {
      const world = eventWorld(e);
      const target = hitTestNode(world, renderData.nodes);
      if (target && target.id !== drag.fromNode) {
        dispatch({ type: "addEdge", fromNode: drag.fromNode, toNode: target.id, fromSide: drag.fromSide });
      }
      setEdgePreview(null);
      setEdgeTargetId(null);
    }
  };

  // ---- wheel zoom ----
  const onWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    dispatch({ type: "setViewport", viewport: applyZoomAtPoint(vp, factor, sx, sy) });
  };

  // ---- keyboard ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingNodeId) return; // текст-оверлей перехватывает
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "deleteSelection" });
    } else if (e.key === "Escape") {
      dispatch({ type: "clearSelection" });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch(e.shiftKey ? { type: "redo" } : { type: "undo" });
    }
  };

  // ---- node double-click → текст-оверлей (text/shape) ----
  const onNodeDoubleClick = (nodeId: string) => {
    const node = (state.data.nodes ?? []).find((n) => n.id === nodeId);
    if (node && (node.type === "text" || node.type === "shape")) {
      dispatch({ type: "selectNode", nodeId, additive: false });
      setNewNodeId(null); // правим существующий узел — очистка текста его НЕ удаляет
      setEditingNodeId(nodeId);
    }
  };

  // ---- create-node helpers (центр вьюпорта) ----
  const viewportCenterWorld = useCallback((): Point => {
    return snapPoint(screenToWorld({ x: size.width / 2, y: size.height / 2 }, vp), state.gridEnabled);
  }, [size, vp, state.gridEnabled]);

  const onAddText = () => {
    // Детерминированный id → сразу открываем текст-оверлей нового узла.
    const c = viewportCenterWorld();
    const id = newId();
    dispatch({ type: "addTextNode", x: c.x, y: c.y, id });
    setNewNodeId(id);
    setEditingNodeId(id);
  };
  /** Удаляет узел по id (через выделение — отдельной команды deleteNode нет). */
  const deleteNodeById = (id: string) => {
    dispatch({ type: "selectNode", nodeId: id, additive: false });
    dispatch({ type: "deleteSelection" });
  };
  const onAddShape = (kind: "rect" | "ellipse" | "diamond") => { const c = viewportCenterWorld(); dispatch({ type: "addShapeNode", shapeKind: kind, x: c.x, y: c.y }); };
  const onAddEntityRefConfirm = (entityType: CanvasRefEntityType, entityId: string) => {
    const c = viewportCenterWorld();
    dispatch({ type: "addEntityRefNode", entityType, entityId, x: c.x, y: c.y });
    setRefDialogOpen(false);
  };

  // ---- export (svg/png) ----
  // rootEl = живой svg редактора: из него getComputedStyle берёт реальные цвета темы.
  const exportTitle = isCreate ? title : (canvas?.title ?? "");
  const onExportSvg = () => {
    downloadCanvasSvg(renderData, resolveEntityRef, exportTitle, svgRef.current ?? document.documentElement);
  };
  const onExportPng = () => {
    void downloadCanvasPng(renderData, resolveEntityRef, exportTitle, svgRef.current ?? document.documentElement);
  };

  // ---- save ----
  /** Граф структурно-валиден? Иначе тостит ошибку и подсвечивает узел. */
  const validateBeforeSave = (): boolean => {
    setInvalidNodeId(undefined);
    const validation = validateGraph(state.data);
    if (validation.ok) return true;
    const first = validation.errors[0];
    if (first?.nodeId) setInvalidNodeId(first.nodeId);
    toast.add({
      title: t("editor.toastValidationTitle"),
      description: first
        ? t(`validate.${first.messageKey}`, first.params)
        : t("editor.toastValidationFallback"),
    });
    return false;
  };

  /** create: POST нового канваса (граф+title+visibility) → редирект в edit. */
  const onCreate = async () => {
    if (!validateBeforeSave()) return;
    if (title.trim() === "") {
      toast.add({ title: t("editor.titleRequired") });
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("visibility", visibility);
    fd.set("data", JSON.stringify(state.data));
    const result = await createCanvas(INITIAL_SAVE_STATE, fd);
    setSaving(false);
    if (result.success && result.data?.id) {
      toast.add({ title: t("createForm.toastCreatedTitle") });
      dispatch({ type: "markSaved", data: state.data });
      router.push(`/canvases/${result.data.id}/edit`);
    } else if (!result.success) {
      const msg =
        result.code === "forbidden"
          ? tErrors("forbiddenAction", { action: t("createForbiddenAction") })
          : result.error;
      toast.add({ title: t("createForm.toastErrorTitle"), description: msg });
    }
  };

  /** edit: PUT существующего канваса (If-Match по etag). */
  const onUpdate = async () => {
    if (!validateBeforeSave()) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("id", canvas?.id ?? "");
    fd.set("title", canvas?.title ?? "");
    fd.set("data", JSON.stringify(state.data));
    fd.set("etag", etag ?? "");
    const result = await updateCanvas(INITIAL_SAVE_STATE, fd);
    setSaving(false);
    if (result.success) {
      toast.add({ title: t("editor.toastSavedTitle") });
      dispatch({ type: "markSaved", data: state.data });
      router.refresh();
    } else {
      // серверная 400 по entity_ref-видимости: пытаемся вытащить node id из текста
      const m = /node(?:\sid)?\s+"([^"]+)"/.exec(result.error);
      if (m?.[1]) setInvalidNodeId(m[1]);
      const msg =
        result.code === "forbidden"
          ? tErrors("forbiddenAction", { action: t("editorUpdateForbiddenAction") })
          : result.error;
      toast.add({ title: t("editor.toastSaveErrorTitle"), description: msg });
    }
  };

  const onSave = isCreate ? onCreate : onUpdate;

  const onBack = () => {
    if (state.dirty && !window.confirm(t("editor.confirmLeave"))) return;
    router.push(isCreate ? "/canvases" : `/canvases/${canvas?.id}`);
  };

  const editingNode = editingNodeId ? (state.data.nodes ?? []).find((n) => n.id === editingNodeId) : undefined;

  // create: сейв активен при непустом title (граф может быть пустым — бек допускает).
  const saveDisabled = saving || (isCreate ? title.trim() === "" : !state.dirty);
  const saveLabel = isCreate ? t("toolbar.create") : undefined;

  // raw-JSON форма — только update (PUT с id/etag), поэтому в create недоступна.
  if (showJson && canvas) {
    return (
      <div className="flex flex-col gap-3">
        <EditorToolbar
          dispatch={dispatch} canUndo={state.past.length > 0} canRedo={state.future.length > 0}
          dirty={state.dirty} gridEnabled={state.gridEnabled} saving={saving} showJson={showJson}
          hasSelection={state.selection.nodeIds.length + state.selection.edgeIds.length > 0}
          onAddText={onAddText} onAddShape={onAddShape} onAddEntityRef={() => { setRefDialogOpen(true); }}
          onSave={() => { void onSave(); }} onToggleJson={() => { setShowJson(false); }} onBack={onBack}
          saveLabel={saveLabel} saveDisabled={saveDisabled}
        />
        <CanvasEditForm canvas={canvas} etag={etag} />
      </div>
    );
  }

  return (
    // Фрагмент: контент-хребет + правая маргиналия (инспектор). Прямые потомки
    // .page-grid (страница рендерит CanvasEditor без обёрток) → инспектор в поле.
    <>
    <div className="flex flex-col">
      {isCreate && (
        <div className="flex flex-wrap items-end gap-4 border-b border-(--color-border) p-3">
          <FormField name="title" label={t("createForm.titleLabel")} required className="min-w-64 flex-1">
            <TextInput value={title} onChange={(e) => { setTitle(e.target.value); }} />
          </FormField>
          <FormField name="visibility" label={t("createForm.visibilityLabel")} className="w-48">
            <Select
              value={visibility}
              onValueChange={(v) => { setVisibility(v === "public" ? "public" : "private"); }}
              options={[
                { value: "private", label: t("createForm.visibilityPrivate") },
                { value: "public", label: t("createForm.visibilityPublic") },
              ]}
            />
          </FormField>
        </div>
      )}

      <EditorToolbar
        dispatch={dispatch} canUndo={state.past.length > 0} canRedo={state.future.length > 0}
        dirty={state.dirty} gridEnabled={state.gridEnabled} saving={saving} showJson={showJson}
        hasSelection={state.selection.nodeIds.length + state.selection.edgeIds.length > 0}
        onAddText={onAddText} onAddShape={onAddShape} onAddEntityRef={() => { setRefDialogOpen(true); }}
        onSave={() => { void onSave(); }} onToggleJson={() => { setShowJson(true); }} onBack={onBack}
        saveLabel={saveLabel} saveDisabled={saveDisabled} hideJsonToggle={isCreate}
        onExportSvg={onExportSvg} onExportPng={onExportPng} canExport={renderData.nodes.length > 0}
      />

      <div className="flex">
        {/* холст */}
        {/*
          role="application" — корректная WAI-ARIA роль для самодостаточного
          холста-редактора. jsx-a11y берёт классификацию ролей из aria-query,
          где application наследуется от structure, а не widget, поэтому
          no-noninteractive-* считают её неинтерактивной — ложное срабатывание
          именно для этого паттерна.

          Текущая клавиатурная модель (tabIndex + onKeyDown):
            Delete/Backspace — удалить выбранный элемент;
            Escape          — снять выделение;
            Ctrl+Z / Ctrl+Shift+Z — Undo/Redo истории холста.
          Колесо мыши управляет зумом.

          KNOWN A11Y LIMITATION: навигация между узлами, перемещение узлов
          клавишами-стрелками, создание рёбер без указателя — не реализованы.
          Полная клавиатурная авторизация отложена до основной работы над canvas
          (деferred scope).
        */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          role="application"
          aria-label={t("editor.ariaLabel")}
          className="relative flex-1"
          style={{ height: "70vh" }}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
        >
          <svg
            ref={svgRef}
            width="100%" height="100%"
            viewBox={viewBox}
            style={{ touchAction: "none", background: "var(--color-surface)", display: "block" }}
            onPointerDown={onBackgroundPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <defs>
              {/* markerUnits=userSpaceOnUse: размер стрелки НЕ зависит от strokeWidth,
                  поэтому у выбранного (более толстого) ребра стрелка не увеличивается
                  (10.5 = прежний размер обычной стрелки: markerWidth 7 × stroke 1.5).
                  Два маркера = два цвета: стрелка перекрашивается в цвет своего ребра. */}
              <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-muted)" />
              </marker>
              <marker id="cv-arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
              </marker>
              {/* видимая сетка: точки с шагом GRID_SIZE в мировых координатах */}
              <pattern id="cv-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={0.5} fill="var(--color-border)" />
              </pattern>
            </defs>

            {/* фон-сетка на видимую область; pointerEvents=none — чтобы НЕ перехватывать
                клики фона (пан/снятие выделения), которые ловит сам <svg> */}
            {state.gridEnabled && (
              <rect
                x={vp.x} y={vp.y} width={size.width / vp.zoom} height={size.height / vp.zoom}
                fill="url(#cv-grid)" pointerEvents="none"
              />
            )}

            <EditorEdgeLayer
              edges={renderData.edges}
              nodesById={nodesById}
              selectedEdgeIds={selectedEdgeIds}
              preview={edgePreview ?? undefined}
              onEdgePointerDown={onEdgePointerDown}
            />
            <EditorNodeLayer
              nodes={renderData.nodes}
              selectedNodeIds={selectedNodeIds}
              resolveEntityRef={resolveEntityRef}
              invalidNodeId={invalidNodeId}
              edgeTargetId={edgeTargetId ?? undefined}
              onNodePointerDown={onNodePointerDown}
              onNodeDoubleClick={onNodeDoubleClick}
              onResizeHandleDown={onResizeHandleDown}
              onSideHandleDown={onSideHandleDown}
            />

            {marquee && (
              <rect
                x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height}
                fill="var(--color-accent)" fillOpacity={0.1}
                stroke="var(--color-accent)" strokeDasharray="4 2" pointerEvents="none"
              />
            )}
          </svg>

          {editingNode && (
            <EditorTextOverlay
              node={editingNode}
              viewport={vp}
              onCommit={(text) => {
                const id = editingNode.id;
                if (id) {
                  if (id === newNodeId && text.trim() === "") {
                    deleteNodeById(id); // только что созданный узел оставили пустым → удаляем
                  } else {
                    dispatch({ type: "setNodeText", nodeId: id, text });
                  }
                }
                setEditingNodeId(null);
                setNewNodeId(null);
              }}
              onCancel={() => {
                const id = editingNode.id;
                if (id && id === newNodeId) deleteNodeById(id); // Esc на новом узле → отменяем создание
                setEditingNodeId(null);
                setNewNodeId(null);
              }}
            />
          )}
        </div>

      </div>

      <EntityRefDialog open={refDialogOpen} onClose={() => { setRefDialogOpen(false); }} onConfirm={onAddEntityRefConfirm} />
    </div>

    {/* инспектор — в правом поле (маргиналии); < xl втекает под холст */}
    <MarginNote side="end" grow className="p-3 xl:ps-0">
      <EditorInspector
        data={state.data}
        selectedNodeIds={state.selection.nodeIds}
        selectedEdgeIds={state.selection.edgeIds}
        dispatch={dispatch}
      />
    </MarginNote>
    </>
  );
}
