// src/components/ast-editor/pickers/at-menu.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";

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
 *
 * Focus management (scoped to AtMenu only — NOT inside shared RefMenu):
 * - On open: focuses the first category button inside the wrapper via wrapperRef.
 * - Escape: closes the suggestion state and restores focus to the editor.
 *   Uses a document capture-phase listener (same pattern as SlashMenu) so it
 *   intercepts Escape regardless of which element inside the menu has focus.
 * No Tab trap: this is a non-modal inline sibling, not a modal dialog.
 */
export function AtMenu({ editor, defaultLectureId }: Props) {
  const [state, setState] = useState<AtSuggestionState>({
    open: false,
    from: -1,
    query: "",
  });

  // Ref on the AtMenu wrapper — used to focus the first category button on open.
  // Scoped to AtMenu; RefMenu and RefPopover are not touched.
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Move initial focus into the menu when it opens.
  // We query the wrapper for the first button (the category buttons rendered by RefMenu).
  // This is scoped to the AtMenu wrapper and does NOT change RefMenu's behavior for
  // the RefPopover path (Base UI Popover already manages focus there).
  useEffect(() => {
    if (!state.open) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    // Use rAF so the DOM is fully painted before we attempt to focus.
    const rafId = requestAnimationFrame(() => {
      const firstButton = wrapper.querySelector<HTMLElement>("button,[role='button']");
      firstButton?.focus();
    });
    return () => { cancelAnimationFrame(rafId); };
  }, [state.open]);

  // Escape: close + restore editor focus.
  // Document capture-phase listener intercepts Escape regardless of which element
  // inside the menu has focus (category buttons, combobox inputs, etc.).
  // We only act when the event originated inside our wrapper (event.target check)
  // or focus is there (document.activeElement fallback) to avoid interfering with
  // other menus/popovers that handle their own Escape (e.g. RefPopover via Base UI).
  useEffect(() => {
    if (!state.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      // Intercept Escape when the event target is inside the AtMenu wrapper, OR
      // when focus is inside the wrapper (covers synthetic events from tests that
      // use document.activeElement rather than event.target).
      const eventInside = e.target instanceof Node && wrapper.contains(e.target);
      const focusInside = wrapper.contains(document.activeElement);
      if (!eventInside && !focusInside) return;
      e.preventDefault();
      e.stopPropagation();
      closeAtSuggestion(editor.view);
      editor.commands.focus();
    };
    document.addEventListener("keydown", handler, true);
    return () => { document.removeEventListener("keydown", handler, true); };
  }, [state.open, editor]);

  if (!state.open) return null;

  return (
    <div ref={wrapperRef} className="ast-at-menu" data-at-menu="">
      <RefMenu
        editor={editor}
        defaultLectureId={defaultLectureId}
        onWillInsert={() => { consumeAtMarker(editor.view, state.from); }}
        onClose={() => { closeAtSuggestion(editor.view); }}
      />
    </div>
  );
}
