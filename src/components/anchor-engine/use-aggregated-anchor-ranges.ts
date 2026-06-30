"use client";
// src/components/anchor-engine/use-aggregated-anchor-ranges.ts
// Мультикорневая геометрия rail: каждая заметка резолвится в корне СВОЕГО скоупа.
// id заметок (UUID) глобально уникальны → плоская Map<id, Range|null>. Пересчёт:
// resize / шрифты / смена scopes / ResizeObserver на каждом корне.
import { useCallback, useEffect, useMemo, useState } from "react";

import { rangeFromAnchor } from "./anchor-to-range";
import type { RailScopeEntry } from "./use-rail-scopes";

export function useAggregatedAnchorRanges(scopes: RailScopeEntry[]) {
  const [recomputeKey, setRecomputeKey] = useState(0);

  // СТАБИЛЬНЫЙ ключ набора корней: пересоздавать ResizeObserver'ы только при смене
  // самих корней/состава скоупов, а НЕ при каждой новой идентичности массива
  // `scopes` (которую плодит .filter() в useRailScopes на каждый register). Без
  // этого N register'ов на гидрации = O(N²) перемонтирований RO.
  const scopeKey = scopes.map((s) => s.key).join("|");

  useEffect(() => {
    const bump = () => {
      setRecomputeKey((k) => k + 1);
    };
    bump();
    window.addEventListener("resize", bump);
    const ros: ResizeObserver[] = [];
    if (typeof ResizeObserver !== "undefined") {
      for (const s of scopes) {
        const ro = new ResizeObserver(bump);
        ro.observe(s.rootEl);
        ros.push(ro);
      }
    }
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts;
    fonts?.ready.then(bump).catch(() => undefined);
    return () => {
      window.removeEventListener("resize", bump);
      for (const ro of ros) ro.disconnect();
    };
    // Ключуем по стабильному scopeKey (состав/корни), не по идентичности массива.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const ranges = useMemo(() => {
    const m = new Map<string, Range | null>();
    for (const s of scopes) {
      for (const n of s.notes) m.set(n.id, rangeFromAnchor(n.anchor, s.rootEl));
    }
    return m;
    // scopeKey (стабильный) + recomputeKey форсят перестроение при реальной смене
    // состава/геометрии, не на каждую новую идентичность массива scopes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, recomputeKey]);

  const getAnchorRect = useCallback(
    (id: string) => {
      const r = ranges.get(id);
      return r ? r.getBoundingClientRect() : null;
    },
    [ranges],
  );

  return { ranges, getAnchorRect, recomputeKey };
}
