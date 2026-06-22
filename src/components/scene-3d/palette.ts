// Детерминированная палитра-фолбэк, когда cluster.color не пришёл.

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

/** "#rrggbb" → [r, g, b] в диапазоне 0..1. */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
