"use client";
import { useState } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import { CommentPicker } from "./comment-picker";
import { LecturePicker } from "./lecture-picker";

export interface Comment2StagePickerProps {
  defaultLectureId?: string | undefined;
  onSelect: (commentId: string, label: string) => void;
}

export function Comment2StagePicker({ defaultLectureId, onSelect }: Comment2StagePickerProps) {
  const t = useT("editor");
  const [lectureId, setLectureId] = useState<string | undefined>(defaultLectureId);

  if (!lectureId) {
    return (
      <div>
        <p>{t("commentPickerStep1")}</p>
        <LecturePicker onSelect={(id) => { setLectureId(id); }} />
      </div>
    );
  }
  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => { setLectureId(undefined); }}>{t("commentPickerChangeLecture")}</Button>
      <p>{t("commentPickerStep2")}</p>
      <CommentPicker lectureId={lectureId} onSelect={onSelect} />
    </div>
  );
}
