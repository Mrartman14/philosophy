// src/features/comments/ui/comment-anchor-scope-no-action.test.tsx
// Регресс структурного hoist: CommentAnchorScope (per-document rail-коннектор) НЕ должен
// регистрировать anchor-действие. Действие живёт ТОЛЬКО в page-level
// CommentAnchorSelectionComposer.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

const useStableAnchorAction = vi.hoisted(() => vi.fn());
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction,
  useRegisterRailScope: (): void => undefined,
  useWide: (): boolean => false,
  anchorScopeSelector: (type: string, id: string): string =>
    `[data-anchor-scope="${type}:${id}"]`,
}));

import { CommentAnchorScope } from "./comment-anchor-scope";

afterEach(() => {
  cleanup();
  useStableAnchorAction.mockClear();
});

describe("CommentAnchorScope: не регистрирует anchor-действие", () => {
  it("не зовёт useStableAnchorAction", () => {
    render(<CommentAnchorScope documentId="doc-1" notes={[]} />);
    expect(useStableAnchorAction).not.toHaveBeenCalled();
  });
});
