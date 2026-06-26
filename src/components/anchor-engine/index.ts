// src/components/anchor-engine/index.ts
// Публичный API движка маргиналий: политики-компоненты + типы якоря. Хуки и
// примитивы (highlight-controller, selection-affordance, margin-notes-column,
// use-anchor-*) — ВНУТРЕННИЕ: их зовут сами политики относительными импортами,
// поэтому в публичный сёрфейс НЕ выносим (гигиена минимального API; knip-скрипт
// тоже пометил бы их unused — knip отдельный скрипт, не в гейте lint/test/build).
export { MarginAnchorLayer, type MarginAnchorLayerProps } from "./margin-anchor-layer";
export { InlineAnchorLayer, type InlineAnchorLayerProps } from "./inline-anchor-layer";
export type { TextAnchor, AnchoredNote, AnchorDraft } from "./types";
