// src/components/anchor-engine/rail-scope-key.ts
// Стабильный отпечаток СОСТАВА rail-скоупов: `${key}#${id,id,…}` на скоуп,
// склеенные через "|". Это load-bearing инвариант: им ключуются useMemo/useEffect
// в useAggregatedAnchorRanges И margin-rail. Отпечаток обязан меняться при
// add/remove заметки (иначе новая аннотация при том же key не получит Range —
// «карточка-сирота», находка ревью Task 7) и быть стабильным под array-identity-
// churn от useRailScopes (иначе O(N²) перемонтирований ResizeObserver на гидрации).
// Извлечён в чистую функцию, чтобы оба потребителя не разъехались по формату.
import type { RailScopeEntry } from "./use-rail-scopes";

export function railScopeFingerprint(scopes: RailScopeEntry[]): string {
  return scopes
    .map((s) => `${s.key}#${s.notes.map((n) => n.id).join(",")}`)
    .join("|");
}
