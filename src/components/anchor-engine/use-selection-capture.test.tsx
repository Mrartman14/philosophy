import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, it, expect } from "vitest";

import { must } from "./test-support";
import type { AnchorDraft } from "./types";
import { useSelectionCapture } from "./use-selection-capture";

// jsdom: getBoundingClientRect → нули, selectionchange/getSelection частичны.
// Дым-тест проверяет ТОЛЬКО что хук монтируется и без выделения draft===null,
// без throw. Реальная геометрия/поведение — ручной QA (Task 20).

interface Probe {
  draft: AnchorDraft | null;
  clear: () => void;
}

function Harness({ enabled, seen }: { enabled: boolean; seen: Probe[] }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const state = useSelectionCapture({ rootRef, enabled });
  seen.push(state);
  // Callback-ref присваивает rootRef.current на коммите (host-элемент, не во время рендера).
  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
  };
  // Контент-рут с AST-блоком — рендерим, чтобы rootRef мог зацепиться.
  return (
    <div ref={setRoot}>
      <p data-block-id="b1">hello</p>
    </div>
  );
}

function last(seen: Probe[]): Probe {
  return must(seen.at(-1));
}

describe("useSelectionCapture (smoke)", () => {
  afterEach(() => {
    cleanup();
  });

  it("монтируется без throw; без выделения draft===null", () => {
    const seen: Probe[] = [];
    expect(() => {
      render(<Harness enabled seen={seen} />);
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });

  it("selectionchange без выделения не падает и оставляет draft===null", () => {
    const seen: Probe[] = [];
    render(<Harness enabled seen={seen} />);
    expect(() => {
      document.dispatchEvent(new Event("selectionchange"));
      document.dispatchEvent(new Event("pointerup"));
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });

  it("clear() не падает (программное снятие выделения)", () => {
    const seen: Probe[] = [];
    render(<Harness enabled seen={seen} />);
    expect(() => {
      last(seen).clear();
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });

  it("enabled=false: без подписок, монтируется чисто", () => {
    const seen: Probe[] = [];
    expect(() => {
      render(<Harness enabled={false} seen={seen} />);
      document.dispatchEvent(new Event("selectionchange"));
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });

  it("кросс-ячеечное выделение одной таблицы → draft с прямоугольным якорем (device-agnostic)", () => {
    // Тач-капчур неотличим от указательного: обе подписки (touchend/pointerup) идут
    // в ОДИН onPointerUp → идентичный recompute из window.getSelection(). Строим
    // РЕАЛЬНОЕ кросс-ячеечное Selection и проверяем ПОЛНЫЙ путь до draft.anchor.
    //
    // jsdom-Range не имеет getBoundingClientRect (recompute бросил бы на непустом
    // якоре) — стабим на время теста, чтобы дойти до setDraft. Стаб восстанавливаем.
    const proto = Range.prototype as { getBoundingClientRect?: () => DOMRect };
    const saved = proto.getBoundingClientRect;
    proto.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    try {
      const seen: Probe[] = [];
      function TableHarness() {
        const rootRef = useRef<HTMLElement | null>(null);
        seen.push(useSelectionCapture({ rootRef, enabled: true }));
        return (
          <div
            ref={(el) => {
              rootRef.current = el;
            }}
          >
            <table data-block-id="t1">
              <tbody>
                <tr>
                  <td data-node-id="c1">aa</td>
                  <td data-node-id="c2">bb</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }
      render(<TableHarness />);
      // eslint-disable-next-line testing-library/no-node-access -- нужен text-node ячейки для построения Range (TL-методы его не дают)
      const c1 = must(document.querySelector('[data-node-id="c1"]')).firstChild as Text;
      // eslint-disable-next-line testing-library/no-node-access -- нужен text-node ячейки для построения Range (TL-методы его не дают)
      const c2 = must(document.querySelector('[data-node-id="c2"]')).firstChild as Text;
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
      expect(last(seen).draft?.anchor).toMatchObject({ startNodeId: "c1", endNodeId: "c2" });
    } finally {
      if (saved) proto.getBoundingClientRect = saved;
      else delete proto.getBoundingClientRect;
    }
  });
});
