"use client";
import { useCallback, useState } from "react";
import { AsyncCombobox } from "./async-combobox";
import { searchMedia, type MediaSummary } from "./actions";

export interface MediaPickerProps { onSelect: (id: string, label: string) => void }

export function MediaPicker({ onSelect }: MediaPickerProps) {
  const [type, setType] = useState<"video" | "audio" | undefined>(undefined);
  const fetcher = useCallback(
    (q: string, offset: number, limit: number) => searchMedia(q, offset, limit, type),
    [type],
  );
  return (
    <div>
      <fieldset>
        <legend>Тип</legend>
        <label><input type="radio" name="media-type" checked={type === undefined} onChange={() => { setType(undefined); }} /> все</label>
        <label><input type="radio" name="media-type" checked={type === "video"} onChange={() => { setType("video"); }} /> видео</label>
        <label><input type="radio" name="media-type" checked={type === "audio"} onChange={() => { setType("audio"); }} /> аудио</label>
      </fieldset>
      <AsyncCombobox<MediaSummary>
        fetcher={fetcher}
        renderItem={(m) => <span>{m.filename ?? "—"}</span>}
        getKey={(m) => m.id ?? ""}
        onSelect={(m) => { if (m.id) onSelect(m.id, m.filename ?? m.id); }}
        placeholder="Поиск медиа…"
      />
    </div>
  );
}
