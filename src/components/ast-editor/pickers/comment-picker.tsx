"use client";
import { useCallback } from "react";
import { AsyncCombobox } from "./async-combobox";
import { searchCommentsByLecture, type CommentSummary } from "./actions";

export interface CommentPickerProps {
  lectureId: string;
  onSelect: (id: string) => void;
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
      onSelect={(c) => c.id && onSelect(c.id)}
      placeholder="Поиск комментария в выбранной лекции…"
    />
  );
}
