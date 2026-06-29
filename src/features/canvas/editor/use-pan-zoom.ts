// src/features/canvas/editor/use-pan-zoom.ts
import { useEffect, useRef, type RefObject } from "react";

import { applyZoomAtPoint } from "./coords";
import type { Viewport } from "./editor-types";
import { resolveWheel } from "./interaction";

export interface UsePanZoomOptions {
  /** Текущий вьюпорт (controlled). null → интерактив выключен (статичная ветка). */
  viewport: Viewport | null;
  onViewportChange: (next: Viewport) => void;
  /** Должен ли pointerdown начать пан. boolean | предикат по нативному событию. */
  enablePanDrag: boolean | ((e: PointerEvent) => boolean);
  /** Вызывается на pointerdown, когда enablePanDrag вернул false (не-пановый ввод). */
  onPointerDownOther?: (e: PointerEvent) => void;
  /** Полностью отключить жесты (напр. до замера контейнера). */
  disabled?: boolean;
}

/**
 * Общий клей жестов pan/zoom поверх DOM-элемента — единственный владелец wheel и
 * pointerdown. Controlled: стейт вьюпорта держит консьюмер (редактор — в reducer,
 * viewer — в useState), хук лишь шлёт `onViewportChange`. Вся математика — из coords.
 *
 *  - wheel (non-passive): Figma-конвенция (ctrl/meta → зум у курсора, shift → гориз, иначе пан).
 *  - drag-пан: pointerdown при enablePanDrag → захват + сдвиг вьюпорта по экранной дельте.
 *  - пинч (2 тач-указателя): отношение дистанций → зум в середине щипка.
 *  - не-пановый pointerdown делегируется через onPointerDownOther (там консьюмер ведёт
 *    свои жесты: select/marquee/resize/edge у редактора).
 */
export function usePanZoom(ref: RefObject<HTMLElement | null>, opts: UsePanZoomOptions): void {
  // Свежие opts в ref: слушатели вешаются один раз и читают current на событии
  // (без переподписки и без stale-замыканий vp/предикатов).
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  // --- wheel ---
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { viewport: vp, onViewportChange, disabled } = optsRef.current;
      if (disabled || !vp) return;
      e.preventDefault();
      const action = resolveWheel({ deltaX: e.deltaX, deltaY: e.deltaY, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
      if (action.kind === "zoom") {
        const rect = el.getBoundingClientRect();
        onViewportChange(applyZoomAtPoint(vp, action.factor, e.clientX - rect.left, e.clientY - rect.top));
      } else {
        onViewportChange({ ...vp, x: vp.x + action.dx / vp.zoom, y: vp.y + action.dy / vp.zoom });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); };
  }, [ref]);

  // --- pointer: drag-пан + пинч ---
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const points = new Map<number, { x: number; y: number }>();
    let panning = false;
    let panPointerId = -1;
    let startScreen = { x: 0, y: 0 };
    let startVp = { x: 0, y: 0 };
    let pinchPrevDist = 0;

    const onDown = (e: PointerEvent) => {
      const { disabled, viewport, enablePanDrag, onPointerDownOther } = optsRef.current;
      if (disabled || !viewport) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        // начался пинч → отменяем возможный пан
        panning = false;
        const [a, b] = [...points.values()];
        if (a && b) pinchPrevDist = Math.hypot(a.x - b.x, a.y - b.y);
        return;
      }
      const wantPan = typeof enablePanDrag === "function" ? enablePanDrag(e) : enablePanDrag;
      if (wantPan) {
        panning = true;
        panPointerId = e.pointerId;
        startScreen = { x: e.clientX, y: e.clientY };
        startVp = { x: viewport.x, y: viewport.y };
        el.setPointerCapture(e.pointerId);
      } else {
        onPointerDownOther?.(e);
      }
    };

    const onMove = (e: PointerEvent) => {
      const { viewport, onViewportChange } = optsRef.current;
      if (!viewport) return;
      if (points.has(e.pointerId)) points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        const [a, b] = [...points.values()];
        if (!a || !b) return;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchPrevDist > 0 && dist > 0) {
          const rect = el.getBoundingClientRect();
          const midX = (a.x + b.x) / 2 - rect.left;
          const midY = (a.y + b.y) / 2 - rect.top;
          onViewportChange(applyZoomAtPoint(viewport, dist / pinchPrevDist, midX, midY));
        }
        pinchPrevDist = dist;
        return;
      }
      if (!panning || e.pointerId !== panPointerId) return;
      const dx = e.clientX - startScreen.x;
      const dy = e.clientY - startScreen.y;
      onViewportChange({ zoom: viewport.zoom, x: startVp.x - dx / viewport.zoom, y: startVp.y - dy / viewport.zoom });
    };

    const onUp = (e: PointerEvent) => {
      points.delete(e.pointerId);
      if (points.size < 2) pinchPrevDist = 0;
      if (e.pointerId === panPointerId) {
        panning = false;
        panPointerId = -1;
        el.releasePointerCapture(e.pointerId);
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [ref]);
}
