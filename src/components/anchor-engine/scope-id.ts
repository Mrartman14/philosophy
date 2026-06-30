// Идентичность scope: пара (entityType, entityId), сериализуемая в атрибут
// data-anchor-scope="<type>:<id>". entityType и entityId (UUID) разделены ПЕРВЫМ
// двоеточием — остаток уходит в entityId (defensive, на случай ":"-в-id).
export interface AnchorScopeId {
  entityType: string;
  entityId: string;
}

export function formatScopeId(s: AnchorScopeId): string {
  return `${s.entityType}:${s.entityId}`;
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
