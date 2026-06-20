"use client";
// src/features/semantic-map/ui/map-mode-toggle.tsx
import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { RenderMode } from "../renderer";

export function MapModeToggle({
  mode,
  onChange,
}: {
  mode: RenderMode;
  onChange: (m: RenderMode) => void;
}) {
  const t = useT("semanticMap");
  return (
    <div
      role="group"
      aria-label={t("dimensionAriaLabel")}
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
