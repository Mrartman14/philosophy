"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchDocuments, type DocumentSummary } from "./actions";

export interface DocumentPickerProps { onSelect: (id: string) => void }

export function DocumentPicker({ onSelect }: DocumentPickerProps) {
  return (
    <AsyncCombobox<DocumentSummary>
      fetcher={searchDocuments}
      renderItem={(d) => <span>{d.filename ?? "—"}</span>}
      getKey={(d) => d.id ?? ""}
      onSelect={(d) => d.id && onSelect(d.id)}
      placeholder="Поиск документа…"
    />
  );
}
