// src/components/anchor-engine/index.ts
// Публичный API движка маргиналий: политики-компоненты + типы якоря. Хуки и
// примитивы (highlight-controller, margin-notes-column, use-anchor-*) —
// ВНУТРЕННИЕ: их зовут сами политики относительными импортами,
// поэтому в публичный сёрфейс НЕ выносим (гигиена минимального API; knip-скрипт
// тоже пометил бы их unused — knip отдельный скрипт, не в гейте lint/test/build).
// Page-level агрегатор-приёмник одного тона (мультикорень). Единственная политика
// движка: слайсы регистрируют scope-заметки, MarginRail рисует колонку маргиналий.
export { MarginRail } from "./margin-rail";
// Идентичность скоупа + хелпер JSX-атрибута для разметки тел сущностей в слайсах.
export { anchorScopeAttr, type AnchorScopeId } from "./scope-id";
// Единая shared-поверхность захвата+аффорданса (PR3 dual-affordance fix).
// useRegisterAnchorAction — ВНУТРЕННИЙ (слои зовут относительным импортом), НЕ выносим.
// useStableAnchorAction регистрируют слайсы (create-action компоненты) через barrel.
export {
  AnchorScopeProvider,
  SelectionAffordanceHost,
  useStableAnchorAction,
  type RailScopeEntry,
} from "./anchor-actions";
// Реестр scope-заметок для rail: слайсы регистрируют свои заметки, MarginRail читает.
export { useRegisterRailScope, useRailScopes } from "./use-rail-scopes";
// Единый wide-гейт rail (один порог WIDE_MEDIA): слайсы решают inline-vs-rail.
export { useWide, WIDE_MEDIA } from "./use-wide";
export type { TextAnchor, AnchoredNote, AnchorDraft } from "./types";
