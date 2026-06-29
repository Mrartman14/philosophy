"use client";
// src/components/ui/clampable-content.tsx
// Клампит крупный контент до превью (max-block-size + нижний masked-фейд, класс
// .clampable) и рендерит доступный тоггл «показать полностью / свернуть».
// Доменно-чистый: лейблы по умолчанию резолвятся из common (как ConfirmDialog/
// Select), порог — проп с дефолтом; оба переопределяемы. Контент рендерится
// целиком (есть в DOM до измерения / на no-JS); кламп — клиентское улучшение по
// измеренной естественной высоте детей.
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useT } from "@/i18n/client";

import { Button } from "./button";

interface Props {
  /** Порог высоты в rem; естественный контент выше — клампится. По умолчанию 16. */
  maxHeight?: number;
  /** Лейбл свёрнутого состояния; по умолчанию common.clampable.expand. */
  expandLabel?: string;
  /** Лейбл развёрнутого состояния; по умолчанию common.clampable.collapse. */
  collapseLabel?: string;
  children: ReactNode;
}

export function ClampableContent({ maxHeight = 16, expandLabel, collapseLabel, children }: Props) {
  const t = useT("common");
  const expand = expandLabel ?? t("clampable.expand");
  const collapse = collapseLabel ?? t("clampable.collapse");
  // Внутренний враппер НЕ клампится — его scrollHeight = естественная высота,
  // независимо от .clampable на region (overflow:hidden родителя не меняет
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
        className={clamp ? "clampable" : undefined}
        style={clamp ? ({ "--clamp-max": `${maxHeight}rem` } as CSSProperties) : undefined}
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
          {expanded ? collapse : expand}
        </Button>
      )}
    </div>
  );
}
