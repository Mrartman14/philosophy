"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { LecturePicker } from "./lecture-picker";
import { GlossaryPicker } from "./glossary-picker";
import { DocumentPicker } from "./document-picker";
import { MediaPicker } from "./media-picker";
import { CanvasPicker } from "./canvas-picker";
import { Comment2StagePicker } from "./comment-2stage-picker";

type Category = "lecture" | "glossary" | "document" | "media" | "canvas" | "comment";

const MARK_FOR: Record<Category, string> = {
  lecture: "lecture_ref",
  glossary: "glossary_ref",
  document: "document_ref",
  media: "media_ref",
  canvas: "canvas_ref",
  comment: "comment_ref",
};

const labels: Record<Category, string> = {
  lecture: "Лекция",
  glossary: "Термин",
  document: "Документ",
  media: "Медиа",
  canvas: "Canvas",
  comment: "Комментарий",
};

export interface RefMenuProps {
  editor: Editor;
  defaultLectureId?: string | undefined;
  onClose?: () => void;
}

export function RefMenu({ editor, defaultLectureId, onClose }: RefMenuProps) {
  const [cat, setCat] = useState<Category | null>(null);

  const apply = (markName: string, id: string) => {
    editor.chain().focus().setMark(markName, { id }).run();
    onClose?.();
  };

  const onSelect = (id: string) => {
    if (cat) apply(MARK_FOR[cat], id);
  };

  return (
    <div className="ref-menu" role="dialog" aria-label="Вставить ссылку">
      <div className="ref-menu__cats">
        {(Object.keys(MARK_FOR) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
          >
            {labels[c]}
          </button>
        ))}
      </div>
      <div className="ref-menu__picker">
        {cat === "lecture" && <LecturePicker onSelect={onSelect} />}
        {cat === "glossary" && <GlossaryPicker onSelect={onSelect} />}
        {cat === "document" && <DocumentPicker onSelect={onSelect} />}
        {cat === "media" && <MediaPicker onSelect={onSelect} />}
        {cat === "canvas" && <CanvasPicker onSelect={onSelect} />}
        {cat === "comment" && (
          <Comment2StagePicker defaultLectureId={defaultLectureId} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
