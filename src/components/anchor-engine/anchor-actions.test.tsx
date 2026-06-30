import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, it, expect } from "vitest";

import {
  AnchorScopeProvider,
  applicableActions,
  SelectionAffordanceHost,
  useRegisterAnchorAction,
  useStableAnchorAction,
  type AnchorAction,
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

describe("applicableActions", () => {
  const annotate: AnchorAction = {
    id: "annotation",
    label: "A",
    onCreate: noopCreate,
    appliesTo: () => true,
  };
  const commentAnchor: AnchorAction = {
    id: "comment-anchor",
    label: "C",
    onCreate: noopCreate,
    appliesTo: (t) => t === "document",
  };
  const all = [annotate, commentAnchor];

  it("в document-скоупе доступны оба действия", () => {
    expect(applicableActions(all, "document").map((a) => a.id)).toEqual([
      "annotation",
      "comment-anchor",
    ]);
  });
  it("в comment-скоупе comment-anchor отфильтрован", () => {
    expect(applicableActions(all, "comment").map((a) => a.id)).toEqual(["annotation"]);
  });
});

describe("anchor-actions registry", () => {
  afterEach(() => {
    cleanup();
  });

  it("useRegisterAnchorAction под провайдером: register → unregister без throw", () => {
    expect(() => {
      const { rerender, unmount } = render(
        <AnchorScopeProvider>
          <Consumer enabled />
        </AnchorScopeProvider>,
      );
      // toggle enabled=false → cleanup-путь unregister
      rerender(
        <AnchorScopeProvider>
          <Consumer enabled={false} />
        </AnchorScopeProvider>,
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
        <AnchorScopeProvider>
          <Consumer enabled id="margin" label="Заметка" />
          <Consumer enabled id="inline" label="Комментарий" />
        </AnchorScopeProvider>,
      );
    }).not.toThrow();
  });
});

// Счётчик commit'ов вне React. Инкремент в useEffect (без deps) — фиксирует
// КАЖДЫЙ commit/рендер; мутация во время рендера запрещена (react-hooks/
// immutability), а в эффекте — разрешена. Каждый тест сбрасывает перед mount.
const renderTally = { count: 0 };

// Слайс-имитация: вызывает useStableAnchorAction с ИНЛАЙН-замыканием appliesTo
// (новая идентичность каждый рендер, как annotation-create-action /
// comment-anchor-scope). До фикса C1 это крутило бесконечный register-цикл.
function InlineAppliesToConsumer({ predicate }: { predicate: (t: string) => boolean }) {
  // Без deps → эффект коммитится после каждого рендера: счётчик = число commit'ов.
  useEffect(() => {
    renderTally.count += 1;
  });
  useStableAnchorAction({
    id: "slice",
    label: "Add",
    enabled: true,
    onCreate: (draft: AnchorDraft) => {
      void draft;
    },
    // Инлайн-обёртка над predicate → новая идентичность appliesTo каждый рендер.
    appliesTo: (t) => predicate(t),
  });
  return null;
}

describe("useStableAnchorAction (render-loop guard)", () => {
  afterEach(() => {
    cleanup();
  });

  // Регресс C1: до фикса useStableAnchorAction ref-стабилизировал только onCreate,
  // а appliesTo пробрасывал сырым → оно попадало в useEffect-deps регистрации →
  // unregister+register каждый рендер → setActions (новый массив) → новый context
  // value → ре-рендер консьюмера → новое замыкание → ЦИКЛ («Maximum update depth
  // exceeded»). На СТАРОМ коде этот тест зависал/падал; на новом — сходится.
  it("инлайн appliesTo (always) не вызывает бесконечный register-цикл", () => {
    renderTally.count = 0;
    expect(() => {
      render(
        <AnchorScopeProvider>
          <InlineAppliesToConsumer predicate={() => true} />
        </AnchorScopeProvider>,
      );
    }).not.toThrow();
    // Сходимость: один register-эффект + один коммит actions → единичный лишний
    // рендер консьюмера, далее стабильно. На баге счётчик улетел бы в десятки/
    // сотни до «Maximum update depth». Порог с запасом.
    expect(renderTally.count).toBeLessThan(20);
  });

  it("инлайн appliesTo (document-only предикат) — также сходится без цикла", () => {
    renderTally.count = 0;
    expect(() => {
      render(
        <AnchorScopeProvider>
          <InlineAppliesToConsumer predicate={(t) => t === "document"} />
        </AnchorScopeProvider>,
      );
    }).not.toThrow();
    expect(renderTally.count).toBeLessThan(20);
  });

  it("ре-рендер родителя с НОВОЙ инлайн-appliesTo не зацикливает регистрацию", () => {
    renderTally.count = 0;
    expect(() => {
      const { rerender } = render(
        <AnchorScopeProvider>
          <InlineAppliesToConsumer predicate={() => true} />
        </AnchorScopeProvider>,
      );
      // Новый predicate → новая инлайн-appliesTo. Без ref-стабилизации это
      // переинициализировало бы эффект регистрации и могло раскрутить цикл.
      rerender(
        <AnchorScopeProvider>
          <InlineAppliesToConsumer predicate={(t) => t === "document"} />
        </AnchorScopeProvider>,
      );
    }).not.toThrow();
    expect(renderTally.count).toBeLessThan(20);
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
        <AnchorScopeProvider>
          <SelectionAffordanceHost />
        </AnchorScopeProvider>,
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
        <AnchorScopeProvider>
          <Consumer enabled />
          <SelectionAffordanceHost />
        </AnchorScopeProvider>,
      );
      html = container.innerHTML;
    }).not.toThrow();
    expect(html).toBe("");
  });
});
