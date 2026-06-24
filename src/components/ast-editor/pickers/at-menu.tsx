// src/components/ast-editor/pickers/at-menu.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useMemo, useState } from "react";

import { caretVirtualElement } from "../caret-anchor";

import {
  atSuggestionKey,
  closeAtSuggestion,
  consumeAtMarker,
  type AtSuggestionState,
} from "./at-suggestion-plugin";
import { RefPicker } from "./ref-picker";

interface Props {
  editor: Editor;
  defaultLectureId?: string | undefined;
}

/**
 * Inline-обёртка RefPicker для @-suggestion. Требует createAtSuggestionPlugin
 * в extensions редактора (atHost в ast-editor.tsx).
 *
 * Источник истины — плагин-состояние {open, from}: `open` контролируем им,
 * `onOpenChange(false)` (Escape / клик вне) закрывает состояние и возвращает
 * фокус в редактор. Позиционирование под каретку, портал, коллизии (flip/shift),
 * управление фокусом и Escape владеет сам RefPicker (один scoped Base UI
 * Combobox): AtMenu лишь прокидывает `open`/`anchor`/`onOpenChange`/`onWillInsert`.
 *
 * Якорь — virtual-anchor каретки (caretVirtualElement → coordsAtPos), поэтому
 * пикер портализуется на body и не рендерится статикой в потоке под контентом.
 * `onWillInsert` синхронно удаляет напечатанный "@"-маркер перед вставкой марки.
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

  // Virtual-anchor каретки для Positioner. Пересчёт при сдвиге позиции "@"
  // (state.from); scroll/resize floating-ui отслеживает сам.
  const anchor = useMemo(
    () => caretVirtualElement(editor, state.from),
    [editor, state.from],
  );

  return (
    <RefPicker
      editor={editor}
      defaultLectureId={defaultLectureId}
      open={state.open}
      onOpenChange={(open) => {
        if (!open) {
          closeAtSuggestion(editor.view);
          editor.commands.focus();
        }
      }}
      anchor={anchor}
      onWillInsert={() => { consumeAtMarker(editor.view, state.from); }}
    />
  );
}
