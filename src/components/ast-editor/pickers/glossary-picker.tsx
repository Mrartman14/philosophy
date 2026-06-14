"use client";
import { searchGlossary, type GlossaryTerm } from "./actions";
import { AsyncCombobox } from "./async-combobox";

export interface GlossaryPickerProps { onSelect: (id: string, label: string) => void }

export function GlossaryPicker({ onSelect }: GlossaryPickerProps) {
  return (
    <AsyncCombobox<GlossaryTerm>
      fetcher={searchGlossary}
      renderItem={(g) => <span>{g.title ?? "—"}</span>}
      getKey={(g) => g.id ?? ""}
      onSelect={(g) => { if (g.id) onSelect(g.id, g.title ?? g.id); }}
      placeholder="Поиск термина…"
    />
  );
}
