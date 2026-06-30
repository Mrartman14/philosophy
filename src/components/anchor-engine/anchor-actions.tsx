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

import type { AnchorDraft, AnchoredNote } from "./types";
import { useSelectionCapture } from "./use-selection-capture";

// Подъём аффорданса над выделением.
const AFFORDANCE_OFFSET_PX = 40;

// Стабильная module-scope ссылка дефолтного предиката (анти-OOM: НЕ новая
// функция каждый рендер — иначе она попадает в useEffect-deps регистрации и
// дёргает register/unregister в цикле).
const ALWAYS_APPLIES = () => true;

export interface AnchorAction {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
  // Применимо ли действие к скоупу данного типа сущности. annotation → все;
  // comment-anchor (v1) → только "document".
  appliesTo: (entityType: string) => boolean;
}

interface AnchorActionsContextValue {
  actions: AnchorAction[];
  register: (action: AnchorAction) => void;
  unregister: (id: string) => void;
}

const AnchorActionsContext = createContext<AnchorActionsContextValue | undefined>(
  undefined,
);

// ── Второй контекст: реестр scope-заметок для rail ─────────────────────────
// Слой (margin/comment) РЕГИСТРИРУЕТ свой скоуп заметок (rootEl + notes +
// renderNote) под общим ключом `${tone}:${entityType}:${entityId}`. MarginRail
// читает их через useRailScopes(tone) и рисует единую колонку маргиналий тона.

export interface RailScopeEntry {
  key: string;
  rootEl: HTMLElement;
  tone: "annotation" | "comment";
  notes: AnchoredNote[];
  renderNote: (note: AnchoredNote, orphan: boolean) => ReactNode;
  // Подсвечивать ли фрагменты этого скоупа (тумблер reading-mode). Default true.
  highlightEnabled?: boolean;
}

interface RailScopesContextValue {
  scopes: RailScopeEntry[];
  registerRailScope: (e: RailScopeEntry) => void;
  unregisterRailScope: (key: string) => void;
}

export const RailScopesContext = createContext<RailScopesContextValue | undefined>(
  undefined,
);

export function AnchorScopeProvider({ children }: { children: ReactNode }) {
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

  // Реестр scope-заметок. Идемпотентен по key: повторная регистрация заменяет
  // (свежие notes/rootEl/renderNote) — entry пересоздаётся при смене данных, а
  // не дублируется. register/unregister стабильны (useCallback) → не дёргают
  // re-register loop в эффекте useRegisterRailScope.
  const [scopes, setScopes] = useState<RailScopeEntry[]>([]);

  const registerRailScope = useCallback((e: RailScopeEntry) => {
    setScopes((prev) => [...prev.filter((s) => s.key !== e.key), e]);
  }, []);

  const unregisterRailScope = useCallback((key: string) => {
    setScopes((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const railValue = useMemo<RailScopesContextValue>(
    () => ({ scopes, registerRailScope, unregisterRailScope }),
    [scopes, registerRailScope, unregisterRailScope],
  );

  return (
    <AnchorActionsContext.Provider value={value}>
      <RailScopesContext.Provider value={railValue}>
        {children}
      </RailScopesContext.Provider>
    </AnchorActionsContext.Provider>
  );
}

// временный alias до миграции страниц (снимается в Task 13)
export const AnchorActionsProvider = AnchorScopeProvider;

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
  appliesTo = ALWAYS_APPLIES,
}: {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
  enabled: boolean;
  appliesTo?: (entityType: string) => boolean;
}) {
  const ctx = useContext(AnchorActionsContext);
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  useEffect(() => {
    if (!enabled || !register || !unregister) return;
    register({ id, label, onCreate, appliesTo });
    return () => {
      unregister(id);
    };
  }, [id, label, onCreate, enabled, appliesTo, register, unregister]);
}

/**
 * Слой-фасад над useRegisterAnchorAction: инкапсулирует ref-стабилизацию
 * onCreate (чтобы меняющийся колбэк не дёргал re-register loop в эффекте
 * регистрации) + саму регистрацию. ВНУТРЕННИЙ — слои зовут относительным
 * импортом, из index НЕ выносим.
 */
export function useStableAnchorAction({
  id,
  label,
  onCreate,
  enabled,
  appliesTo,
}: {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
  enabled: boolean;
  appliesTo?: (entityType: string) => boolean;
}): void {
  const ref = useRef(onCreate);
  useEffect(() => {
    ref.current = onCreate;
  });
  const stable = useCallback((draft: AnchorDraft) => {
    ref.current(draft);
  }, []);
  // appliesTo опционален — пробрасываем только когда задан (exactOptionalPropertyTypes:
  // undefined нельзя присвоить опц.-полю в value-позиции; опускание → дефолт хука).
  useRegisterAnchorAction({
    id,
    label,
    onCreate: stable,
    enabled,
    ...(appliesTo ? { appliesTo } : {}),
  });
}

/** Чистый предикат: действия, применимые к скоупу данного типа сущности. */
export function applicableActions(
  actions: AnchorAction[],
  entityType: string,
): AnchorAction[] {
  return actions.filter((a) => a.appliesTo(entityType));
}

/**
 * Единый хост захвата выделения + аффорданса. Запускает ОДИН useSelectionCapture
 * (scope-рамка [data-anchor-scope] внутри самого хука) и при наличии выделения +
 * применимых к его скоупу действий рендерит ОДИН поповер с рядом kit-кнопок.
 * Без провайдера / выделения / применимых действий — null.
 */
export function SelectionAffordanceHost() {
  const ctx = useContext(AnchorActionsContext);
  const actions = ctx?.actions ?? [];
  const { draft, clear } = useSelectionCapture({ enabled: actions.length > 0 });

  if (!ctx || actions.length === 0 || !draft) return null;
  const applicable = applicableActions(actions, draft.scope.entityType);
  if (applicable.length === 0) return null;

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
        {applicable.map((action) => (
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
