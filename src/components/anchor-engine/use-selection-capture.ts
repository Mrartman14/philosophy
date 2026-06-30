"use client";
// src/components/anchor-engine/use-selection-capture.ts
import { useEffect, useRef, useState } from "react";

import { anchorFromSelection } from "./anchor-from-selection";
import { scopeFromSelection } from "./scope-from-selection";
import type { AnchorDraft } from "./types";

// Дебаунс пересчёта якоря после selectionchange (drag-выделение шлёт залп событий).
const SELECTION_DEBOUNCE_MS = 250;

export function useSelectionCapture({ enabled }: { enabled: boolean }) {
  const [draft, setDraft] = useState<AnchorDraft | null>(null);
  const suppress = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recompute = () => {
      const sel = window.getSelection();
      // Scope-рамка: выделение должно целиком лежать в ОДНОМ [data-anchor-scope].
      // Кросс-скоуп / вне скоупа → drop (аффорданс не показываем).
      const found = scopeFromSelection(sel);
      if (!sel || !found) {
        setDraft(null);
        return;
      }
      const anchor = anchorFromSelection(sel, found.scopeEl);
      if (!anchor || sel.rangeCount === 0) {
        setDraft(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setDraft({ anchor, rect, scope: found.scope });
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
  }, [enabled]);

  const clear = () => {
    suppress.current = true;
    window.getSelection()?.removeAllRanges();
    setDraft(null);
  };
  return { draft, clear };
}
