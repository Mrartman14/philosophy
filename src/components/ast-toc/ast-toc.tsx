// src/components/ast-toc/ast-toc.tsx
"use client";
import { useEffect, useId, useState } from "react";

import { useReducedMotion } from "@/components/appearance";
import { cn } from "@/components/ui";

import type { HeadingEntry } from "./extract-headings";

interface Props {
  headings: HeadingEntry[];
  /** Переведённый лейбл (= aria-labelledby + видимый заголовок навигации).
   *  Передаёт потребитель — компонент i18n-агностичен. */
  label: string;
  /** Опциональный потолок уровня (по умолчанию показываем все). */
  maxLevel?: number;
}

const INDENT_REM_PER_LEVEL = 0.75;

export function AstToc({ headings, label, maxLevel }: Props) {
  const items = maxLevel ? headings.filter((h) => h.level <= maxLevel) : headings;
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (items.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = items.find((h) => visible.has(h.id));
        if (first) setActiveId(first.id);
      },
      // Зона «активного» — верхние ~30% вьюпорта (заголовок «доезжает» до верха).
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const h of items) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => { observer.disconnect(); };
    // items пересоздаётся на каждый рендер, но после гидрейта стабилен по содержимому.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((h) => h.id).join(",")]);

  if (items.length === 0) return null;

  const minLevel = Math.min(...items.map((h) => h.level));

  function onClick(e: React.MouseEvent, id: string) {
    const el = document.getElementById(id);
    if (!el) return; // нет цели → пусть нативный якорь сработает сам
    e.preventDefault();
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // A11y: перенести фокус на целевой заголовок. Нативный якорь на
    // не-фокусируемый <hN> фокус НЕ двигает → клавиатура/скринридер «теряются»
    // (следующий Tab продолжит из навигации, а не из раздела). tabindex=-1 —
    // программно-фокусируемый, вне tab-order; preventScroll — скролл уже сделан.
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  return (
    <nav aria-labelledby={titleId}>
      <p id={titleId} className="mb-2 text-sm font-medium text-(--color-fg-muted)">{label}</p>
      <ul className="flex flex-col gap-1">
        {items.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              title={h.text}
              aria-current={activeId === h.id ? "location" : undefined}
              onClick={(e) => { onClick(e, h.id); }}
              style={{ paddingInlineStart: `${(h.level - minLevel) * INDENT_REM_PER_LEVEL}rem` }}
              className={cn(
                "block break-words text-sm",
                activeId === h.id
                  ? "text-(--color-link)"
                  : "text-(--color-fg-muted) hover:text-(--color-fg)",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
