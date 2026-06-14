// src/components/ast-editor/pickers/at-menu.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";

import {
  atSuggestionKey,
  closeAtSuggestion,
  consumeAtMarker,
  type AtSuggestionState,
} from "./at-suggestion-plugin";
import { RefMenu } from "./ref-menu";

interface Props {
  editor: Editor;
  defaultLectureId?: string | undefined;
}

/**
 * Inline-обёртка RefMenu для @-suggestion. Требует createAtSuggestionPlugin
 * в extensions редактора (atHost в ast-editor.tsx). MVP: панель рендерится
 * под редактором (как slash-menu); позиционирование под курсор — follow-up.
 */
export function AtMenu({ editor, defaultLectureId }: Props) {
  const [state, setState] = useState<AtSuggestionState>({
    open: false,
    from: -1,
    query: "",
  });

  useEffect(() => {
    const upd = () => {
      const s = atSuggestionKey.getState(editor.view.state);
      if (s) setState(s);
    };
    editor.on("transaction", upd);
    return () => {
      editor.off("transaction", upd);
    };
  }, [editor]);

  if (!state.open) return null;

  return (
    <div className="ast-at-menu" data-at-menu="">
      <RefMenu
        editor={editor}
        defaultLectureId={defaultLectureId}
        onWillInsert={() => { consumeAtMarker(editor.view, state.from); }}
        onClose={() => { closeAtSuggestion(editor.view); }}
      />
    </div>
  );
}
