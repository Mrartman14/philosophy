"use client";
import { useCallback, useState } from "react";

import { useT } from "@/i18n/client";

import { searchMedia, type MediaSummary } from "./actions";
import { AsyncCombobox } from "./async-combobox";

export interface MediaPickerProps { onSelect: (id: string, label: string) => void }

export function MediaPicker({ onSelect }: MediaPickerProps) {
  const t = useT("editor");
  const [type, setType] = useState<"video" | "audio" | undefined>(undefined);
  const fetcher = useCallback(
    (q: string, offset: number, limit: number) => searchMedia(q, offset, limit, type),
    [type],
  );
  return (
    <div>
      <fieldset>
        <legend>{t("mediaTypeLabel")}</legend>
        <label><input type="radio" name="media-type" checked={type === undefined} onChange={() => { setType(undefined); }} /> {t("mediaTypeAll")}</label>
        <label><input type="radio" name="media-type" checked={type === "video"} onChange={() => { setType("video"); }} /> {t("mediaTypeVideo")}</label>
        <label><input type="radio" name="media-type" checked={type === "audio"} onChange={() => { setType("audio"); }} /> {t("mediaTypeAudio")}</label>
      </fieldset>
      <AsyncCombobox<MediaSummary>
        fetcher={fetcher}
        renderItem={(m) => <span>{m.filename ?? "—"}</span>}
        getKey={(m) => m.id ?? ""}
        onSelect={(m) => { if (m.id) onSelect(m.id, m.filename ?? m.id); }}
        placeholder={t("mediaPlaceholder")}
      />
    </div>
  );
}
