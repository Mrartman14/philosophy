// src/features/annotations/ui/annotation-scope-no-action.test.tsx
// Регресс структурного hoist: AnnotationScope (множимый per-scope компонент — 1 на
// документ + 1 на каждый комментарий) НЕ должен регистрировать anchor-действие. Иначе
// возвращается баг «N синглтонов на один id + первый unmount убирает действие для всех».
// Действие живёт ТОЛЬКО в page-level AnnotationSelectionComposer.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// vi.hoisted: спай нужен внутри hoisted-фабрики vi.mock (иначе TDZ на top-level const).
const { useStableAnchorAction } = vi.hoisted(() => ({ useStableAnchorAction: vi.fn() }));
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction,
  useRegisterRailScope: (): void => undefined,
  useWide: (): boolean => false,
  anchorScopeSelector: (type: string, id: string): string =>
    `[data-anchor-scope="${type}:${id}"]`,
}));

// Композер-диалог мокаем в no-op (в этом тесте важна только регистрация действия).
vi.mock("./annotation-composer-dialog", () => ({
  AnnotationComposerDialog: () => null,
}));

import { AnnotationScope } from "./annotation-scope";

afterEach(() => {
  cleanup();
  useStableAnchorAction.mockClear();
});

describe("AnnotationScope: не регистрирует anchor-действие", () => {
  it("comment-скоуп (per-comment) не зовёт useStableAnchorAction", () => {
    render(<AnnotationScope parentEntityType="comment" parentId="cmt-1" notes={[]} canCreate />);
    expect(useStableAnchorAction).not.toHaveBeenCalled();
  });

  it("document-скоуп с тулбаром не зовёт useStableAnchorAction", () => {
    render(
      <AnnotationScope parentEntityType="document" parentId="doc-1" notes={[]} canCreate showToolbar />,
    );
    expect(useStableAnchorAction).not.toHaveBeenCalled();
  });
});
