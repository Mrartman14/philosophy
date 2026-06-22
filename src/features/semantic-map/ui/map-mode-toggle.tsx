"use client";
// src/features/semantic-map/ui/map-mode-toggle.tsx
// Адаптер: namespace semanticMap + storageKey карты → общий SceneModeToggle.
import { SceneModeToggle } from "@/components/scene-3d";
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
    <SceneModeToggle
      mode={mode}
      onChange={onChange}
      ariaLabel={t("dimensionAriaLabel")}
      storageKey="semantic-map:mode"
    />
  );
}
