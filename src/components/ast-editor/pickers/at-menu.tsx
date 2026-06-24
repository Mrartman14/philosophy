// src/components/ast-editor/pickers/at-menu.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useMemo, useState } from "react";

import { Popover } from "@/components/ui";

import { caretVirtualElement } from "../caret-anchor";

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
 * в extensions редактора (atHost в ast-editor.tsx).
 *
 * Позиционирование под каретку, портал, коллизии (flip/shift), управление фокусом
 * и Escape делегированы Base UI Popover (как у тулбарного RefPopover) — меню
 * якорится к каретке через virtual-anchor (caretVirtualElement → coordsAtPos),
 * больше не рендерится статикой в потоке под контентом.
 *
 * Источник истины — плагин-состояние {open, from}: `open` контролируем им,
 * `onOpenChange(false)` (Escape / клик вне / вставка) закрывает состояние и
 * возвращает фокус в редактор. Initial-focus в меню и Escape Base UI делает сам,
 * поэтому собственных rAF-фокуса и document-listener'ов здесь больше нет.
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
    <Popover.Root
      open={state.open}
      onOpenChange={(open) => {
        if (!open) {
          closeAtSuggestion(editor.view);
          editor.commands.focus();
        }
      }}
    >
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="bottom" align="start" sideOffset={4}>
          <Popover.Popup className="p-1 min-w-[320px] max-w-[480px]">
            <RefMenu
              editor={editor}
              defaultLectureId={defaultLectureId}
              onWillInsert={() => { consumeAtMarker(editor.view, state.from); }}
              onClose={() => { closeAtSuggestion(editor.view); }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
