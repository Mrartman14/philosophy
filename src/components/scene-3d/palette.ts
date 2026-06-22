// src/components/scene-3d/palette.ts
// Цветовые утилиты 3D-сцены: hex → нормализованные GL-компоненты (0..1).
// Используется и картой, и графом — кластерная палитра карты живёт в её слайсе.

/** "#rrggbb" → [r, g, b] в диапазоне 0..1. */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
