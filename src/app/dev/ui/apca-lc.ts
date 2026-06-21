// Самодостаточный порт APCA-W3 (SA98G) — БЕЗ внешних зависимостей
// (apca-w3/culori — devDeps, нельзя в код страницы). Паритет — в apca-lc.test.ts.
const MAIN_TRC = 2.4;
const R_CO = 0.2126729;
const G_CO = 0.7151522;
const B_CO = 0.072175;
const NORM_BG = 0.56;
const NORM_TXT = 0.57;
const REV_TXT = 0.62;
const REV_BG = 0.65;
const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;
const SCALE = 1.14;
const LO_OFFSET = 0.027;
const DELTA_Y_MIN = 0.0005;
const LO_CLIP = 0.1;

/** Линейная яркость Y по sRGB (компоненты 0..255). */
export function srgbToY([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => Math.pow(c / 255, MAIN_TRC);
  return R_CO * lin(r) + G_CO * lin(g) + B_CO * lin(b);
}

/** APCA-контраст Lc (~ -108..106). txtY — текст, bgY — фон. */
export function apcaContrast(txtY: number, bgY: number): number {
  const tY = txtY > BLK_THRS ? txtY : txtY + Math.pow(BLK_THRS - txtY, BLK_CLMP);
  const bY = bgY > BLK_THRS ? bgY : bgY + Math.pow(BLK_THRS - bgY, BLK_CLMP);
  if (Math.abs(bY - tY) < DELTA_Y_MIN) return 0;
  let out: number;
  if (bY > tY) {
    const sapc = (Math.pow(bY, NORM_BG) - Math.pow(tY, NORM_TXT)) * SCALE;
    out = sapc < LO_CLIP ? 0 : sapc - LO_OFFSET;
  } else {
    const sapc = (Math.pow(bY, REV_BG) - Math.pow(tY, REV_TXT)) * SCALE;
    out = sapc > -LO_CLIP ? 0 : sapc + LO_OFFSET;
  }
  return out * 100;
}

/** Парсит CSS `rgb(r,g,b)` / `rgb(r g b)` / `rgba(...)` → [r,g,b] (0..255) или null. */
export function parseRgb(s: string): [number, number, number] | null {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Lc для пары CSS-цветов (текст, фон) как их вернул getComputedStyle. null — если не распарсилось. */
export function apcaLc(fgColor: string, bgColor: string): number | null {
  const fg = parseRgb(fgColor);
  const bg = parseRgb(bgColor);
  if (!fg || !bg) return null;
  return apcaContrast(srgbToY(fg), srgbToY(bg));
}
