"use client";
import { useT } from "@/i18n/client";

import { searchDocuments, type DocumentSummary } from "./actions";
import { AsyncCombobox } from "./async-combobox";

export interface DocumentPickerProps { onSelect: (id: string, label: string) => void }

export function DocumentPicker({ onSelect }: DocumentPickerProps) {
  const t = useT("editor");
  return (
    <AsyncCombobox<DocumentSummary>
      fetcher={searchDocuments}
      renderItem={(d) => <span>{d.filename ?? "—"}</span>}
      getKey={(d) => d.id ?? ""}
      onSelect={(d) => { if (d.id) onSelect(d.id, d.filename ?? d.id); }}
      placeholder={t("documentPlaceholder")}
    />
  );
}
