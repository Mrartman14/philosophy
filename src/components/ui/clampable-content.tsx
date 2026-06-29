"use client";
// src/components/ui/clampable-content.tsx
// Клампит крупный контент до превью (max-block-size + нижний masked-фейд) и
// рендерит доступный тоггл «показать полностью / свернуть». Доменно-чистый: не
// знает про маргиналию/аннотации/комменты — лейблы и порог приходят пропами.
// Контент рендерится целиком (есть в DOM до измерения / на no-JS); кламп —
// клиентское улучшение по измеренной естественной высоте детей.
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "./button";

interface Props {
  /** Порог высоты в rem; естественный контент выше — клампится с тогглом. */
  maxHeight: number;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
}

export function ClampableContent({ maxHeight, expandLabel, collapseLabel, children }: Props) {
  // Внутренний враппер НЕ клампится — его scrollHeight = естественная высота,
  // независимо от max-block-size на region (overflow:hidden родителя не меняет
  // layout-высоту ребёнка) → нет петли «кламп уменьшил высоту → пере-замер».
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const regionId = useId();

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      // rem→px через корневой font-size (учитывает ось шрифта appearance);
      // фолбэк 16 для jsdom/пустого computed.
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setOverflowing(el.scrollHeight > maxHeight * rootPx + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [maxHeight]);

  const clamp = overflowing && !expanded;
  return (
    <div className="flex flex-col gap-1">
      <div
        id={regionId}
        style={
          clamp
            ? {
                maxBlockSize: `${maxHeight}rem`,
                overflow: "hidden",
                maskImage: "linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)",
              }
            : undefined
        }
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {overflowing && (
        <Button
          compact
          tone="quiet"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => {
            setExpanded((v) => !v);
          }}
        >
          {expanded ? collapseLabel : expandLabel}
        </Button>
      )}
    </div>
  );
}
