"use client";
// src/features/canvas/ui/canvas-editor.tsx
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { boundingBox, sidePoint, type Point, type RenderNode, type Side } from "@/components/canvas-render";
import { Button, ContextMenu, FormField, MarginNote, Select, TextInput, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createCanvas, updateCanvas } from "../actions";
import {
  canvasReducer, initEditorState, NODE_DEFAULT_SIZE, canvasDataToRenderData,
  screenToWorld, applyZoomAtPoint, fitViewport, centerViewport, snapPoint, validateGraph, hitTestNode, hitTest, marqueeHits, newId,
  resolveBackgroundGesture, resolveNodeGesture, resolveWheel, resolveNudge,
} from "../editor";
import type { EditorCommand, ResizeHandle } from "../editor";
import { downloadCanvasJson, painter } from "../engine";
import type { Scene } from "../engine";
import { makeEntityRefResolver } from "../entity-ref";
import type { Canvas, CanvasRefEntityType, Visibility } from "../types";

import { EditorInspector } from "./editor-inspector";
import { CanvasRulers } from "./editor-rulers";
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
  | { kind: "marquee"; startWorld: Point; currentWorld: Point; additive: boolean }
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

  // title + visibility — в панели-шапке (оба режима); в edit visibility только показ.
  const [title, setTitle] = useState(canvas?.title ?? "");
  const [visibility, setVisibility] = useState<Visibility>(canvas?.visibility ?? "private");

  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag>(null);
  // автозум «показать всё» при открытии: однократный, после первого замера поверхности.
  const measuredRef = useRef(false);
  const initialFitRef = useRef(false);
  // hover-курсор коалесим в один rAF на кадр: hit-test — O(N+E), а pointermove без
  // drag сыплется десятками/кадр на больших графах → джанк. Последние мировые
  // координаты держим в ref, планируем один rAF.
  const hoverRafRef = useRef<number | null>(null);
  const hoverWorldRef = useRef<Point | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  // id узла, который только что создан кнопкой «Текст» и ещё не подтверждён
  // непустым текстом: если останется пустым (Enter/blur/Esc) — узел удаляем.
  const [newNodeId, setNewNodeId] = useState<string | null>(null);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invalidNodeId, setInvalidNodeId] = useState<string | undefined>(undefined);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [edgePreview, setEdgePreview] = useState<{ from: Point; to: Point } | null>(null);
  // узел-кандидат под курсором во время протягивания нового ребра — подсвечивается
  const [edgeTargetId, setEdgeTargetId] = useState<string | null>(null);
  // Space зажат → временный режим пана (Figma). Читается inline-хендлерами из
  // замыкания рендера — поэтому их НЕ оборачивать в useCallback (stale closure).
  const [spaceHeld, setSpaceHeld] = useState(false);
  // id узла под правым кликом — цель пункта «Центрировать» контекст-меню.
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  // координатные линейки (Figma-стиль) — тогл тулбара / Shift+R.
  const [showGrid, setShowGrid] = useState(false);

  // «Грязно»: правки графа ИЛИ переименование (edit). Единый источник для
  // beforeunload-гарда, индикатора «не сохранено» в панели и доступности Save.
  const titleChanged = !isCreate && title.trim() !== (canvas?.title ?? "");
  const isDirty = state.dirty || titleChanged;

  // dirty-guard: beforeunload при несохранённых изменениях
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- TODO(foundation/eslint-strict): e.returnValue kept for Chrome <119 compat; remove when baseline supports only e.preventDefault()
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => { window.removeEventListener("beforeunload", handler); };
  }, [isDirty]);

  // измеряем контейнер поверхности → size для painter.Surface (он считает viewBox).
  // Гард ширина/высота>0 защищает от переходного 0: нулевой viewBox по спеке
  // отключил бы отрисовку SVG. Поверхность не пересоздаётся → пустых deps хватает.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        measuredRef.current = true;
        setSize({ width: r.width, height: r.height });
      }
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, []);

  const renderData = useMemo(() => canvasDataToRenderData(state.data), [state.data]);
  const resolveEntityRef = useMemo(() => makeEntityRefResolver(t), [t]);
  const nodesById = useMemo(() => new Map<string, RenderNode>(renderData.nodes.map((n) => [n.id, n])), [renderData.nodes]);
  const selectedNodeIds = useMemo(() => new Set(state.selection.nodeIds), [state.selection.nodeIds]);
  const selectedEdgeIds = useMemo(() => new Set(state.selection.edgeIds), [state.selection.edgeIds]);
  // id единственного выделенного узла — общий источник для ручек/портов (рендер) и хит-теста.
  const singleSelectedNodeId = state.selection.nodeIds.length === 1 ? (state.selection.nodeIds[0] ?? null) : null;

  const vp = state.viewport;

  // Автозум «показать всё» при открытии редактора: один раз, после первого
  // реального замера поверхности и при непустом графе. Пустой граф (create) —
  // просто помечаем «сделано», чтобы добавление первого узла не дёргало зум.
  useEffect(() => {
    if (initialFitRef.current || !measuredRef.current) return;
    initialFitRef.current = true;
    if (renderData.nodes.length > 0) {
      dispatch({ type: "setViewport", viewport: fitViewport(boundingBox(renderData.nodes), size) });
    }
  }, [size, renderData.nodes, dispatch]);

  /** Экранные координаты события (относительно поверхности-div) → мировые. */
  const eventWorld = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);
    return screenToWorld({ x: sx, y: sy }, state.viewport);
  }, [state.viewport]);

  /** Мировая точка стороны узла (для preview ребра). */
  const sideWorld = useCallback((nodeId: string, side: Side): Point => {
    const n = nodesById.get(nodeId);
    return n ? sidePoint(n, side) : { x: 0, y: 0 };
  }, [nodesById]);

  // ---- pointer handlers ----
  /** Старт пана: записываем drag-стейт и захватываем указатель. */
  const startPan = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { kind: "pan", startScreen: { x: e.clientX, y: e.clientY }, startVp: { x: vp.x, y: vp.y } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  /** Единый pointerdown по поверхности: JS hit-test решает жест. */
  const onSurfacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const world = eventWorld(e);
    const hit = hitTest(world, {
      nodes: renderData.nodes,
      edges: renderData.edges,
      nodesById,
      singleSelectedNodeId,
    });
    const capture = () => { e.currentTarget.setPointerCapture(e.pointerId); };
    switch (hit.kind) {
      case "resize-handle":
        dragRef.current = { kind: "resize", nodeId: hit.nodeId, handle: hit.handle, lastWorld: world };
        capture();
        return;
      case "port":
        dragRef.current = { kind: "edge", fromNode: hit.nodeId, fromSide: hit.side, currentWorld: world };
        capture();
        return;
      case "node": {
        const gesture = resolveNodeGesture({
          tool: state.tool, spaceHeld, button: e.button, pointerType: e.pointerType, shift: e.shiftKey,
        });
        if (gesture === "pan") { startPan(e); return; }
        if (!selectedNodeIds.has(hit.nodeId)) {
          dispatch({ type: "selectNode", nodeId: hit.nodeId, additive: e.shiftKey });
        } else if (e.shiftKey) {
          dispatch({ type: "selectNode", nodeId: hit.nodeId, additive: true });
        }
        dragRef.current = { kind: "move", lastWorld: world };
        capture();
        return;
      }
      case "edge":
        dispatch({ type: "selectEdge", edgeId: hit.edgeId, additive: e.shiftKey });
        return;
      case "background": {
        const gesture = resolveBackgroundGesture({
          tool: state.tool, spaceHeld, button: e.button, pointerType: e.pointerType, shift: e.shiftKey,
        });
        if (gesture === "marquee") {
          if (!e.shiftKey) dispatch({ type: "clearSelection" });
          dragRef.current = { kind: "marquee", startWorld: world, currentWorld: world, additive: e.shiftKey };
          capture();
        } else {
          dispatch({ type: "clearSelection" });
          startPan(e);
        }
        return;
      }
    }
  };

  /** Двойной клик по узлу (text/shape) → инлайн-редактор текста. */
  const onSurfaceDoubleClick = (e: React.MouseEvent) => {
    const world = eventWorld(e);
    const hit = hitTestNode(world, renderData.nodes);
    if (!hit) return;
    const node = (state.data.nodes ?? []).find((n) => n.id === hit.id);
    if (node && (node.type === "text" || node.type === "shape")) {
      dispatch({ type: "selectNode", nodeId: hit.id, additive: false });
      setNewNodeId(null);
      setEditingNodeId(hit.id);
    }
  };

  /** Курсор поверхности по тому, что под указателем (без активного drag). */
  const updateHoverCursor = (world: Point) => {
    const el = surfaceRef.current;
    if (!el) return;
    if (state.tool === "hand" || spaceHeld) { el.style.cursor = "grab"; return; }
    const hit = hitTest(world, { nodes: renderData.nodes, edges: renderData.edges, nodesById, singleSelectedNodeId });
    el.style.cursor =
      hit.kind === "resize-handle" ? `${hit.handle}-resize`
        : hit.kind === "port" ? "crosshair"
          : hit.kind === "node" ? "move"
            : hit.kind === "edge" ? "pointer"
              : "default";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      hoverWorldRef.current = eventWorld(e);
      // ??= планирует rAF максимум раз на кадр (RHS вычисляется лишь когда current null).
      hoverRafRef.current ??= requestAnimationFrame(() => {
        hoverRafRef.current = null;
        // во время начавшегося drag hover-курсор не трогаем
        if (!dragRef.current && hoverWorldRef.current) updateHoverCursor(hoverWorldRef.current);
      });
      return;
    }
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

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === "marquee") {
      const world = eventWorld(e);
      const rect = { x: Math.min(drag.startWorld.x, world.x), y: Math.min(drag.startWorld.y, world.y), width: Math.abs(world.x - drag.startWorld.x), height: Math.abs(world.y - drag.startWorld.y) };
      const ids = marqueeHits(rect, renderData.nodes);
      const nextNodeIds = drag.additive
        ? Array.from(new Set([...state.selection.nodeIds, ...ids]))
        : ids;
      dispatch({ type: "selectMany", nodeIds: nextNodeIds, edgeIds: drag.additive ? state.selection.edgeIds : [] });
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

  // ---- wheel (Figma: ctrl/meta → зум у курсора, иначе → пан) ----
  // React onWheel ПАССИВНЫЙ → e.preventDefault() в JSX-хендлере игнорируется и
  // страница скроллится/зумится вместе с холстом. Поэтому вешаем НЕпассивный
  // нативный listener на surfaceRef (он заполняет холст, ref-мердж Trigger'а не задет).
  // Логику держим в ref и обновляем в effect'е каждый рендер (не во время рендера —
  // react-hooks/refs запрещает писать ref.current в фазе рендера), чтобы listener
  // не переподписывался и не ловил stale closure (vp/state читаются из current).
  const onWheelRef = useRef<((e: WheelEvent) => void) | null>(null);
  useEffect(() => {
    onWheelRef.current = (e: WheelEvent) => {
      e.preventDefault();
      const action = resolveWheel({
        deltaX: e.deltaX, deltaY: e.deltaY, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      });
      if (action.kind === "zoom") {
        const rect = surfaceRef.current?.getBoundingClientRect();
        const sx = e.clientX - (rect?.left ?? 0);
        const sy = e.clientY - (rect?.top ?? 0);
        dispatch({ type: "setViewport", viewport: applyZoomAtPoint(vp, action.factor, sx, sy) });
      } else {
        dispatch({ type: "setViewport", viewport: { ...vp, x: vp.x + action.dx / vp.zoom, y: vp.y + action.dy / vp.zoom } });
      }
    };
  });
  // Нативный non-passive wheel-listener (React onWheel пассивный).
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => { onWheelRef.current?.(e); };
    el.addEventListener("wheel", h, { passive: false });
    return () => { el.removeEventListener("wheel", h); };
  }, []);

  // Выделены ли узлы. Один источник истины для: z-order хоткеев, nudge-гарда и
  // disabled пунктов контекстного меню (НЕ путать с toolbar.hasSelection = node+edge).
  const hasNodeSelection = state.selection.nodeIds.length > 0;

  // Подгонка вьюпорта под все узлы (zoom-to-fit) — кнопка тулбара + Shift+1.
  const fitToContent = () => {
    if (renderData.nodes.length === 0) return;
    dispatch({ type: "setViewport", viewport: fitViewport(boundingBox(renderData.nodes), size) });
  };
  // Центрировать узел в середине вьюпорта (текущий зум) — пункт контекст-меню.
  const centerOnNode = (id: string) => {
    const n = nodesById.get(id);
    if (!n) return;
    dispatch({ type: "setViewport", viewport: centerViewport({ x: n.x + n.width / 2, y: n.y + n.height / 2 }, size, vp.zoom) });
  };

  // ---- keyboard ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingNodeId) return; // текст-оверлей перехватывает ввод

    if (e.code === "Space") {
      e.preventDefault();
      if (!spaceHeld) setSpaceHeld(true);
      return;
    }
    // Shift+1 — показать всё (Figma-конвенция zoom-to-fit). e.code, чтобы не зависеть
    // от раскладки (Shift+1 на US-раскладке даёт "!").
    if (e.shiftKey && e.code === "Digit1") {
      e.preventDefault();
      fitToContent();
      return;
    }
    // Shift+R — тогл координатных линеек (Figma-конвенция); без ctrl/meta (не R перезагрузки).
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === "KeyR") {
      e.preventDefault();
      setShowGrid((v) => !v);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "deleteSelection" });
      return;
    }
    if (e.key === "Escape") {
      dispatch({ type: "clearSelection" });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch(e.shiftKey ? { type: "redo" } : { type: "undo" });
      return;
    }
    // z-order: Cmd/Ctrl + ] / [  (на одиночном и групповом выделении)
    if ((e.ctrlKey || e.metaKey) && e.key === "]") {
      e.preventDefault();
      if (hasNodeSelection) dispatch({ type: "bringToFront", nodeIds: state.selection.nodeIds });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "[") {
      e.preventDefault();
      if (hasNodeSelection) dispatch({ type: "sendToBack", nodeIds: state.selection.nodeIds });
      return;
    }
    // инструмент V/H — ТОЛЬКО без ctrl/meta (не перехватывать Cmd+V / Cmd+H)
    if (!e.ctrlKey && !e.metaKey && (e.key === "v" || e.key === "V")) {
      dispatch({ type: "setTool", tool: "select" });
      return;
    }
    if (!e.ctrlKey && !e.metaKey && (e.key === "h" || e.key === "H")) {
      dispatch({ type: "setTool", tool: "hand" });
      return;
    }
    // nudge стрелками (без ctrl/meta); гасим скролл страницы для ЛЮБОЙ распознанной
    // стрелки (даже без выделения), а двигаем — только когда есть выбранные узлы.
    const nudge = !(e.ctrlKey || e.metaKey) ? resolveNudge(e.key, e.shiftKey) : null;
    if (nudge) {
      e.preventDefault();
      if (hasNodeSelection) dispatch({ type: "moveSelection", dx: nudge.dx, dy: nudge.dy });
    }
  };

  // Анти-залипание Space: div-level onKeyUp пропускал keyup, если фокус ушёл с
  // холста между Space down/up (Alt+Tab, клик в инспектор, диалог). Слушаем keyup
  // и blur на window, чтобы временный pan-режим всегда сбрасывался.
  useEffect(() => {
    const onUp = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceHeld(false); };
    const onBlur = () => { setSpaceHeld(false); };
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => { window.removeEventListener("keyup", onUp); window.removeEventListener("blur", onBlur); };
  }, []);

  // Чистая отписка висящего hover-rAF на размонтировании (ref'ы стабильны → deps []).
  useEffect(() => () => { if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current); }, []);

  // правый клик: нацелить меню на узел под курсором; по пустому фону — НЕ показывать.
  // КРИТИЧНО (ревью): Base UI ContextMenu открывается своим обработчиком contextmenu,
  // и обычный e.preventDefault() его НЕ останавливает (гасит лишь нативное меню браузера).
  // Чтобы подавить открытие popup, надо вызвать e.preventBaseUIHandler() — Base UI
  // добавляет этот метод на синтетическое событие, а наш onContextMenu по правилам
  // mergeProps выполняется ДО базового. Тип события расширяем локально.
  const onCanvasContextMenu = (e: React.MouseEvent & { preventBaseUIHandler?: () => void }) => {
    const world = eventWorld(e);
    const hit = hitTestNode(world, renderData.nodes);
    if (!hit) {
      e.preventDefault();          // нет нативного меню
      e.preventBaseUIHandler?.();  // и Base UI не открывает popup по пустому фону
      return;
    }
    setContextNodeId(hit.id);      // цель пункта «Центрировать»
    if (!selectedNodeIds.has(hit.id)) {
      dispatch({ type: "selectNode", nodeId: hit.id, additive: false });
    }
    // на узле: НЕ зовём preventBaseUIHandler — даём меню открыться и заанкориться к курсору
  };

  // ---- create-node helpers (центр вьюпорта) ----
  const viewportCenterWorld = useCallback((): Point => {
    return snapPoint(screenToWorld({ x: size.width / 2, y: size.height / 2 }, vp), true);
  }, [size, vp]);
  // Левый верхний угол так, чтобы ЦЕНТР ноды попал в центр вьюпорта (как вставка в
  // Figma — объект кладётся центром, а не углом). Команды add* принимают угол.
  const centeredTopLeft = (s: { width: number; height: number }): Point => {
    const c = viewportCenterWorld();
    return { x: c.x - s.width / 2, y: c.y - s.height / 2 };
  };

  const onAddText = () => {
    // Детерминированный id → сразу открываем текст-оверлей нового узла.
    const p = centeredTopLeft(NODE_DEFAULT_SIZE.text);
    const id = newId();
    dispatch({ type: "addTextNode", x: p.x, y: p.y, id });
    setNewNodeId(id);
    setEditingNodeId(id);
  };
  /** Удаляет узел по id (через выделение — отдельной команды deleteNode нет). */
  const deleteNodeById = (id: string) => {
    dispatch({ type: "selectNode", nodeId: id, additive: false });
    dispatch({ type: "deleteSelection" });
  };
  const onAddShape = (kind: "rect" | "ellipse" | "diamond") => { const p = centeredTopLeft(NODE_DEFAULT_SIZE.shape); dispatch({ type: "addShapeNode", shapeKind: kind, x: p.x, y: p.y }); };
  const onAddEntityRefConfirm = (entityType: CanvasRefEntityType, entityId: string) => {
    const p = centeredTopLeft(NODE_DEFAULT_SIZE.entity_ref);
    dispatch({ type: "addEntityRefNode", entityType, entityId, x: p.x, y: p.y });
    setRefDialogOpen(false);
  };

  // ---- export (svg/png) ----
  // rootEl = живая поверхность-div редактора: из неё getComputedStyle берёт реальные цвета темы.
  const exportTitle = isCreate ? title : (canvas?.title ?? "");
  const onExportSvg = () => {
    painter.exportSvg(renderData, resolveEntityRef, exportTitle, surfaceRef.current ?? document.documentElement);
  };
  const onExportPng = () => {
    void painter.exportPng(renderData, resolveEntityRef, exportTitle, surfaceRef.current ?? document.documentElement);
  };
  // JSON — данные канваса (не рендер), мимо painter-контракта.
  const onExportJson = () => { downloadCanvasJson(state.data, exportTitle); };
  const onCopyJson = () => {
    void navigator.clipboard.writeText(JSON.stringify(state.data, null, 2))
      .then(() => { toast.add({ title: t("editor.toastCopiedTitle") }); })
      .catch(() => { toast.add({ title: t("editor.toastCopyErrorTitle") }); });
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
    if (title.trim() === "") {
      toast.add({ title: t("editor.titleRequired") });
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("id", canvas?.id ?? "");
    fd.set("title", title.trim());
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

  const scene: Scene = useMemo(() => ({
    data: renderData,
    viewport: vp,
    resolveEntityRef,
    selectedNodeIds,
    selectedEdgeIds,
    handlesForNodeId: singleSelectedNodeId,
    edgeTargetId,
    invalidNodeId: invalidNodeId ?? null,
    edgeDraft: edgePreview,
    marquee,
  }), [renderData, vp, resolveEntityRef, selectedNodeIds, selectedEdgeIds, singleSelectedNodeId, edgeTargetId, invalidNodeId, edgePreview, marquee]);

  const editingNode = editingNodeId ? (state.data.nodes ?? []).find((n) => n.id === editingNodeId) : undefined;

  // Курсор холста: hand-инструмент или зажатый Space → grab; иначе → default.
  // Обновляется через state.tool / spaceHeld (оба триггерят ре-рендер).
  // «grabbing» во время активного пана опущен намеренно: dragRef — ref, читать
  // его current в рендере нельзя (react-hooks/refs), а ref-смена не ре-рендерит.
  // Отдельный useState под активный drag-kind — follow-up (brief, Step 7).
  const canvasCursor = (state.tool === "hand" || spaceHeld) ? "grab" : "default";

  // Сейв активен при непустом title; в edit ещё нужна «грязнота» (граф или title).
  const saveDisabled = saving || (isCreate ? title.trim() === "" : !isDirty);
  const saveLabel = isCreate ? t("toolbar.create") : undefined;

  return (
    // Фрагмент — прямые потомки .page-grid (страница рендерит CanvasEditor без
    // обёрток): тулбар в ЛЕВОМ поле (vertical, sticky под хедером), контент-хребет
    // с холстом, инспектор в ПРАВОМ поле. На < xl поля схлопываются → тулбар сверху,
    // холст, инспектор снизу.
    <>
    <MarginNote side="start" className="p-2 xl:pe-0 xl:self-start xl:sticky xl:top-(--layout-sticky-top)">
      <EditorToolbar
        dispatch={dispatch} tool={state.tool} canUndo={state.past.length > 0} canRedo={state.future.length > 0}
        dirty={state.dirty} orientation="vertical"
        hasSelection={state.selection.nodeIds.length + state.selection.edgeIds.length > 0}
        onAddText={onAddText} onAddShape={onAddShape} onAddEntityRef={() => { setRefDialogOpen(true); }}
        onFit={fitToContent} canFit={renderData.nodes.length > 0}
        gridOn={showGrid} onToggleGrid={() => { setShowGrid((v) => !v); }}
        onExportSvg={onExportSvg} onExportPng={onExportPng} onExportJson={onExportJson} onCopyJson={onCopyJson} canExport={renderData.nodes.length > 0}
      />
    </MarginNote>
    <div className="flex flex-col" style={{ height: "calc(100vh - var(--header-height))" }}>
      {/* Панель шапки — единая для создания и редактирования (внешняя идентичность):
          имя + уровень приватности (в edit здесь не меняется → disabled) + Save справа.
          Индикатор «не сохранено» не нужен: активная кнопка Save это и сообщает. */}
      <div className="flex flex-wrap items-end gap-4 border-b border-(--color-border) p-3">
        <FormField name="title" label={t("createForm.titleLabel")} required className="min-w-64 flex-1">
          <TextInput value={title} onChange={(e) => { setTitle(e.target.value); }} />
        </FormField>
        <FormField name="visibility" label={t("createForm.visibilityLabel")} className="w-48">
          <Select
            value={visibility}
            disabled={!isCreate}
            onValueChange={(v) => { setVisibility(v === "public" ? "public" : "private"); }}
            options={[
              { value: "private", label: t("createForm.visibilityPrivate") },
              { value: "public", label: t("createForm.visibilityPublic") },
            ]}
          />
        </FormField>
        <div className="ms-auto">
          <Button type="button" tone="primary" disabled={saveDisabled} onClick={() => { void onSave(); }}>
            {saving ? t("toolbar.saving") : (saveLabel ?? t("toolbar.save"))}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* холст */}
        {/*
          role="application" — корректная WAI-ARIA роль для самодостаточного
          холста-редактора. jsx-a11y берёт классификацию ролей из aria-query,
          где application наследуется от structure, а не widget, поэтому
          no-noninteractive-* считают её неинтерактивной — ложное срабатывание
          именно для этого паттерна.

          Текущая клавиатурная модель (tabIndex + onKeyDown; keyup/blur Space — на window):
            Delete/Backspace — удалить выбранный элемент;
            Escape          — снять выделение;
            Ctrl+Z / Ctrl+Shift+Z — Undo/Redo;
            V / H           — инструмент Select / Hand;
            Space (зажат)   — временный пан (Hand);
            Стрелки         — сдвиг выделения (Shift = 10px);
            Ctrl/Cmd+] / [  — на передний / задний план.
          Колесо: ctrl/meta — зум к курсору, иначе — пан (Figma-конвенция).

          KNOWN A11Y LIMITATION: навигация между узлами и создание рёбер без
          указателя — не реализованы. Полная клавиатурная авторизация отложена
          до основной работы над canvas (деferred scope).
        */}
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
              <div
                ref={surfaceRef}
                role="application"
                aria-label={t("editor.ariaLabel")}
                className="relative h-full flex-1 select-none outline-none"
                style={{ cursor: canvasCursor, touchAction: "none" }}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                onKeyDown={onKeyDown}
                onContextMenu={onCanvasContextMenu}
                onPointerDown={onSurfacePointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onDoubleClick={onSurfaceDoubleClick}
              />
            }
          >
          <painter.Surface scene={scene} size={size} />

          {showGrid && <CanvasRulers viewport={vp} size={size} />}

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
          </ContextMenu.Trigger>

          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup>
                <ContextMenu.Item disabled={contextNodeId === null} onClick={() => { if (contextNodeId) centerOnNode(contextNodeId); }}>
                  {t("contextMenu.center")}
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item disabled={!hasNodeSelection} onClick={() => { dispatch({ type: "bringToFront", nodeIds: state.selection.nodeIds }); }}>
                  {t("contextMenu.bringToFront")}
                </ContextMenu.Item>
                <ContextMenu.Item disabled={!hasNodeSelection} onClick={() => { dispatch({ type: "sendToBack", nodeIds: state.selection.nodeIds }); }}>
                  {t("contextMenu.sendToBack")}
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item disabled={!hasNodeSelection} onClick={() => { dispatch({ type: "deleteSelection" }); }}>
                  {t("contextMenu.delete")}
                </ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>

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
