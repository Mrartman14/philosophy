"use client";
import { useT } from "@/i18n/client";

import { searchLectures, type Lecture } from "./actions";
import { AsyncCombobox } from "./async-combobox";

export interface LecturePickerProps { onSelect: (id: string, label: string) => void }

export function LecturePicker({ onSelect }: LecturePickerProps) {
  const t = useT("editor");
  return (
    <AsyncCombobox<Lecture>
      fetcher={searchLectures}
      renderItem={(l) => <span>{l.title || "—"}</span>}
      getKey={(l) => l.id}
      onSelect={(l) => { onSelect(l.id, l.title || l.id); }}
      placeholder={t("lecturePlaceholder")}
    />
  );
}
