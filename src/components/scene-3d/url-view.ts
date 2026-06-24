// src/components/scene-3d/url-view.ts
// Чистая сериализация ВИДА сцены (камера ↔ URL-параметры m/c) — общая для карты и графа.
// Живёт в scene-3d (не @/utils): это shared-сериализация именно вида сцены; Guardrail 9
// запрещает фиче владеть общим кодом. Единственная impure-функция — writeViewToUrl (window.history).
import type { CameraState, SceneRenderMode } from "./scene-renderer";

export type { CameraState } from "./scene-renderer";

export interface ParsedView {
  mode: SceneRenderMode | null;
  camera: CameraState | null;
}

/** `m` и `c` парсятся НЕЗАВИСИМО: валидный `m` без `c` — легитимная ссылка «открыть в режиме, авто-fit». */
export function parseView(params: { m?: string; c?: string }): ParsedView {
  const mode: SceneRenderMode | null =
    params.m === "2d" || params.m === "3d" ? params.m : null;
  let camera: CameraState | null = null;
  if (mode && params.c) {
    const values = params.c.split(",").map(Number);
    const expected = mode === "2d" ? 3 : 6;
    const lengthOk = values.length === expected;
    const allFinite = values.every((n) => Number.isFinite(n));
    // 2D zoom — values[2]; <=0 даст деление на ноль в орто-проекции.
    const zoomOk = mode === "3d" || (values[2] ?? 0) > 0;
    if (lengthOk && allFinite && zoomOk) camera = { mode, values };
  }
  return { mode, camera };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  const v = Math.round(n * f) / f;
  return Object.is(v, -0) ? 0 : v;
}

export function formatView(state: CameraState): { m: string; c: string } {
  const vals =
    state.mode === "2d"
      ? [round(state.values[0] ?? 0, 4), round(state.values[1] ?? 0, 4), round(state.values[2] ?? 1, 3)]
      : state.values.map((n) => round(n, 4));
  return { m: state.mode, c: vals.join(",") };
}

/** Shallow-запись вида в URL: мёрж в текущий search (сохраняя q и прочее) + сохранение hash. */
export function writeViewToUrl(state: CameraState): void {
  const { m, c } = formatView(state);
  const params = new URLSearchParams(window.location.search);
  params.set("m", m);
  params.set("c", c);
  const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, "", url);
}
