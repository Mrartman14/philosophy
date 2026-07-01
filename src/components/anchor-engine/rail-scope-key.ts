// src/components/anchor-engine/rail-scope-key.ts
// Стабильный отпечаток СОСТАВА rail-скоупов: `${key}#${id,id,…}` на скоуп,
// склеенные через "|". Это load-bearing инвариант: им ключуются useMemo/useEffect
// в useAggregatedAnchorRanges И margin-rail. Отпечаток обязан меняться при
// add/remove заметки (иначе новая аннотация при том же key не получит Range —
// «карточка-сирота», находка ревью Task 7) и быть стабильным под array-identity-
// churn от useRailScopes (иначе O(N²) перемонтирований ResizeObserver на гидрации).
// Извлечён в чистую функцию, чтобы оба потребителя не разъехались по формату.
//
// КОНТРАКТ СТАБИЛЬНОСТИ rootEl (аудит #8): отпечаток НЕ включает идентичность
// s.rootEl — только key + highlightEnabled + id-нот. Это опирается на инвариант:
// rootEl СТАБИЛЕН для данного key (скоуп = тело сущности с фикс. data-anchor-scope;
// его DOM-узел не подменяется, пока key жив). Если бы rootEl мог смениться под тем
// же key (пере-рендер тела с новым узлом), geometries застряли бы на старом корне —
// но такого пути в движке нет: слайс регистрирует rootEl один раз на key.
import type { RailScopeEntry } from "./use-rail-scopes";

export function railScopeFingerprint(scopes: RailScopeEntry[]): string {
  // `${key}:${highlightEnabled?1:0}#${id,id,…}` на скоуп. highlightEnabled в
  // отпечатке: тумблер reading-mode обязан менять scopeKey, иначе flat/persistentIds/
  // overlay в MarginRail застревают stale и подсветка не гаснет (регресс vs
  // MarginAnchorLayer; находка аудита 2026-07-01).
  return scopes
    .map(
      (s) =>
        `${s.key}:${s.highlightEnabled === false ? 0 : 1}#${s.notes.map((n) => n.id).join(",")}`,
    )
    .join("|");
}
