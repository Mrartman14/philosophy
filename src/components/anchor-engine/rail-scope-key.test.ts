import { describe, expect, it } from "vitest";

import { railScopeFingerprint } from "./rail-scope-key";
import type { RailScopeEntry } from "./use-rail-scopes";

// Чистый хелпер стабильного отпечатка состава rail-скоупов. Тестируем ЗНАЧЕНИЕ
// строки (инвариант, который держит совпадение deps в useAggregatedAnchorRanges и
// margin-rail): отпечаток обязан меняться при add/remove заметки и быть стабильным
// при том же составе, чтобы не вернулся orphan-card баг (находка ревью Task 7).
const noopRender = () => null;

function entry(key: string, noteIds: string[]): RailScopeEntry {
  return {
    key,
    // rootEl в отпечаток НЕ входит — для чистого теста хватает заглушки.
    rootEl: { nodeType: 1 } as unknown as HTMLElement,
    tone: "annotation",
    notes: noteIds.map((id) => ({ id, anchor: { kind: "text", blockId: id } })),
    renderNote: noopRender,
  };
}

describe("railScopeFingerprint", () => {
  it("стабилен при одинаковом составе (тот же key + те же id заметок)", () => {
    const a = [entry("annotation:document:d1", ["n1", "n2"])];
    const b = [entry("annotation:document:d1", ["n1", "n2"])];
    expect(railScopeFingerprint(a)).toBe(railScopeFingerprint(b));
  });

  it("меняется при добавлении заметки", () => {
    const before = railScopeFingerprint([entry("k", ["n1"])]);
    const after = railScopeFingerprint([entry("k", ["n1", "n2"])]);
    expect(after).not.toBe(before);
  });

  it("меняется при удалении заметки", () => {
    const before = railScopeFingerprint([entry("k", ["n1", "n2"])]);
    const after = railScopeFingerprint([entry("k", ["n1"])]);
    expect(after).not.toBe(before);
  });

  it("меняется при смене key скоупа", () => {
    const before = railScopeFingerprint([entry("k1", ["n1"])]);
    const after = railScopeFingerprint([entry("k2", ["n1"])]);
    expect(after).not.toBe(before);
  });

  it("различает добавление НОВОГО скоупа", () => {
    const one = railScopeFingerprint([entry("k1", ["n1"])]);
    const two = railScopeFingerprint([
      entry("k1", ["n1"]),
      entry("k2", ["n2"]),
    ]);
    expect(two).not.toBe(one);
  });

  it("пустой набор скоупов → пустая строка", () => {
    expect(railScopeFingerprint([])).toBe("");
  });

  it("воспроизводит ровно тот же формат, что инлайн-выражение потребителей", () => {
    const scopes = [
      entry("annotation:document:d1", ["n1", "n2"]),
      entry("comment:document:d1", ["n3"]),
    ];
    const inline = scopes
      .map((s) => `${s.key}#${s.notes.map((n) => n.id).join(",")}`)
      .join("|");
    expect(railScopeFingerprint(scopes)).toBe(inline);
  });
});
