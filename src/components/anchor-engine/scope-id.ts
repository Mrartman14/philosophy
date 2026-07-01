// Идентичность scope: пара (entityType, entityId), сериализуемая в атрибут
// data-anchor-scope="<type>:<id>". entityType и entityId (UUID) разделены ПЕРВЫМ
// двоеточием — остаток уходит в entityId (defensive, на случай ":"-в-id).
import { cssEscape } from "./css-escape";

export interface AnchorScopeId {
  entityType: string;
  entityId: string;
}

export function formatScopeId(s: AnchorScopeId): string {
  return `${s.entityType}:${s.entityId}`;
}

/** Проп-объект для JSX-разметки тела сущности как скоупа: {...anchorScopeAttr("comment", id)}. */
export function anchorScopeAttr(
  entityType: string,
  entityId: string,
): { "data-anchor-scope": string } {
  return { "data-anchor-scope": formatScopeId({ entityType, entityId }) };
}

/**
 * CSS-селектор тела скоупа: `[data-anchor-scope="<escaped type:id>"]`. Значение
 * атрибута экранируется через cssEscape (безопасно для UUID/типа с спецсимволами) —
 * пара к anchorScopeAttr, которым размечают скоуп. Для querySelector в фичах
 * (annotation-scope / comment-anchor-scope находят свой корень по типу+id).
 */
export function anchorScopeSelector(entityType: string, entityId: string): string {
  return `[data-anchor-scope="${cssEscape(formatScopeId({ entityType, entityId }))}"]`;
}

export function parseScopeId(raw: string | null | undefined): AnchorScopeId | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx <= 0 || idx === raw.length - 1) return null;
  return { entityType: raw.slice(0, idx), entityId: raw.slice(idx + 1) };
}

export function nearestScope(
  node: Node | null,
): { el: HTMLElement; scope: AnchorScopeId } | null {
  const start =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node?.parentElement ?? null);
  const el = start?.closest<HTMLElement>("[data-anchor-scope]") ?? null;
  if (!el) return null;
  const scope = parseScopeId(el.getAttribute("data-anchor-scope"));
  return scope ? { el, scope } : null;
}
