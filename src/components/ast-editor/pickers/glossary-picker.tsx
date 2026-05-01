"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchGlossary, type GlossaryTerm } from "./actions";

export interface GlossaryPickerProps { onSelect: (id: string) => void }

export function GlossaryPicker({ onSelect }: GlossaryPickerProps) {
  return (
    <AsyncCombobox<GlossaryTerm>
      fetcher={searchGlossary}
      renderItem={(g) => <span>{g.title ?? "—"}</span>}
      getKey={(g) => g.id ?? ""}
      onSelect={(g) => g.id && onSelect(g.id)}
      placeholder="Поиск термина…"
    />
  );
}
