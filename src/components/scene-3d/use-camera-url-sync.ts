"use client";
// src/components/scene-3d/use-camera-url-sync.ts
// Общая камера-URL обвязка map/graph view: режим (URL∥localStorage, H1), restore камеры,
// запись вида по оседанию жеста и по тоглу режима. Вынесено из двух почти идентичных view.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { SceneRenderer, SceneRenderMode } from "./scene-renderer";
import { readSavedMode } from "./ui/scene-mode-toggle";
import { writeViewToUrl, type ParsedView } from "./url-view";

export interface CameraUrlSync {
  mode: SceneRenderMode;
  setMode: (m: SceneRenderMode) => void;
  modeRef: RefObject<SceneRenderMode>;
  /** Вызвать ВНУТРИ lifecycle-эффекта view ПОСЛЕДНИМ камера-шагом на свежем рендерере. */
  wireCamera: (r: SceneRenderer) => void;
}

export function useCameraUrlSync<R extends SceneRenderer>(
  modeKey: string,
  initialView: ParsedView,
  rendererRef: RefObject<R | null>,
): CameraUrlSync {
  // URL побеждает localStorage (H1) — и useState (тогл-UI), и modeRef (guard applyCamera).
  const [mode, setMode] = useState<SceneRenderMode>(() => initialView.mode ?? readSavedMode(modeKey));
  const modeRef = useRef<SceneRenderMode>(initialView.mode ?? readSavedMode(modeKey));
  // Актуальный initialView для wireCamera без добавления в deps lifecycle-эффекта view.
  const initialViewRef = useRef(initialView);
  useEffect(() => {
    initialViewRef.current = initialView;
  }, [initialView]);
  // Пропуск записи на ПЕРВОМ прогоне mode-эффекта (маунт) — не затереть восстановленный URL.
  const modeWriteSkip = useRef(true);

  useEffect(() => {
    modeRef.current = mode;
    rendererRef.current?.setMode(mode);
    window.localStorage.setItem(modeKey, mode);
    if (modeWriteSkip.current) {
      modeWriteSkip.current = false;
      return;
    }
    const v = rendererRef.current?.getCamera();
    if (v) writeViewToUrl(v);
  }, [mode, modeKey, rendererRef]);

  const wireCamera = useCallback((r: SceneRenderer) => {
    r.onSettle(() => {
      const v = r.getCamera();
      if (v) writeViewToUrl(v);
    });
    const cam0 = initialViewRef.current.camera;
    if (cam0) r.applyCamera(cam0);
  }, []);

  return { mode, setMode, modeRef, wireCamera };
}
