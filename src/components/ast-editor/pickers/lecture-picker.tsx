"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchLectures, type Lecture } from "./actions";

export interface LecturePickerProps { onSelect: (id: string, label: string) => void }

export function LecturePicker({ onSelect }: LecturePickerProps) {
  return (
    <AsyncCombobox<Lecture>
      fetcher={searchLectures}
      renderItem={(l) => <span>{l.title || "—"}</span>}
      getKey={(l) => l.id}
      onSelect={(l) => onSelect(l.id, l.title || l.id)}
      placeholder="Поиск лекции…"
    />
  );
}
