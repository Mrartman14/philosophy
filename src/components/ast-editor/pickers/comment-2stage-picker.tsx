"use client";
import { useState } from "react";

import { CommentPicker } from "./comment-picker";
import { LecturePicker } from "./lecture-picker";

export interface Comment2StagePickerProps {
  defaultLectureId?: string | undefined;
  onSelect: (commentId: string, label: string) => void;
}

export function Comment2StagePicker({ defaultLectureId, onSelect }: Comment2StagePickerProps) {
  const [lectureId, setLectureId] = useState<string | undefined>(defaultLectureId);

  if (!lectureId) {
    return (
      <div>
        <p>Шаг 1: выберите лекцию</p>
        <LecturePicker onSelect={(id) => { setLectureId(id); }} />
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={() => { setLectureId(undefined); }}>← Сменить лекцию</button>
      <p>Шаг 2: выберите комментарий</p>
      <CommentPicker lectureId={lectureId} onSelect={onSelect} />
    </div>
  );
}
