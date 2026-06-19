"use client";
import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { Comment2StagePicker } from "./comment-2stage-picker";
import { DocumentPicker } from "./document-picker";
import { GlossaryPicker } from "./glossary-picker";
import { LecturePicker } from "./lecture-picker";
import { MediaPicker } from "./media-picker";

// canvas вне скоупа программы покрытия (спека 2026-06-12 §4): CanvasPicker
// остаётся в репо dormant (pickers/canvas-picker.tsx), в меню не подключён,
// canvas_ref в редакторе зарегистрирован только ради round-trip контента.
type Category = "lecture" | "glossary" | "document" | "media" | "comment";

const MARK_FOR: Record<Category, string> = {
  lecture: "lecture_ref",
  glossary: "glossary_ref",
  document: "document_ref",
  media: "media_ref",
  comment: "comment_ref",
};

const labels: Record<Category, string> = {
  lecture: "Лекция",
  glossary: "Термин",
  document: "Документ",
  media: "Медиа",
  comment: "Комментарий",
};

export interface RefMenuProps {
  editor: Editor;
  defaultLectureId?: string | undefined;
  onClose?: () => void;
  /**
   * Вызывается синхронно ПЕРЕД вставкой mark. @-suggestion (AtMenu) удаляет
   * здесь "@"-маркер из документа; selection после удаления схлопывается в
   * позицию маркера, и вставка label-текста попадает ровно туда.
   */
  onWillInsert?: () => void;
}

export function RefMenu({ editor, defaultLectureId, onClose, onWillInsert }: RefMenuProps) {
  const [cat, setCat] = useState<Category | null>(null);

  const apply = (markName: string, id: string, label: string) => {
    onWillInsert?.();
    const empty = editor.state.selection.empty;
    if (empty) {
      // Collapsed selection — insert the human-readable label as text carrying
      // the mark; otherwise setMark only goes into storedMarks and the user
      // sees no visible nav-ref. Same pattern as LinkPopover (toolbar).
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [{ type: markName, attrs: { id } }],
        })
        .run();
    } else {
      editor.chain().focus().setMark(markName, { id }).run();
    }
    onClose?.();
  };

  const onSelect = (id: string, label: string) => {
    if (cat) apply(MARK_FOR[cat], id, label);
  };

  return (
    <div className="ref-menu" role="dialog" aria-label="Вставить ссылку">
      <div className="flex gap-1 p-1 gap-1">
        {(Object.keys(MARK_FOR) as Category[]).map((c) => (
          <Button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => { setCat(c); }}
            variant={cat === c ? "primary" : "secondary"}
          >
            {labels[c]}
          </Button>
        ))}
      </div>
      <div>
        {cat === "lecture" && <LecturePicker onSelect={onSelect} />}
        {cat === "glossary" && <GlossaryPicker onSelect={onSelect} />}
        {cat === "document" && <DocumentPicker onSelect={onSelect} />}
        {cat === "media" && <MediaPicker onSelect={onSelect} />}
        {cat === "comment" && (
          <Comment2StagePicker defaultLectureId={defaultLectureId} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
