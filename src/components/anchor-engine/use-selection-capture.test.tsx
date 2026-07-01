import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { must } from "./test-support";
import { useSelectionCapture } from "./use-selection-capture";

// jsdom: getBoundingClientRect → нули, selectionchange/getSelection частичны.
// Дым-тесты проверяют монтирование/clear без throw; scope-тест проверяет, что
// draft несёт scope, найденный из самого выделения (без rootRef). Плюс
// содержательный кейс: реальное cross-cell Selection одной таблицы В СКОУПЕ →
// прямоугольный draft (device-agnostic путь touchend/pointerup, node_id).
// Пиксельная геометрия крепления — ручной QA (Task 20).

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// Программно строим <div data-anchor-scope><p data-block-id>…</p></div> и держим
// ссылку на текстовый узел напрямую — без querySelector/.firstChild
// (testing-library/no-node-access).
function buildScope(
  scopeAttr: string,
  text: string,
): { root: HTMLElement; textNode: Text } {
  const root = document.createElement("div");
  root.setAttribute("data-anchor-scope", scopeAttr);
  const p = document.createElement("p");
  p.dataset.blockId = "b1";
  p.dataset.nodeId = "b1"; // рендер эмитит оба; anchorFromSelection строит якорь по data-node-id листа
  const textNode = document.createTextNode(text);
  p.appendChild(textNode);
  root.appendChild(p);
  document.body.appendChild(root);
  return { root, textNode };
}

describe("useSelectionCapture (scope-aware)", () => {
  it("монтируется без throw; без выделения draft===null", () => {
    const { result } = renderHook(() => useSelectionCapture({ enabled: true }));
    expect(result.current.draft).toBeNull();
  });

  it("selectionchange без выделения не падает и оставляет draft===null", () => {
    const { result } = renderHook(() => useSelectionCapture({ enabled: true }));
    expect(() => {
      document.dispatchEvent(new Event("selectionchange"));
      document.dispatchEvent(new Event("pointerup"));
    }).not.toThrow();
    expect(result.current.draft).toBeNull();
  });

  it("clear() не падает (программное снятие выделения)", () => {
    const { result } = renderHook(() => useSelectionCapture({ enabled: true }));
    expect(() => {
      result.current.clear();
    }).not.toThrow();
    expect(result.current.draft).toBeNull();
  });

  it("enabled=false: без подписок, монтируется чисто", () => {
    const { result } = renderHook(() => useSelectionCapture({ enabled: false }));
    expect(() => {
      document.dispatchEvent(new Event("selectionchange"));
    }).not.toThrow();
    expect(result.current.draft).toBeNull();
  });

  it("builds a draft carrying the selection's scope", () => {
    // jsdom не реализует Range.getBoundingClientRect — шим на время кейса,
    // чтобы хук смог собрать draft.rect (восстанавливаем в finally).
    const proto = Range.prototype as unknown as {
      getBoundingClientRect?: () => DOMRect;
    };
    const original = proto.getBoundingClientRect;
    proto.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
    try {
      const { textNode } = buildScope("comment:c1", "hello world");
      const { result } = renderHook(() =>
        useSelectionCapture({ enabled: true }),
      );

      const sel = must(window.getSelection());
      const r = document.createRange();
      r.setStart(textNode, 0);
      r.setEnd(textNode, 5);
      sel.removeAllRanges();
      sel.addRange(r);

      act(() => {
        document.dispatchEvent(new Event("pointerup"));
      });

      const draft = result.current.draft;
      expect(draft?.scope).toEqual({ entityType: "comment", entityId: "c1" });
      expect(draft?.anchor.exact).toBe("hello");
    } finally {
      if (original) proto.getBoundingClientRect = original;
      else delete proto.getBoundingClientRect;
    }
  });

  it("кросс-ячеечное выделение таблицы В СКОУПЕ → draft с прямоугольным якорем (device-agnostic)", () => {
    // Тач-капчур неотличим от указательного: touchend и pointerup идут в ОДИН
    // onPointerUp → идентичный recompute из window.getSelection(). Строим РЕАЛЬНОЕ
    // кросс-ячеечное Selection внутри [data-anchor-scope] и проверяем полный путь
    // до draft.anchor (node_id ячеек, правило 4 same-table).
    //
    // jsdom-Range не имеет getBoundingClientRect (recompute бросил бы на непустом
    // якоре) — стабим на время теста, чтобы дойти до setDraft. Стаб восстанавливаем.
    const proto = Range.prototype as unknown as { getBoundingClientRect?: () => DOMRect };
    const saved = proto.getBoundingClientRect;
    proto.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    try {
      const root = document.createElement("div");
      root.setAttribute("data-anchor-scope", "document:d1");
      const table = document.createElement("table");
      table.dataset.blockId = "t1";
      const tbody = document.createElement("tbody");
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.dataset.nodeId = "c1";
      const c1 = document.createTextNode("aa");
      td1.appendChild(c1);
      const td2 = document.createElement("td");
      td2.dataset.nodeId = "c2";
      const c2 = document.createTextNode("bb");
      td2.appendChild(c2);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      root.appendChild(table);
      document.body.appendChild(root);

      const { result } = renderHook(() => useSelectionCapture({ enabled: true }));
      const range = document.createRange();
      range.setStart(c1, 0);
      range.setEnd(c2, 2);
      const sel = must(window.getSelection());
      sel.removeAllRanges();
      sel.addRange(range);
      // touchend (тач) → тот же onPointerUp, что pointerup → device-agnostic.
      act(() => {
        document.dispatchEvent(new Event("touchend"));
      });
      const draft = result.current.draft;
      expect(draft?.scope).toEqual({ entityType: "document", entityId: "d1" });
      expect(draft?.anchor).toMatchObject({ startNodeId: "c1", endNodeId: "c2" });
    } finally {
      if (saved) proto.getBoundingClientRect = saved;
      else delete proto.getBoundingClientRect;
    }
  });
});
