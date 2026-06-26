// src/components/anchor-engine/tone.ts
// Единый источник цвета по тону маргиналии: линия выноски и акцент карточки
// ОБЯЗАНЫ совпадать (спека: цвет линии == цвет акцента). Один маппинг — без дрейфа.
export type Tone = "annotation" | "comment";
export function toneColor(tone: Tone): string {
  return tone === "comment" ? "var(--color-link)" : "var(--color-highlight-active)";
}
