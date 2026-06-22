"use client";
// src/features/semantic-map/ui/semantic-map-view.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { useReducedMotion } from "@/components/appearance";
import { SceneCanvasIsolation, readSavedMode } from "@/components/scene-3d";
import { useT } from "@/i18n/client";

import { getMapPointDetails } from "../actions";
import { matchOverlay, type OverlayMatch } from "../overlay/match-overlay";
import { ThreeMapRenderer, projectToScreen } from "../renderer";
import type { MapRenderer, RenderMode } from "../renderer";
import { toRenderModel } from "../to-render-model";
import type { MapData, MapOverlay, MapPointDetail } from "../types";

import { MapModeToggle } from "./map-mode-toggle";
import { MapPointPanel } from "./map-point-panel";
import { MapRegionLabels, type ProjectedLabel } from "./map-region-labels";

const MODE_KEY = "semantic-map:mode";

export default function SemanticMapView({ data, overlay }: { data: MapData; overlay?: MapOverlay }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Тип рефа — ПОРТ MapRenderer (не конкретный ThreeMapRenderer): своп рисовалки
  // меняет только `new ThreeMapRenderer()`, не UI.
  const rendererRef = useRef<MapRenderer | null>(null);
  const [mode, setMode] = useState<RenderMode>(() => readSavedMode(MODE_KEY));
  // modeRef синхронизирован с mode (тот же восстановленный старт) — lifecycle-эффект
  // ([model]) применяет актуальный режим после пере-создания рендерера при смене data.
  const modeRef = useRef<RenderMode>(readSavedMode(MODE_KEY));
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const [selected, setSelected] = useState<MapPointDetail | null>(null);
  // documents (id→title) с контракта layout; фолбэк {} — поле optional.
  const documents = data.documents ?? {};
  const model = useMemo(() => toRenderModel(data), [data]);

  // Матч хитов поиска с точками карты по doc (chunk-shift: хиты несут id документов,
  // точки — чанки); маркер = score-взвешенный центроид совпавших. Логика — в matchOverlay.
  const matched = useMemo<OverlayMatch | null>(
    () => (overlay ? matchOverlay(model, overlay) : null),
    [overlay, model],
  );
  // Актуальный matched в ref — чтобы lifecycle-эффект ([model]) применял overlay к
  // пере-созданному рендереру, не добавляя matched в свои deps.
  const matchedRef = useRef<OverlayMatch | null>(null);
  matchedRef.current = matched;

  const t = useT("semanticMap");

  const reduce = useReducedMotion();
  // reduceRef: актуальный reduce для lifecycle-эффекта [model] БЕЗ добавления его в
  // deps. Иначе cleanup эффекта (r.destroy()) пересоздавал бы WebGL-рендерер и сбрасывал
  // камеру на каждый тогл движения. Тот же escape-hatch, что matchedRef/modeRef.
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  // Жизненный цикл рендерера.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    setSelected(null); // смена модели сбрасывает выбор (точки прежней раскладки исчезли)

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

    // Picking: клик по точке → fetch одной детали → панель. Гонку (быстрые клики)
    // гасим request-id'ом. pickSeq локален эффекту — на пере-маунте сбрасывается.
    let pickSeq = 0;
    // onPick — опциональная способность порта MapRenderer (рисовалка может не
    // поддерживать picking); `?.` уважает контракт. ThreeMapRenderer его реализует.
    r.onPick?.((id) => {
      const seq = ++pickSeq;
      if (!id) {
        setSelected(null);
        return;
      }
      void getMapPointDetails([id]).then((res) => {
        if (seq !== pickSeq) return; // устаревший ответ — игнор
        // id отсутствует в карте (приватный/неизвестный чанк) → деталь не показываем.
        setSelected(res.success ? res.data[id] ?? null : null);
      });
    });

    r.setModel(model);
    r.setMode(modeRef.current); // применить текущий/восстановленный режим (переживает смену data)
    r.setReducedMotion(reduceRef.current); // применить к свежему рендереру (переживает смену data)
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

  // Рантайм-смена настройки движения → применить к существующему рендереру.
  useEffect(() => {
    rendererRef.current?.setReducedMotion(reduce);
  }, [reduce]);

  // Применять overlay при смене matched (и переживает пере-маунт через тот же эффект [model] ниже).
  useEffect(() => {
    rendererRef.current?.setOverlay(
      matched ? { highlightIds: matched.highlightIds, marker: matched.marker } : null,
    );
  }, [matched]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <SceneCanvasIsolation>
        <canvas ref={canvasRef} className="block h-full w-full" />
        <MapRegionLabels labels={labels} />
      </SceneCanvasIsolation>
      <div className="absolute end-3 top-3">
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
      {selected && (
        <MapPointPanel
          detail={selected}
          documents={documents}
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
