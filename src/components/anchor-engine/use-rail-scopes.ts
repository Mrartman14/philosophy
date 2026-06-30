"use client";
// src/components/anchor-engine/use-rail-scopes.ts
// Хуки доступа к реестру scope-заметок (второй контекст AnchorScopeProvider):
// слой регистрирует свой скоуп на время монтирования, MarginRail читает все
// скоупы данного тона. Сам контекст/состояние живут в anchor-actions.tsx.
import { useContext, useEffect, useMemo } from "react";

import { RailScopesContext, type RailScopeEntry } from "./anchor-actions";

export type { RailScopeEntry };

/** Регистрирует scope-заметки в провайдере на время монтирования. No-op без провайдера. */
export function useRegisterRailScope(entry: RailScopeEntry | null) {
  const ctx = useContext(RailScopesContext);
  const register = ctx?.registerRailScope;
  const unregister = ctx?.unregisterRailScope;
  const key = entry?.key;
  useEffect(() => {
    if (!entry || !register || !unregister) return;
    register(entry);
    return () => {
      unregister(entry.key);
    };
    // entry пересоздаётся при смене notes/rootEl — реестр идемпотентен по key.
  }, [entry, key, register, unregister]);
}

/** Все scope-заметки данного тона (для MarginRail). */
export function useRailScopes(tone: "annotation" | "comment"): RailScopeEntry[] {
  const ctx = useContext(RailScopesContext);
  // Резолвим scopes ВНУТРИ useMemo: иначе `ctx?.scopes ?? []` аллоцирует новый
  // массив каждый рендер и дёргает мемоизацию (react-hooks/exhaustive-deps).
  // Депы — стабильный `ctx` (идентичность из value провайдера) + tone.
  return useMemo(
    () => (ctx?.scopes ?? []).filter((s) => s.tone === tone),
    [ctx, tone],
  );
}
