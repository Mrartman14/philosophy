"use client";
// src/features/reference-graph/ui/graph-view.tsx
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useReducedMotion } from "@/components/appearance";
import {
  SceneModeToggle,
  SceneRegionLabels,
  readSavedMode,
  projectToScreen,
  type ProjectedLabel,
  type SceneRenderer,
  type SceneRenderMode,
} from "@/components/scene-3d";
import { useT } from "@/i18n/client";

import { nodeHref } from "../node-route";
import { toGraphRenderModel } from "../to-graph-render-model";
import type { GraphData, NodeType } from "../types";

import { ThreeGraphRenderer } from "./three-graph-renderer";

const MODE_KEY = "reference-graph:mode";
const LABEL_TOP_N = 12; // постоянные подписи только для топ-узлов по degree (ориентир в графе)

export default function GraphView({ data }: { data: GraphData }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Тип рефа — порт SceneRenderer (не конкретный ThreeGraphRenderer): своп рисовалки не трогает UI.
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [mode, setMode] = useState<SceneRenderMode>(() => readSavedMode(MODE_KEY));
  const modeRef = useRef<SceneRenderMode>(readSavedMode(MODE_KEY));
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);

  const model = useMemo(() => toGraphRenderModel(data), [data]);
  const t = useT("referenceGraph");
  const router = useRouter();

  // id→type (для nodeHref по клику). Берётся прямо из data.nodes (NodeType), кладём лишь когда есть id+type.
  const typeById = useMemo(() => {
    const m = new Map<string, NodeType>();
    for (const n of data.nodes ?? []) {
      if (n.id && n.type) m.set(n.id, n.type);
    }
    return m;
  }, [data]);

  // top-N узлов по degree — кандидаты на постоянную подпись (degree приходит из data.nodes).
  const labelNodes = useMemo(() => {
    const nodes = data.nodes ?? [];
    return [...nodes]
      .map((n, i) => ({ i, id: n.id ?? "", title: n.title ?? "", degree: n.degree ?? 0 }))
      .filter((n) => n.id && n.title)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, LABEL_TOP_N);
  }, [data]);

  const reduce = useReducedMotion();
  // reduceRef: актуальный reduce для lifecycle-эффекта [model] БЕЗ добавления его в deps
  // (иначе cleanup пересоздавал бы рендерер на каждый тогл движения). Тот же escape-hatch, что у карты.
  // Sync — через effect, а не write-в-рендере: здесь react-hooks/refs ругается на запись ref в
  // рендере (в semantic-map-view она проходит, но воспроизвести «чистый» вариант тут не удалось).
  // На ПЕРВОМ маунте useRef(reduce) уже несёт верный старт; эффект синхронит последующие изменения.
  const reduceRef = useRef(reduce);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const r: SceneRenderer = new ThreeGraphRenderer();
    rendererRef.current = r;

    const updateLabels = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const vp = r.getViewProjection();
      if (!vp || w === 0 || h === 0) return;
      const next: ProjectedLabel[] = [];
      for (const n of labelNodes) {
        const base = n.i * 3;
        const pos: [number, number, number] = [
          model.positions[base] ?? 0,
          model.positions[base + 1] ?? 0,
          model.positions[base + 2] ?? 0,
        ];
        const s = projectToScreen(pos, vp, w, h);
        if (s.visible) {
          next.push({ id: n.i, label: n.title, color: "var(--color-fg)", x: s.x, y: s.y });
        }
      }
      setLabels(next);
    };

    r.mount(canvas);
    r.resize(wrap.clientWidth || 1, wrap.clientHeight || 1, window.devicePixelRatio || 1);
    r.onChange(updateLabels); // ДО setModel — первый кадр обновит подписи

    // Клик по узлу → навигация на сущность. nodeHref=null (нет type / нет id / клик в пустоту) → no-op.
    r.onPick?.((id) => {
      if (!id) return;
      const href = nodeHref(typeById.get(id), id);
      if (href) router.push(href);
    });

    r.setModel(model);
    r.setMode(modeRef.current);
    r.setReducedMotion(reduceRef.current);

    const ro = new ResizeObserver(() => {
      r.resize(wrap.clientWidth, wrap.clientHeight, window.devicePixelRatio || 1);
      updateLabels();
    });
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      r.destroy();
      rendererRef.current = null;
    };
  }, [model, labelNodes, typeById, router]);

  useEffect(() => {
    modeRef.current = mode;
    rendererRef.current?.setMode(mode);
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reduce);
  }, [reduce]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      {/* dir=ltr изолирует 3D-сцену: WebGL-холст и region-labels (позиция через
          inline left:x — canvas-координаты) НЕ зеркалятся в RTL. Оверлеи ниже —
          снаружи, зеркалятся вместе со страницей. absolute inset-0 = бокс wrapRef,
          поэтому размер холста (ResizeObserver на wrapRef) не меняется. */}
      <div data-scene-canvas dir="ltr" className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
        <SceneRegionLabels labels={labels} />
      </div>
      <div className="absolute end-3 top-3">
        <SceneModeToggle
          mode={mode}
          onChange={setMode}
          ariaLabel={t("dimensionAriaLabel")}
        />
      </div>
      {model.count === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-(--color-fg-muted)">
          {t("empty")}
        </div>
      )}
    </div>
  );
}
