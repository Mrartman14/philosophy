// src/features/annotations/ui/annotation-scope-unanchored.test.tsx
// Покрытие unanchored-пути: под showToolbar (документ) кнопка «Добавить аннотацию»
// открывает ЛОКАЛЬНЫЙ композер БЕЗ якоря, parent из пропов скоупа. Selection-driven
// создание с якорем живёт в page-level AnnotationSelectionComposer — здесь именно
// document-level unanchored (единственный вход для аннотации без фрагмента).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// Движок мокаем no-op'ами (rail/wide в этом тесте не нужны — проверяем тулбар).
vi.mock("@/components/anchor-engine", () => ({
  useRegisterRailScope: (): void => undefined,
  useWide: (): boolean => false,
  anchorScopeSelector: (type: string, id: string): string => `[data-anchor-scope="${type}:${id}"]`,
}));

// Композер мокаем: выносим open + parent + наличие якоря в data-атрибуты.
vi.mock("./annotation-composer-dialog", () => ({
  AnnotationComposerDialog: ({
    parentEntityType,
    parentId,
    open,
    anchor,
  }: {
    parentEntityType?: string;
    parentId: string;
    open: boolean;
    anchor?: unknown;
  }) =>
    open ? (
      <div
        data-testid="composer"
        data-parent-entity-type={parentEntityType}
        data-parent-id={parentId}
        data-has-anchor={anchor === undefined ? "no" : "yes"}
      />
    ) : null,
}));

import { AnnotationScope } from "./annotation-scope";

afterEach(() => {
  cleanup();
});

describe("AnnotationScope unanchored (showToolbar)", () => {
  it("«Добавить аннотацию» открывает unanchored-композер с parent из пропов, без якоря", () => {
    render(
      <AnnotationScope parentEntityType="document" parentId="d1" notes={[]} canCreate showToolbar />,
    );
    expect(screen.queryByTestId("composer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "marginAddUnanchored" }));
    const composer = screen.getByTestId("composer");
    expect(composer.getAttribute("data-parent-entity-type")).toBe("document");
    expect(composer.getAttribute("data-parent-id")).toBe("d1");
    expect(composer.getAttribute("data-has-anchor")).toBe("no");
  });

  it("без canCreate кнопки «Добавить аннотацию» нет", () => {
    render(
      <AnnotationScope
        parentEntityType="document"
        parentId="d1"
        notes={[]}
        canCreate={false}
        showToolbar
      />,
    );
    expect(screen.queryByRole("button", { name: "marginAddUnanchored" })).toBeNull();
  });
});
