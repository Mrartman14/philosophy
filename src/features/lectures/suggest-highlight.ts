// src/features/lectures/suggest-highlight.ts
// Чистые функции подсветки терминов глоссария в тексте. Без "server-only":
// используются client-компонентом и тестами.
//
// КРИТИЧНО: бек (POST /api/glossary/suggest) отдаёт offset/length в БАЙТАХ
// UTF-8 (Go string indexing). JavaScript-строки индексируются по UTF-16
// code units. Здесь — конверсия byte-range → code-unit-range.

export interface CodeUnitRange {
  start: number;
  end: number;
}

export interface HighlightRange {
  /** Code-unit start (после конверсии). */
  start: number;
  /** Code-unit end (exclusive). */
  end: number;
  termId: string;
  title: string;
}

export interface Segment {
  text: string;
  highlight: { termId: string; title: string } | null;
}

/** Число байт UTF-8 для code point. */
function utf8Len(cp: number): number {
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

/**
 * Конвертирует байтовый диапазон UTF-8 [byteOffset, byteOffset+byteLength) в
 * диапазон UTF-16 code units строки JS. Проходит строку по code points,
 * накапливая байты UTF-8 и code units; на границе каждого символа фиксирует
 * code-unit-позицию, соответствующую накопленному числу байт. Байтовые offset
 * вне границ символов клампятся вверх до ближайшей границы; offset за пределами
 * строки клампится к её длине.
 */
export function byteRangeToCodeUnits(
  text: string,
  byteOffset: number,
  byteLength: number,
): CodeUnitRange {
  const byteEnd = byteOffset + byteLength;
  let bytes = 0;
  let cu = 0;
  let startCU: number | null = null;
  let endCU: number | null = null;

  // Граница ПЕРЕД первым символом (bytes === 0).
  if (bytes >= byteOffset) startCU = cu;
  if (bytes >= byteEnd) endCU = cu;

  // for..of итерирует по code points (не code units).
  for (const ch of text) {
    bytes += utf8Len(ch.codePointAt(0) ?? 0);
    cu += ch.length; // 1 для BMP, 2 для суррогатных пар
    if (startCU === null && bytes >= byteOffset) startCU = cu;
    if (endCU === null && bytes >= byteEnd) endCU = cu;
  }

  const total = text.length;
  const start = Math.min(startCU ?? total, total);
  const end = Math.min(endCU ?? total, total);
  return { start, end: Math.max(start, end) };
}

/**
 * Разбивает text на сегменты (plain / highlight). ranges — в code units.
 * Перекрывающиеся диапазоны: берём первый по start, вложенные/пересекающиеся
 * пропускаем (бек может вернуть пересечения — не валим рендер). Сортирует по
 * start. Гарантирует покрытие всей строки.
 */
export function segmentWithHighlights(
  text: string,
  ranges: HighlightRange[],
): Segment[] {
  const sorted = [...ranges]
    .filter((r) => r.start < r.end && r.start >= 0 && r.end <= text.length)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.start < cursor) continue; // перекрытие — пропускаем
    if (r.start > cursor) {
      segments.push({ text: text.slice(cursor, r.start), highlight: null });
    }
    segments.push({
      text: text.slice(r.start, r.end),
      highlight: { termId: r.termId, title: r.title },
    });
    cursor = r.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: null });
  }
  if (segments.length === 0) {
    segments.push({ text, highlight: null });
  }
  return segments;
}
