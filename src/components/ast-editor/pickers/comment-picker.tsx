"use client";
import { useCallback } from "react";
import { AsyncCombobox } from "./async-combobox";
import { searchCommentsByLecture, type CommentSummary } from "./actions";

export interface CommentPickerProps {
  lectureId: string;
  onSelect: (id: string, label: string) => void;
}

export function CommentPicker({ lectureId, onSelect }: CommentPickerProps) {
  const fetcher = useCallback(
    (q: string, offset: number, limit: number) => searchCommentsByLecture(lectureId, q, offset, limit),
    [lectureId],
  );
  return (
    <AsyncCombobox<CommentSummary>
      fetcher={fetcher}
      renderItem={(c) => <span>{c.snippet ?? "—"}</span>}
      getKey={(c) => c.id ?? ""}
      onSelect={(c) => { if (c.id) onSelect(c.id, c.snippet ?? c.id); }}
      placeholder="Поиск комментария в выбранной лекции…"
    />
  );
}
