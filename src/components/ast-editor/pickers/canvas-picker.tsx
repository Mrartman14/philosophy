"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchCanvases, type CanvasSummary } from "./actions";

export interface CanvasPickerProps { onSelect: (id: string, label: string) => void }

export function CanvasPicker({ onSelect }: CanvasPickerProps) {
  return (
    <AsyncCombobox<CanvasSummary>
      fetcher={searchCanvases}
      renderItem={(c) => <span>{c.title ?? "—"}</span>}
      getKey={(c) => c.id ?? ""}
      onSelect={(c) => { if (c.id) onSelect(c.id, c.title ?? c.id); }}
      placeholder="Поиск canvas…"
    />
  );
}
