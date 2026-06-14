import { describe, expect, it } from "vitest";

import {
  byteRangeToCodeUnits,
  segmentWithHighlights,
  type HighlightRange,
} from "./suggest-highlight";

describe("byteRangeToCodeUnits", () => {
  it("ASCII: байты == code units", () => {
    // "hello", термин "ell" = байты [1,4)
    expect(byteRangeToCodeUnits("hello", 1, 3)).toEqual({ start: 1, end: 4 });
  });

  it("кириллица: 'Кант' — каждая буква 2 байта UTF-8, 1 code unit", () => {
    // "Кант философ", термин "Кант" = байты [0,8) (4 буквы × 2 байта)
    const text = "Кант философ";
    expect(byteRangeToCodeUnits(text, 0, 8)).toEqual({ start: 0, end: 4 });
  });

  it("кириллица со смещением: термин 'философ' в 'Кант философ'", () => {
    // "Кант " = 4×2 + 1 = 9 байт; "философ" = 7×2 = 14 байт → [9,23)
    const text = "Кант философ";
    expect(byteRangeToCodeUnits(text, 9, 14)).toEqual({ start: 5, end: 12 });
  });

  it("эмодзи (4 байта UTF-8, 2 UTF-16 code units) после термина не ломает индекс", () => {
    // "🜂Кант": эмодзи 4 байта/2 cu; "Кант" = байты [4,12) → cu [2,6)
    const text = "🜂Кант";
    expect(byteRangeToCodeUnits(text, 4, 8)).toEqual({ start: 2, end: 6 });
  });

  it("offset за пределами строки → клампится", () => {
    const r = byteRangeToCodeUnits("hi", 100, 5);
    expect(r.start).toBeLessThanOrEqual(2);
    expect(r.end).toBeLessThanOrEqual(2);
  });
});

describe("segmentWithHighlights", () => {
  it("без вхождений → один plain-сегмент", () => {
    const segs = segmentWithHighlights("hello", []);
    expect(segs).toEqual([{ text: "hello", highlight: null }]);
  });

  it("одно вхождение в середине", () => {
    const ranges: HighlightRange[] = [{ start: 1, end: 4, termId: "t1", title: "ell" }];
    const segs = segmentWithHighlights("hello", ranges);
    expect(segs).toEqual([
      { text: "h", highlight: null },
      { text: "ell", highlight: { termId: "t1", title: "ell" } },
      { text: "o", highlight: null },
    ]);
  });

  it("перекрывающиеся вхождения: берём первое, пропускаем вложенное", () => {
    const ranges: HighlightRange[] = [
      { start: 0, end: 5, termId: "a", title: "hello" },
      { start: 1, end: 3, termId: "b", title: "el" },
    ];
    const segs = segmentWithHighlights("hello", ranges);
    expect(segs).toEqual([
      { text: "hello", highlight: { termId: "a", title: "hello" } },
    ]);
  });

  it("несколько непересекающихся вхождений по порядку", () => {
    const ranges: HighlightRange[] = [
      { start: 6, end: 11, termId: "b", title: "world" },
      { start: 0, end: 5, termId: "a", title: "hello" },
    ];
    const segs = segmentWithHighlights("hello world", ranges);
    expect(segs).toEqual([
      { text: "hello", highlight: { termId: "a", title: "hello" } },
      { text: " ", highlight: null },
      { text: "world", highlight: { termId: "b", title: "world" } },
    ]);
  });
});
