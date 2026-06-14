"use client";
// src/features/canvas/ui/editor-text-overlay.tsx
import { useEffect, useRef, useState } from "react";

import { worldToScreen } from "../editor";
import type { Viewport } from "../editor";
import type { CanvasNode } from "../types";

interface Props {
  node: CanvasNode;
  viewport: Viewport;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Inline-редактирование текста узла. HTML <textarea> позиционируется абсолютно
 * поверх SVG-холста в ЭКРАННЫХ координатах (worldToScreen от мировых node.x/y),
 * масштабируется по zoom. Enter (без Shift) или blur — коммит; Esc — отмена.
 * SVG <foreignObject> избегаем: HTML-оверлей надёжнее работает с фокусом/IME.
 */
export function EditorTextOverlay({ node, viewport, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(node.text ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const screen = worldToScreen({ x: node.x ?? 0, y: node.y ?? 0 }, viewport);
  const w = (node.width ?? 100) * viewport.zoom;
  const h = (node.height ?? 40) * viewport.zoom;

  return (
    <textarea
      ref={ref}
      value={value}
      maxLength={10000}
      onChange={(e) => { setValue(e.target.value); }}
      onBlur={() => { onCommit(value); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        e.stopPropagation();
      }}
      style={{
        position: "absolute",
        left: screen.x,
        top: screen.y,
        width: w,
        height: h,
        fontSize: 12 * viewport.zoom,
        padding: 4,
        boxSizing: "border-box",
        resize: "none",
        border: "1px solid var(--color-primary)",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        zIndex: 10,
      }}
    />
  );
}
