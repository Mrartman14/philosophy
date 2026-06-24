"use client";
// src/components/annotation-layer/use-selection-capture.ts
import { useEffect, useRef, useState, type RefObject } from "react";

import { anchorFromSelection } from "./anchor-from-selection";
import type { AnchorDraft } from "./types";

// Дебаунс пересчёта якоря после selectionchange (drag-выделение шлёт залп событий).
const SELECTION_DEBOUNCE_MS = 250;

export function useSelectionCapture({
  rootRef,
  enabled,
}: {
  rootRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  const [draft, setDraft] = useState<AnchorDraft | null>(null);
  const suppress = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recompute = () => {
      const root = rootRef.current;
      if (!root) {
        setDraft(null);
        return;
      }
      const sel = window.getSelection();
      // AST-рамка (устрожение): выделение вне контент-рута даже не обрабатываем —
      // обе границы обязаны быть внутри AST-рута. Это гейт ПЕРВЫМ, до построения якоря.
      if (!sel) {
        setDraft(null);
        return;
      }
      const { anchorNode, focusNode } = sel;
      if (
        !anchorNode ||
        !focusNode ||
        !root.contains(anchorNode) ||
        !root.contains(focusNode)
      ) {
        setDraft(null);
        return;
      }
      const anchor = anchorFromSelection(sel, root);
      if (!anchor || sel.rangeCount === 0) {
        setDraft(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setDraft({ anchor, rect });
    };
    const onSelectionChange = () => {
      if (suppress.current) {
        suppress.current = false;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, SELECTION_DEBOUNCE_MS);
    };
    const onPointerUp = () => {
      if (timer) clearTimeout(timer);
      recompute();
    };
    const onScrollResize = () => {
      setDraft(null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("touchend", onPointerUp);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [enabled, rootRef]);

  const clear = () => {
    suppress.current = true;
    window.getSelection()?.removeAllRanges();
    setDraft(null);
  };
  return { draft, clear };
}
