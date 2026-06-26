"use client";
// src/components/anchor-engine/anchor-actions.tsx
// ЕДИНАЯ shared-поверхность движка для захвата выделения + аффорданса. Решает
// «dual-affordance collision»: раньше каждый слой (margin/inline) держал СВОЙ
// useSelectionCapture + SelectionAffordance, и при двух смонтированных слоях у
// одного выделения возникали ДВЕ конкурирующие кнопки. Теперь есть один хост
// (SelectionAffordanceHost) с одним захватом и одним поповером, а слои лишь
// РЕГИСТРИРУЮТ свои действия (useRegisterAnchorAction) — рендерится РЯД kit-кнопок
// (по одной на действие) у общего выделения.
//
// Guardrail 7: только kit-примитивы (Button/Inline из @/components/ui), без
// нативных интерактивных тегов / прямого base-ui.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button, Inline } from "@/components/ui";

import type { AnchorDraft } from "./types";
import { useSelectionCapture } from "./use-selection-capture";

// Подъём аффорданса над выделением (зеркалит selection-affordance.tsx).
const AFFORDANCE_OFFSET_PX = 40;

export interface AnchorAction {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
}

interface AnchorActionsContextValue {
  actions: AnchorAction[];
  register: (action: AnchorAction) => void;
  unregister: (id: string) => void;
}

const AnchorActionsContext = createContext<AnchorActionsContextValue | undefined>(
  undefined,
);

export function AnchorActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<AnchorAction[]>([]);

  const register = useCallback((action: AnchorAction) => {
    setActions((prev) => {
      // Идемпотентно по id: повторная регистрация заменяет (свежий onCreate/label).
      const next = prev.filter((a) => a.id !== action.id);
      next.push(action);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const value = useMemo<AnchorActionsContextValue>(
    () => ({ actions, register, unregister }),
    [actions, register, unregister],
  );

  return (
    <AnchorActionsContext.Provider value={value}>
      {children}
    </AnchorActionsContext.Provider>
  );
}

/**
 * Слой регистрирует своё действие создания якоря в общий хост. Без провайдера
 * (контекст undefined) — no-op (безопасно до монтирования провайдера). При
 * !enabled / unmount действие снимается.
 */
export function useRegisterAnchorAction({
  id,
  label,
  onCreate,
  enabled,
}: {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
  enabled: boolean;
}) {
  const ctx = useContext(AnchorActionsContext);
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  useEffect(() => {
    if (!enabled || !register || !unregister) return;
    register({ id, label, onCreate });
    return () => {
      unregister(id);
    };
  }, [id, label, onCreate, enabled, register, unregister]);
}

/**
 * Единый хост захвата выделения + аффорданса. Сам discover'ит `[data-ast-root]`
 * (как document-annotation-layer), запускает ОДИН useSelectionCapture и при
 * наличии выделения + зарегистрированных действий рендерит ОДИН поповер с рядом
 * kit-кнопок. Без провайдера / рута / действий — null.
 */
export function SelectionAffordanceHost() {
  const ctx = useContext(AnchorActionsContext);
  const astRootRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);

  // Discover AST-рут ПОСЛЕ первого коммита (SSR/первый client-рендер видят
  // ready=false — без mismatch; захват включается следующим тиком).
  useEffect(() => {
    astRootRef.current = document.querySelector<HTMLElement>("[data-ast-root]");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount discovery (SSR/первый рендер ready=false → без hydration-mismatch), как в document-annotation-layer
    setReady(true);
  }, []);

  const actions = ctx?.actions ?? [];
  const { draft, clear } = useSelectionCapture({
    rootRef: astRootRef,
    enabled: ready && actions.length > 0,
  });

  // Без выделения draft===null — а draft строится только когда rootRef.current
  // (AST-рут) найден и обе границы выделения внутри него (см. useSelectionCapture).
  // Поэтому отдельная проверка astRootRef.current тут не нужна (и нельзя читать
  // ref во время рендера — react-hooks/refs).
  if (!ctx || !ready || actions.length === 0) return null;
  if (!draft) return null;

  const { rect } = draft;
  const top = rect.top + window.scrollY - AFFORDANCE_OFFSET_PX;
  const left = rect.left + window.scrollX + rect.width / 2;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      // eslint-disable-next-line no-restricted-syntax -- координатный портал, направление-нейтрально
      style={{ position: "absolute", top, left, transform: "translateX(-50%)", zIndex: 50 }}
    >
      <Inline gap="tight" align="center">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            compact
            tone="primary"
            aria-label={action.label}
            onPointerDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              action.onCreate(draft);
              clear();
            }}
          >
            {action.label}
          </Button>
        ))}
      </Inline>
    </div>,
    document.body,
  );
}
