// src/features/semantic-map/cluster-color.ts
// Детерминированная палитра-фолбэк для кластеров карты, когда cluster.color не пришёл.
// Map-специфично (граф красит узлы по NodeType) — живёт в слайсе, а не в общем scene-3d.

const FALLBACK_PALETTE = [
  "#5B8FF9", "#61DDAA", "#65789B", "#F6BD16", "#7262FD",
  "#78D3F8", "#9661BC", "#F6903D", "#008685", "#F08BB4",
] as const;

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** cluster.color приоритетен (если валиден), иначе цвет по id. */
export function clusterColor(id: number, explicit?: string | null): string {
  if (explicit && HEX6.test(explicit)) return explicit;
  const n = FALLBACK_PALETTE.length;
  const i = ((id % n) + n) % n;
  // `?? [0]` — индекс кортежа вычисляемым i под noUncheckedIndexedAccess даёт `| undefined`.
  return FALLBACK_PALETTE[i] ?? FALLBACK_PALETTE[0];
}
