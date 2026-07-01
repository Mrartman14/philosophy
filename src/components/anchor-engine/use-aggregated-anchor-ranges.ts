"use client";
// src/components/anchor-engine/use-aggregated-anchor-ranges.ts
// Мультикорневая геометрия rail: каждая заметка резолвится в корне СВОЕГО скоупа.
// id заметок (UUID) глобально уникальны → плоская Map<id, Range|null>. Пересчёт:
// resize / шрифты / смена scopes / ResizeObserver на каждом корне / scroll (throttled
// rAF — держит viewport-rect'ы свежими, чтобы overlay/выноски не дрейфовали, F4).
import { useCallback, useEffect, useMemo, useState } from "react";

import { geometryRect, rangesFromGeometries, resolveAnchor } from "./anchor-to-range";
import { railScopeFingerprint } from "./rail-scope-key";
import type { AnchorGeometry } from "./types";
import type { RailScopeEntry } from "./use-rail-scopes";

export function useAggregatedAnchorRanges(scopes: RailScopeEntry[]) {
  const [recomputeKey, setRecomputeKey] = useState(0);

  // СТАБИЛЬНЫЙ ключ набора корней: пересоздавать ResizeObserver'ы и пересчитывать
  // ranges только при смене самих корней / СОСТАВА скоупов (вкл. add/remove нот в
  // рамках того же key — реестр replace-по-key свежим entry), а НЕ при каждой
  // новой идентичности массива `scopes` (которую плодит .filter() в useRailScopes
  // на каждый register). Без id-нот в ключе новая аннотация при том же key не
  // получила бы Range (сирота); без стабильности на чистом array-churn вернулся бы
  // O(N²) перемонтирований RO на гидрации. Отпечаток — чистый railScopeFingerprint
  // (общий с margin-rail, чтобы формат не разъехался).
  const scopeKey = railScopeFingerprint(scopes);

  useEffect(() => {
    const bump = () => {
      setRecomputeKey((k) => k + 1);
    };
    bump();
    window.addEventListener("resize", bump);

    // Scroll-дрейф-фикс (F4, находка аудита 2026-07-01). geometries снимаются в
    // VIEWPORT-координатах (getClientRects/bbox). Их потребители — overlay-фолбэк
    // (highlight-overlay: top = rect.top + scrollY) и выноски (connector-layer:
    // anchor.top + scrollY) — конвертируют в document-координаты по СВЕЖЕМУ scrollY
    // на каждом scroll-событии, но по СТАРОМУ (stale) viewport-rect → бокс/точка
    // уезжали со скоростью скролла. Пере-снимаем geometries на scroll (throttled в
    // один rAF на кадр) → rect.top становится свежим (viewport-top ↓ на ΔY), и
    // top+scrollY остаётся постоянным. Нативный CSS Highlight API scroll держит сам
    // — дрейфил только overlay-фолбэк (rect-якоря везде + линейные на легаси) и
    // выноски; их и чиним общим пере-снятием. capture:true — ловим scroll вложенных
    // прокручиваемых контейнеров, не только window.
    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return; // throttle: один пере-расчёт на кадр, не на событие
      scrollRaf =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame(() => {
              scrollRaf = 0;
              bump();
            })
          : 0;
      if (!scrollRaf) bump(); // нет rAF (SSR/старый движок) → синхронно
    };
    window.addEventListener("scroll", onScroll, true);

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
      window.removeEventListener("scroll", onScroll, true);
      if (scrollRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(scrollRaf);
      for (const ro of ros) ro.disconnect();
    };
    // Ключуем по стабильному scopeKey (состав/корни), не по идентичности массива.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Геометрия (range|rect) по каждой заметке — каждая резолвится в корне СВОЕГО
  // скоупа. resolveAnchor поддерживает node_id-адресацию и прямоугольные (table-
  // cell) якоря; прежний rangeFromAnchor давал только Range → rect-якоря были бы
  // сиротами. Единственный геометрия-хук в проде (single-root предок удалён).
  //
  // КОНТРАКТ ИММУТАБЕЛЬНОСТИ ЯКОРЯ (аудит #5): ключ пересчёта — scopeKey (состав:
  // key + highlightEnabled + id-нот) + recomputeKey (viewport-события). Сам ОБЪЕКТ
  // anchor заметки в ключе НЕ участвует: якорь считается неизменяемым для данного id
  // — правка выделения = НОВАЯ аннотация (новый id), а не мутация anchor у прежней.
  // Это опора бэк-контракта (аннотация иммутабельна по anchor); если он изменится
  // (in-place edit anchor того же id), сюда надо будет добавить fingerprint anchor'а.
  const geometries = useMemo(() => {
    const m = new Map<string, AnchorGeometry | null>();
    for (const s of scopes) {
      for (const n of s.notes) m.set(n.id, resolveAnchor(n.anchor, s.rootEl));
    }
    return m;
    // scopeKey (стабильный) + recomputeKey форсят перестроение при реальной смене
    // состава/геометрии, не на каждую новую идентичность массива scopes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, recomputeKey]);

  // Производный range-only слой для Highlight API / overlay (rect → null: в
  // Highlight API прямоугольники не идут, подсвечиваются оверлеем bbox).
  const ranges = useMemo(() => rangesFromGeometries(geometries), [geometries]);

  const getAnchorRect = useCallback(
    (id: string) => geometryRect(geometries.get(id)),
    [geometries],
  );

  return { geometries, ranges, getAnchorRect, recomputeKey };
}
