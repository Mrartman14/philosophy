"use client";
import { useT } from "@/i18n/client";

import { searchCanvases, type CanvasSummary } from "./actions";
import { AsyncCombobox } from "./async-combobox";

export interface CanvasPickerProps { onSelect: (id: string, label: string) => void }

export function CanvasPicker({ onSelect }: CanvasPickerProps) {
  const t = useT("editor");
  return (
    <AsyncCombobox<CanvasSummary>
      fetcher={searchCanvases}
      renderItem={(c) => <span>{c.title ?? "—"}</span>}
      getKey={(c) => c.id ?? ""}
      onSelect={(c) => { if (c.id) onSelect(c.id, c.title ?? c.id); }}
      placeholder={t("canvasPlaceholder")}
    />
  );
}
