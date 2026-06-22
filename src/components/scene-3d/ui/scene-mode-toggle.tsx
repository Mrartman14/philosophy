"use client";
// src/components/scene-3d/ui/scene-mode-toggle.tsx
// i18n-agnostic тоггл 2D/3D: лейблы/ariaLabel приходят пропами. Персист режима живёт во view
// (через readSavedMode + localStorage), сам тоггл состояние не хранит.
import { Button } from "@/components/ui";

import type { SceneRenderMode } from "../scene-renderer";

/** Восстановить сохранённый режим по storageKey (клиент). Дефолт — "2d". */
export function readSavedMode(storageKey: string): SceneRenderMode {
  const saved =
    typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
  return saved === "2d" || saved === "3d" ? saved : "2d";
}

export function SceneModeToggle({
  mode,
  onChange,
  ariaLabel,
}: {
  mode: SceneRenderMode;
  onChange: (m: SceneRenderMode) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-md bg-(--color-surface) p-1 shadow"
    >
      {(["2d", "3d"] as const).map((m) => (
        <Button
          key={m}
          compact
          tone={mode === m ? "primary" : "quiet"}
          aria-pressed={mode === m}
          onClick={() => { onChange(m); }}
        >
          {m.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
