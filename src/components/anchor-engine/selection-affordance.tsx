"use client";
// src/components/anchor-engine/selection-affordance.tsx
import { createPortal } from "react-dom";

import { Button } from "@/components/ui";

interface Props {
  rect: DOMRect;
  label: string;
  onCreate: () => void;
}

// Подъём аффорданса над выделением (по верхней грани selection-rect).
const AFFORDANCE_OFFSET_PX = 40;

export function SelectionAffordance({ rect, label, onCreate }: Props) {
  const top = rect.top + window.scrollY - AFFORDANCE_OFFSET_PX;
  const left = rect.left + window.scrollX + rect.width / 2;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      // eslint-disable-next-line no-restricted-syntax -- координатный портал, направление-нейтрально
      style={{ position: "absolute", top, left, transform: "translateX(-50%)", zIndex: 50 }}
    >
      <Button
        type="button"
        compact
        tone="primary"
        aria-label={label}
        onPointerDown={(e) => {
          e.preventDefault();
        }}
        onClick={onCreate}
      >
        {label}
      </Button>
    </div>,
    document.body,
  );
}
