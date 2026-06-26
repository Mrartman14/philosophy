"use client";
// src/components/anchor-engine/margin-notes-column.tsx
// Колонка карточек-заметок на полях. Привязанные карточки позиционируются
// абсолютно по якорю — top измеряется ОТНОСИТЕЛЬНО контейнера колонки
// (anchorRect.top − columnRect.top), раздвигается resolveStack, под абсолют
// ставится min-height-распорка (= totalHeight). На узких (narrow) абсолют не
// применяется — чистый поток-список. Сироты (orphan) всегда в потоке сверху.
//
// Активация карточки (скролл к якорю) — ПОЙНТЕР-ОНЛИ, без role="button"/tabIndex/
// клавиатуры на обёртке: карточка (n.node) содержит реальные интерактивные
// контролы (edit/delete), а role="button" поверх вложенных <button> — антипаттерн
// доступности (nested-interactive). Клавиатурный путь — собственные контролы
// карточки + обратное направление «клик по тексту → активная карточка». Клик,
// исходящий из интерактивного потомка, НЕ активирует (guard всплытия).
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { resolveStack, type StackItem } from "./stacking";

// Селектор интерактивных потомков: клик по ним не активирует карточку.
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex]';

export interface ColumnNote {
  id: string;
  node: ReactNode;
  orphan: boolean;
}
interface Props {
  notes: ColumnNote[];
  getAnchorRect: (id: string) => DOMRect | null; // viewport-координаты якоря
  onActivate: (id: string) => void;
  recomputeKey: number; // меняется при resize/fonts от движка (scroll не требует
  // пересчёта — позиции относительны контейнеру колонки)
  onHoverNote?: (id: string | null) => void;
}

const WIDE = "(min-width: 80rem)";

export function MarginNotesColumn({ notes, getAnchorRect, onActivate, onHoverNote, recomputeKey }: Props) {
  const anchoredRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [tops, setTops] = useState<Map<string, number>>(new Map());
  const [strut, setStrut] = useState(0);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    // Defensive: в jsdom/SSR window.matchMedia отсутствует → деградируем в поток
    // (wide=false), не подписываемся, не бросаем.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE);
    const sync = () => {
      setWide(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, []);

  // Пересчёт позиций — синхронизация измерительного слоя с внешней геометрией
  // (DOM-rect якорей, offsetHeight карточек, viewport). Логика в named-closure
  // `update`, чтобы setState читался как обновление под внешнюю систему, а не
  // каскад в теле эффекта. recomputeKey в deps дёргает пересчёт при resize/fonts
  // (scroll не требует пересчёта — позиции относительны контейнеру колонки).
  useLayoutEffect(() => {
    const update = () => {
      const container = anchoredRef.current;
      if (!container || !wide) {
        setTops(new Map());
        setStrut(0);
        return;
      }
      const colTop = container.getBoundingClientRect().top; // общий референс
      const items: StackItem[] = [];
      for (const n of notes) {
        if (n.orphan) continue;
        const rect = getAnchorRect(n.id);
        if (!rect) continue;
        const el = cardRefs.current.get(n.id);
        items.push({ id: n.id, top: rect.top - colTop, height: el?.offsetHeight ?? 0 });
      }
      const { tops: nextTops, totalHeight } = resolveStack(items);
      setTops(nextTops);
      setStrut(totalHeight);
    };
    update();
  }, [notes, getAnchorRect, wide, recomputeKey]);

  const orphans = notes.filter((n) => n.orphan);
  const anchored = notes.filter((n) => !n.orphan);

  // Пойнтер-онли активация с guard всплытия: клик, исходящий из интерактивного
  // потомка карточки (edit/delete и т.п.), НЕ скроллит к якорю.
  const onCardClick = (id: string) => (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element | null)?.closest(INTERACTIVE)) return;
    onActivate(id);
  };

  return (
    <div className="flex flex-col gap-3" data-note-column>
      {orphans.map((n) => (
        <div key={n.id}>{n.node}</div>
      ))}
      <div
        ref={anchoredRef}
        className={wide ? "relative" : "flex flex-col gap-3"}
        style={wide ? { minHeight: strut } : undefined}
      >
        {anchored.map((n) => (
          // Пойнтер-онли активация (скролл к якорю) поверх карточки, которая САМА
          // несёт фокусируемые контролы (edit/delete) + обратный путь «клик по
          // тексту → активная карточка». role="button"/tabIndex здесь были бы
          // nested-interactive антипаттерном (вложенные <button>), поэтому
          // намеренно НЕ добавляем клавиатуру/роль на обёртку — это
          // необязательное pointer-улучшение, не единственный путь к действию.
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- pointer-only enhancement; избегаем nested-interactive (карточка имеет свои фокус-контролы + реципрокный текст→карточка)
          <div
            key={n.id}
            data-note-card-wrapper={n.id}
            ref={(el) => {
              if (el) cardRefs.current.set(n.id, el);
              else cardRefs.current.delete(n.id);
            }}
            onClick={onCardClick(n.id)}
            onMouseEnter={() => onHoverNote?.(n.id)}
            onMouseLeave={() => onHoverNote?.(null)}
            style={
              wide && tops.has(n.id)
                ? { position: "absolute", top: tops.get(n.id), insetInlineStart: 0, insetInlineEnd: 0 }
                : undefined
            }
          >
            {n.node}
          </div>
        ))}
      </div>
    </div>
  );
}
