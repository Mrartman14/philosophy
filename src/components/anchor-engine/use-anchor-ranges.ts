// src/components/anchor-engine/use-anchor-ranges.ts
// Геометрия движка: Range по каждому note (для подсветки/позиций/хит-теста),
// ready-флаг (rootRef заполняется после первого коммита) и пересчёт при
// resize / загрузке шрифтов / смене notes. Вынесено из оркестратора — общее
// для eager- и lazy-политик.
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

import { resolveAnchor } from "./anchor-to-range";
import type { AnchoredNote, AnchorGeometry } from "./types";

export function useAnchorRanges({
  astRootRef,
  notes,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
}) {
  const [recomputeKey, setRecomputeKey] = useState(0);
  const [ready, setReady] = useState(false);

  // Готовность рута (ref заполнен после первого коммита) → форсим первый расчёт
  // ranges/подсветки. Без этого useMemo по стабильному astRootRef не пересчитался
  // бы, когда .current переходит null → element (ref-идентичность не меняется).
  useEffect(() => {
    setReady(astRootRef.current !== null);
  }, [astRootRef]);

  // Пересчёт геометрии: resize / загрузка шрифтов / смена notes / готовность рута.
  useEffect(() => {
    const bump = () => {
      setRecomputeKey((k) => k + 1);
    };
    bump();
    window.addEventListener("resize", bump);
    const root = astRootRef.current;
    const ro = typeof ResizeObserver !== "undefined" && root ? new ResizeObserver(bump) : null;
    if (ro && root) ro.observe(root);
    // fonts может отсутствовать (старые движки / jsdom) → каст с опциональным
    // полем (без интерсекции с Document, где fonts non-optional → ?. был бы лишним).
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts;
    fonts?.ready.then(bump).catch(() => undefined);
    return () => {
      window.removeEventListener("resize", bump);
      ro?.disconnect();
    };
  }, [astRootRef, notes, ready]);

  // Геометрия (range|rect) по каждому note (для подсветки / позиций / хит-теста).
  // recomputeKey и ready в deps: пересчитывается после готовности рута и при смене
  // геометрии.
  const geometries = useMemo(() => {
    const root = astRootRef.current;
    const m = new Map<string, AnchorGeometry | null>();
    if (root) for (const n of notes) m.set(n.id, resolveAnchor(n.anchor, root));
    return m;
    // ready/recomputeKey намеренно в deps — форсят перестроение карты, хотя
    // astRootRef стабилен по идентичности (см. комментарии к эффектам выше).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, astRootRef, ready, recomputeKey]);

  // Производный range-only слой для существующих Range-потребителей (Highlight API
  // контроллер / hover / click до T6). rect-якоря → null (в Highlight API не идут).
  const ranges = useMemo(() => {
    const m = new Map<string, Range | null>();
    for (const [id, g] of geometries) m.set(id, g?.kind === "range" ? g.range : null);
    return m;
  }, [geometries]);

  const getAnchorRect = useCallback(
    (id: string) => geometries.get(id)?.boundingRect ?? null,
    [geometries],
  );

  return { geometries, ranges, getAnchorRect, recomputeKey, ready };
}
