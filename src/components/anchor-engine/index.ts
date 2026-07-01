// src/components/anchor-engine/index.ts
// Публичный API движка маргиналий: политики-компоненты + типы якоря. Хуки и
// примитивы (highlight-controller, margin-notes-column, use-anchor-*) —
// ВНУТРЕННИЕ: их зовут сами политики относительными импортами,
// поэтому в публичный сёрфейс НЕ выносим (гигиена минимального API; knip-скрипт
// тоже пометил бы их unused — knip отдельный скрипт, не в гейте lint/test/build).
// Page-level агрегатор-приёмник одного тона (мультикорень). Единственная политика
// движка: слайсы регистрируют scope-заметки, MarginRail рисует колонку маргиналий.
export { MarginRail } from "./margin-rail";
// Идентичность скоупа + хелпер JSX-атрибута для разметки тел сущностей в слайсах +
// парный CSS-селектор (anchorScopeSelector) для querySelector корня скоупа в фичах.
export { anchorScopeAttr, anchorScopeSelector, type AnchorScopeId } from "./scope-id";
// Единая shared-поверхность захвата+аффорданса (PR3 dual-affordance fix).
// useRegisterAnchorAction — ВНУТРЕННИЙ (слои зовут относительным импортом), НЕ выносим.
// useStableAnchorAction регистрируют слайсы (create-action компоненты) через barrel.
// RailScopeEntry — ВНУТРЕННИЙ тип реестра (его строит MarginRail/тесты относительным
// импортом; слайсы отдают заметки через useRegisterRailScope), в barrel НЕ выносим.
export {
  AnchorScopeProvider,
  SelectionAffordanceHost,
  useStableAnchorAction,
} from "./anchor-actions";
// Реестр scope-заметок для rail: слайсы регистрируют свои заметки через
// useRegisterRailScope. useRailScopes читает ТОЛЬКО MarginRail (относительным
// импортом) — в публичный barrel не выносим.
export { useRegisterRailScope } from "./use-rail-scopes";
// Единый wide-гейт rail (container-детект .page-shell, scale-инвариантно): слайсы
// решают inline-vs-rail. Само измерение (isMarginaliaWide) держим внутренним
// (breakpoints.ts) — слайсам нужен только реактивный хук.
export { useWide } from "./use-wide";
export type { TextAnchor, AnchoredNote, AnchorDraft } from "./types";
