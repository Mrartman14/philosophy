"use client";
// src/features/semantic-map/ui/semantic-map-view.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { useT } from "@/i18n/client";

import { weightedCentroid } from "../overlay/weighted-centroid";
import { ThreeMapRenderer, projectToScreen } from "../renderer";
import type { MapRenderer, RenderMode } from "../renderer";
import { toRenderModel } from "../to-render-model";
import type { MapData, MapOverlay } from "../types";

import { MapModeToggle } from "./map-mode-toggle";
import { MapRegionLabels, type ProjectedLabel } from "./map-region-labels";

const MODE_KEY = "semantic-map:mode";

// Восстановить сохранённый режим (только клиент — ssr:false гарантирует window).
function readSavedMode(): RenderMode {
  const saved =
    typeof window !== "undefined" ? window.localStorage.getItem(MODE_KEY) : null;
  return saved === "2d" || saved === "3d" ? saved : "2d";
}

export default function SemanticMapView({ data, overlay }: { data: MapData; overlay?: MapOverlay }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Тип рефа — ПОРТ MapRenderer (не конкретный ThreeMapRenderer): своп рисовалки
  // меняет только `new ThreeMapRenderer()`, не UI.
  const rendererRef = useRef<MapRenderer | null>(null);
  const [mode, setMode] = useState<RenderMode>(readSavedMode);
  // modeRef синхронизирован с mode (тот же восстановленный старт) — lifecycle-эффект
  // ([model]) применяет актуальный режим после пере-создания рендерера при смене data.
  const modeRef = useRef<RenderMode>(readSavedMode());
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const model = useMemo(() => toRenderModel(data), [data]);

  // Матч хитов с точками карты по id; маркер = score-взвешенный центроид совпавших.
  interface Matched { highlightIds: Set<string>; marker: [number, number, number] | null; count: number }
  const matched = useMemo<Matched | null>(() => {
    if (!overlay) return null;
    const score = new Map(overlay.hits.map((h) => [h.id, h.score]));
    const highlightIds = new Set<string>();
    const items: { pos: [number, number, number]; weight: number }[] = [];
    for (let i = 0; i < model.ids.length; i++) {
      const id = model.ids[i] ?? "";
      const w = score.get(id);
      if (w === undefined) continue;
      highlightIds.add(id);
      items.push({ pos: [model.positions[i * 3] ?? 0, model.positions[i * 3 + 1] ?? 0, model.positions[i * 3 + 2] ?? 0], weight: w });
    }
    return { highlightIds, marker: weightedCentroid(items), count: items.length };
  }, [overlay, model]);
  // Актуальный matched в ref — чтобы lifecycle-эффект ([model]) применял overlay к
  // пере-созданному рендереру, не добавляя matched в свои deps.
  const matchedRef = useRef<Matched | null>(null);
  // eslint-disable-next-line react-hooks/refs -- intentional: sync escape-hatch ref for lifecycle-effect
  matchedRef.current = matched;

  const t = useT("semanticMap");

  // Жизненный цикл рендерера.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const r: MapRenderer = new ThreeMapRenderer();
    rendererRef.current = r;

    const updateLabels = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const vp = r.getViewProjection();
      if (!vp || w === 0 || h === 0) return; // скрытая вкладка / до первого кадра
      const next: ProjectedLabel[] = [];
      for (const c of model.clusters) {
        if (!c.label) continue;
        const s = projectToScreen(c.centroid, vp, w, h);
        if (s.visible) next.push({ id: c.id, label: c.label, color: c.color, x: s.x, y: s.y });
      }
      setLabels(next);
    };

    r.mount(canvas);
    r.resize(wrap.clientWidth || 1, wrap.clientHeight || 1, window.devicePixelRatio || 1);
    r.onChange(updateLabels); // ДО setModel — чтобы первый отрисованный кадр обновил подписи
    r.setModel(model);
    r.setMode(modeRef.current); // применить текущий/восстановленный режим (переживает смену data)
    const m0 = matchedRef.current;
    if (m0) r.setOverlay({ highlightIds: m0.highlightIds, marker: m0.marker });

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
  }, [model]);

  // Применять смену режима + персист. modeRef переживает пере-маунт рендерера при смене data.
  useEffect(() => {
    modeRef.current = mode;
    rendererRef.current?.setMode(mode);
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  // Применять overlay при смене matched (и переживает пере-маунт через тот же эффект [model] ниже).
  useEffect(() => {
    rendererRef.current?.setOverlay(
      matched ? { highlightIds: matched.highlightIds, marker: matched.marker } : null,
    );
  }, [matched]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <MapRegionLabels labels={labels} />
      <div className="absolute right-3 top-3">
        <MapModeToggle mode={mode} onChange={setMode} />
      </div>
      {model.count === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-(--color-fg-muted)">
          {t("empty")}
        </div>
      )}
      {overlay && matched?.count === 0 && model.count > 0 && (
        <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded bg-(--color-surface) px-3 py-1 text-xs text-(--color-fg-muted) shadow">
          {t("overlayNoMatches")}
        </div>
      )}
    </div>
  );
}
