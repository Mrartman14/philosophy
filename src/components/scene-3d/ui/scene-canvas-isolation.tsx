// src/components/scene-3d/ui/scene-canvas-isolation.tsx
import type { ReactNode } from "react";

// dir=ltr изолирует 3D-сцену: WebGL-холст и region-labels (позиция через
// inline left:x — canvas-координаты) НЕ зеркалятся в RTL. Оверлеи остаются
// СНАРУЖИ этой обёртки и зеркалятся вместе со страницей. absolute inset-0 = бокс
// родителя, поэтому размер холста (ResizeObserver на родителе) не меняется.
export function SceneCanvasIsolation({ children }: { children: ReactNode }) {
  return (
    <div data-scene-canvas dir="ltr" className="absolute inset-0">
      {children}
    </div>
  );
}
