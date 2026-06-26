import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import {
  AnchorActionsProvider,
  SelectionAffordanceHost,
  useRegisterAnchorAction,
} from "./anchor-actions";
import type { AnchorDraft } from "./types";

// jsdom не даёт реального выделения / getBoundingClientRect → визуальные кнопки
// поповера не проверяем. Тесты покрывают registry (register/unregister без
// throw, мульти-action, no-op без провайдера) и дым-монтирование хоста: без
// [data-ast-root] / без выделения → null.

// Стабильная module-scope ссылка onCreate (анти-OOM: НЕ новая функция каждый
// рендер — иначе useEffect-deps дёргали бы register/unregister в цикле).
const noopCreate = (draft: AnchorDraft) => {
  void draft;
};

function Consumer({
  enabled,
  id = "a1",
  label = "Add",
}: {
  enabled: boolean;
  id?: string;
  label?: string;
}) {
  useRegisterAnchorAction({ id, label, onCreate: noopCreate, enabled });
  return null;
}

describe("anchor-actions registry", () => {
  afterEach(() => {
    cleanup();
  });

  it("useRegisterAnchorAction под провайдером: register → unregister без throw", () => {
    expect(() => {
      const { rerender, unmount } = render(
        <AnchorActionsProvider>
          <Consumer enabled />
        </AnchorActionsProvider>,
      );
      // toggle enabled=false → cleanup-путь unregister
      rerender(
        <AnchorActionsProvider>
          <Consumer enabled={false} />
        </AnchorActionsProvider>,
      );
      unmount();
    }).not.toThrow();
  });

  it("useRegisterAnchorAction без провайдера — no-op, не бросает", () => {
    expect(() => {
      render(<Consumer enabled />);
    }).not.toThrow();
  });

  it("несколько действий регистрируются параллельно без throw", () => {
    expect(() => {
      render(
        <AnchorActionsProvider>
          <Consumer enabled id="margin" label="Заметка" />
          <Consumer enabled id="inline" label="Комментарий" />
        </AnchorActionsProvider>,
      );
    }).not.toThrow();
  });
});

describe("SelectionAffordanceHost (smoke)", () => {
  afterEach(() => {
    cleanup();
  });

  it("монтируется под провайдером без [data-ast-root] → ничего не рендерит (null)", () => {
    let html = "";
    expect(() => {
      const { container } = render(
        <AnchorActionsProvider>
          <SelectionAffordanceHost />
        </AnchorActionsProvider>,
      );
      html = container.innerHTML;
    }).not.toThrow();
    expect(html).toBe("");
  });

  it("без провайдера монтируется чисто и рендерит null", () => {
    let html = "";
    expect(() => {
      const { container } = render(<SelectionAffordanceHost />);
      html = container.innerHTML;
    }).not.toThrow();
    expect(html).toBe("");
  });

  it("хост + зарегистрированное действие без AST-рута → всё равно null (нет выделения)", () => {
    let html = "";
    expect(() => {
      const { container } = render(
        <AnchorActionsProvider>
          <Consumer enabled />
          <SelectionAffordanceHost />
        </AnchorActionsProvider>,
      );
      html = container.innerHTML;
    }).not.toThrow();
    expect(html).toBe("");
  });
});
