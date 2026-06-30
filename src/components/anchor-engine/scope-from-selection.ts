// src/components/anchor-engine/scope-from-selection.ts
// Выделение → scope: ближайший общий [data-anchor-scope] обеих границ. Если
// границы в разных скоупах (кросс-скоуп выделение) — null (аффорданс не показываем).
import { nearestScope, type AnchorScopeId } from "./scope-id";

export function scopeFromSelection(
  sel: Selection | null,
): { scopeEl: HTMLElement; scope: AnchorScopeId } | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const a = nearestScope(sel.anchorNode);
  const f = nearestScope(sel.focusNode);
  if (!a || !f) return null;
  if (a.el !== f.el) return null;
  return { scopeEl: a.el, scope: a.scope };
}
