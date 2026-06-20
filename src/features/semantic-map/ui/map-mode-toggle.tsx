"use client";
// src/features/semantic-map/ui/map-mode-toggle.tsx
import { Button } from "@/components/ui";

import type { RenderMode } from "../renderer";

export function MapModeToggle({
  mode,
  onChange,
}: {
  mode: RenderMode;
  onChange: (m: RenderMode) => void;
}) {
  return (
    // i18n: aria-label «Размерность карты» вынести в namespace semanticMap при интеграции
    <div
      role="group"
      aria-label="Размерность карты"
      className="inline-flex gap-1 rounded-md bg-(--color-surface) p-1 shadow"
    >
      {(["2d", "3d"] as const).map((m) => (
        <Button
          key={m}
          size="sm"
          variant={mode === m ? "primary" : "ghost"}
          aria-pressed={mode === m}
          onClick={() => { onChange(m); }}
        >
          {m.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
