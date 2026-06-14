"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchDocuments, type DocumentSummary } from "./actions";

export interface DocumentPickerProps { onSelect: (id: string, label: string) => void }

export function DocumentPicker({ onSelect }: DocumentPickerProps) {
  return (
    <AsyncCombobox<DocumentSummary>
      fetcher={searchDocuments}
      renderItem={(d) => <span>{d.filename ?? "—"}</span>}
      getKey={(d) => d.id ?? ""}
      onSelect={(d) => { if (d.id) onSelect(d.id, d.filename ?? d.id); }}
      placeholder="Поиск документа…"
    />
  );
}
