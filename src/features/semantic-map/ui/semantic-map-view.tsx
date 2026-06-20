"use client";
// src/features/semantic-map/ui/semantic-map-view.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { ThreeMapRenderer } from "../renderer";
import type { RenderMode } from "../renderer";
import { projectToScreen } from "../renderer/project";
import { toRenderModel } from "../to-render-model";
import type { MapData } from "../types";

import { MapModeToggle } from "./map-mode-toggle";
import { MapRegionLabels, type ProjectedLabel } from "./map-region-labels";

const MODE_KEY = "semantic-map:mode";

export default function SemanticMapView({ data }: { data: MapData }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ThreeMapRenderer | null>(null);
  const [mode, setMode] = useState<RenderMode>(() => {
    // Восстановить сохранённый режим (lazy initializer — только на клиенте, ssr:false гарантирует это).
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(MODE_KEY) : null;
    return saved === "2d" || saved === "3d" ? saved : "2d";
  });
  // Текущий режим в ref — чтобы lifecycle-эффект (ключ [model]) применял его после
  // пере-создания рендерера при смене data, не теряя выбор пользователя.
  const modeRef = useRef<RenderMode>("2d");
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const model = useMemo(() => toRenderModel(data), [data]);

  // Жизненный цикл рендерера.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const r = new ThreeMapRenderer();
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

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <MapRegionLabels labels={labels} />
      <div className="absolute right-3 top-3">
        <MapModeToggle mode={mode} onChange={setMode} />
      </div>
      {model.count === 0 && (
        // i18n: вынести строку при интеграции
        <div className="absolute inset-0 flex items-center justify-center text-sm text-(--color-fg-muted)">
          Карта пуста
        </div>
      )}
    </div>
  );
}
